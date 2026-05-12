using PortsideApi.Services;
using PortsideApi.Models;
using k8s;
using k8s.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace PortsideApi.Controllers;

[ApiController]
[Route("api/kubernetes")]
public class KubernetesController : ControllerBase
{
    private readonly KubernetesService _kubernetesService;
    private readonly IKubernetes _kubernetesClient;
    private readonly IMemoryCache _cache;
    private readonly PodMonitorService _podMonitor;
    private readonly ILogger<KubernetesController> _logger;

    public KubernetesController(
        KubernetesService kubernetesService,
        IKubernetes kubernetesClient,
        IMemoryCache cache,
        PodMonitorService podMonitor,
        ILogger<KubernetesController> logger)
    {
        _kubernetesService = kubernetesService;
        _kubernetesClient = kubernetesClient;
        _cache = cache;
        _podMonitor = podMonitor;
        _logger = logger;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        try
        {
            if (!_cache.TryGetValue(KubernetesService.MetricsCacheKey, out Cluster? cachedMetrics))
                return Ok(await _kubernetesService.GetMetrics());
            return Ok(cachedMetrics);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get cluster metrics");
            return StatusCode(500, new { error = "Failed to get cluster metrics", message = ex.Message });
        }
    }

    [HttpGet("nodes")]
    public async Task<IActionResult> GetNodes()
    {
        try
        {
            var nodes = await _kubernetesClient.CoreV1.ListNodeAsync();
            return Ok(nodes.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get nodes");
            return StatusCode(500, new { error = "Failed to get nodes", message = ex.Message });
        }
    }

    [HttpGet("pods")]
    public async Task<IActionResult> GetPods([FromQuery] string? @namespace = null)
    {
        try
        {
            V1PodList pods;
            if (string.IsNullOrEmpty(@namespace))
            {
                pods = await _kubernetesClient.CoreV1.ListPodForAllNamespacesAsync();
            }
            else
            {
                pods = await _kubernetesClient.CoreV1.ListNamespacedPodAsync(@namespace);
            }

            // Try to get pod metrics
            try
            {
                var podMetrics = string.IsNullOrEmpty(@namespace) 
                    ? await _kubernetesClient.GetKubernetesPodsMetricsAsync()
                    : await _kubernetesClient.GetKubernetesPodsMetricsByNamespaceAsync(@namespace);

                // Get node information for capacity calculations
                var nodes = await _kubernetesClient.CoreV1.ListNodeAsync();
                var nodeCapacityDict = new Dictionary<string, (double cpuCores, double memoryBytes)>();
                
                foreach (var node in nodes.Items)
                {
                    double cpuCapacity = 0;
                    double memoryCapacity = 0;
                    
                    if (node.Status.Capacity.TryGetValue("cpu", out var cpu))
                    {
                        cpuCapacity = double.Parse(cpu.Value ?? "0");
                    }
                    if (node.Status.Capacity.TryGetValue("memory", out var memory))
                    {
                        memoryCapacity = KubernetesService.ParseMemory(memory.Value ?? "0");
                    }
                    
                    nodeCapacityDict[node.Metadata.Name] = (cpuCapacity, memoryCapacity);
                }

                // Create a dictionary for quick lookup
                var metricsDict = new Dictionary<string, Dictionary<string, object>>();
                foreach (var metric in podMetrics.Items)
                {
                    var key = $"{metric.Metadata.NamespaceProperty}/{metric.Metadata.Name}";
                    var podMetric = new Dictionary<string, object>();
                    
                    // Calculate total CPU and memory for all containers
                    double totalCpu = 0;
                    double totalMemory = 0;
                    
                    foreach (var container in metric.Containers)
                    {
                        if (container.Usage.TryGetValue("cpu", out var cpu))
                        {
                            try
                            {
                                totalCpu += KubernetesService.ParseCpu(cpu.Value);
                            }
                            catch (Exception cpuEx)
                            {
                                _logger.LogWarning($"Failed to parse CPU for pod {metric.Metadata.Name}: {cpu.Value} - {cpuEx.Message}");
                            }
                        }
                        if (container.Usage.TryGetValue("memory", out var mem))
                        {
                            try
                            {
                                totalMemory += KubernetesService.ParseMemory(mem.Value);
                            }
                            catch (Exception memEx)
                            {
                                _logger.LogWarning($"Failed to parse memory for pod {metric.Metadata.Name}: {mem.Value} - {memEx.Message}");
                            }
                        }
                    }
                    
                    podMetric["cpu"] = totalCpu * 1000; // Convert to millicores
                    podMetric["memory"] = totalMemory;
                    metricsDict[key] = podMetric;
                }

                // Enhance pod objects with metrics, plus monitor-cached counts + CPU history.
                var cachedMetrics = _podMonitor.CurrentMetrics;
                var cachedCounts = _podMonitor.CurrentCounts;

                var enhancedPods = pods.Items.Select(pod =>
                {
                    var podKey = $"{pod.Metadata.NamespaceProperty}/{pod.Metadata.Name}";
                    object? metrics = null;

                    // Prefer the monitor's cached metrics (already includes percentages),
                    // fall back to a fresh metrics-server read so things work even when
                    // monitoring is disabled.
                    if (cachedMetrics.TryGetValue(podKey, out var cached))
                    {
                        metrics = new
                        {
                            cpu = cached.Cpu,
                            memory = cached.Memory,
                            cpuPercent = cached.CpuPercent,
                            memoryPercent = cached.MemoryPercent,
                            history = _podMonitor.GetCpuHistoryDownsampled(podKey, 30),
                        };
                    }
                    else if (metricsDict.ContainsKey(podKey))
                    {
                        var podMetrics = metricsDict[podKey];
                        var nodeName = pod.Spec?.NodeName;

                        double? cpuPercent = null;
                        double? memoryPercent = null;

                        if (!string.IsNullOrEmpty(nodeName) && nodeCapacityDict.ContainsKey(nodeName))
                        {
                            var nodeCapacity = nodeCapacityDict[nodeName];

                            if (podMetrics.ContainsKey("cpu") && nodeCapacity.cpuCores > 0)
                            {
                                var podCpuCores = (double)podMetrics["cpu"] / 1000;
                                cpuPercent = Math.Round((podCpuCores / nodeCapacity.cpuCores) * 100, 1);
                            }

                            if (podMetrics.ContainsKey("memory") && nodeCapacity.memoryBytes > 0)
                            {
                                var podMemoryBytes = (double)podMetrics["memory"];
                                memoryPercent = Math.Round((podMemoryBytes / nodeCapacity.memoryBytes) * 100, 1);
                            }
                        }

                        metrics = new
                        {
                            cpu = podMetrics["cpu"],
                            memory = podMetrics["memory"],
                            cpuPercent = cpuPercent,
                            memoryPercent = memoryPercent,
                            history = _podMonitor.GetCpuHistoryDownsampled(podKey, 30),
                        };
                    }

                    object? counts = null;
                    if (cachedCounts.TryGetValue(podKey, out var cnt))
                    {
                        counts = new { error = cnt.Error, warning = cnt.Warning };
                    }

                    return new
                    {
                        metadata = pod.Metadata,
                        spec = pod.Spec,
                        status = pod.Status,
                        metrics = metrics,
                        counts = counts,
                    };
                }).ToList();

                return Ok(enhancedPods);
            }
            catch (Exception metricsEx)
            {
                _logger.LogWarning(metricsEx, "Failed to get pod metrics, returning pods without metrics");
                // If metrics fail, just return pods without metrics
                return Ok(pods.Items);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get pods for namespace {Namespace}", @namespace ?? "all");
            return StatusCode(500, new { error = "Failed to get pods", message = ex.Message });
        }
    }

    [HttpDelete("pods/{namespace}/{name}")]
    public async Task<IActionResult> DeletePod(string @namespace, string name)
    {
        try
        {
            await _kubernetesClient.CoreV1.DeleteNamespacedPodAsync(name, @namespace);
            return Ok(new { message = $"Pod {name} deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete pod {Name} in namespace {Namespace}", name, @namespace);
            return StatusCode(500, new { error = "Failed to delete pod", message = ex.Message });
        }
    }

    [HttpGet("deployments")]
    public async Task<IActionResult> GetDeployments([FromQuery] string? @namespace = null)
    {
        try
        {
            V1DeploymentList deployments;
            if (string.IsNullOrEmpty(@namespace))
            {
                deployments = await _kubernetesClient.AppsV1.ListDeploymentForAllNamespacesAsync();
            }
            else
            {
                deployments = await _kubernetesClient.AppsV1.ListNamespacedDeploymentAsync(@namespace);
            }
            return Ok(deployments.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get deployments for namespace {Namespace}", @namespace ?? "all");
            return StatusCode(500, new { error = "Failed to get deployments", message = ex.Message });
        }
    }

    [HttpPatch("deployments/{namespace}/{name}/scale")]
    public async Task<IActionResult> ScaleDeployment(string @namespace, string name, [FromBody] ScaleRequest request)
    {
        try
        {
            var deployment = await _kubernetesClient.AppsV1.ReadNamespacedDeploymentAsync(name, @namespace);
            deployment.Spec.Replicas = request.Replicas;
            
            await _kubernetesClient.AppsV1.ReplaceNamespacedDeploymentAsync(deployment, name, @namespace);
            return Ok(new { message = $"Deployment {name} scaled to {request.Replicas} replicas" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to scale deployment {Name} in namespace {Namespace}", name, @namespace);
            return StatusCode(500, new { error = "Failed to scale deployment", message = ex.Message });
        }
    }

    [HttpGet("services")]
    public async Task<IActionResult> GetServices([FromQuery] string? @namespace = null)
    {
        try
        {
            V1ServiceList services;
            if (string.IsNullOrEmpty(@namespace))
            {
                services = await _kubernetesClient.CoreV1.ListServiceForAllNamespacesAsync();
            }
            else
            {
                services = await _kubernetesClient.CoreV1.ListNamespacedServiceAsync(@namespace);
            }
            return Ok(services.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get services for namespace {Namespace}", @namespace ?? "all");
            return StatusCode(500, new { error = "Failed to get services", message = ex.Message });
        }
    }

    [HttpGet("namespaces")]
    public async Task<IActionResult> GetNamespaces()
    {
        try
        {
            var namespaces = await _kubernetesClient.CoreV1.ListNamespaceAsync();
            return Ok(namespaces.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get namespaces");
            return StatusCode(500, new { error = "Failed to get namespaces", message = ex.Message });
        }
    }

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents([FromQuery] string? @namespace = null)
    {
        try
        {
            Corev1EventList events;
            if (string.IsNullOrEmpty(@namespace))
            {
                events = await _kubernetesClient.CoreV1.ListEventForAllNamespacesAsync();
            }
            else
            {
                events = await _kubernetesClient.CoreV1.ListNamespacedEventAsync(@namespace);
            }
            return Ok(events.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get events for namespace {Namespace}", @namespace ?? "all");
            return StatusCode(500, new { error = "Failed to get events", message = ex.Message });
        }
    }
}

public record ScaleRequest(int Replicas);
