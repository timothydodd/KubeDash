using KubeDashApi.Hubs;
using KubeDashApi.Common;
using k8s;
using k8s.Models;
using Microsoft.Extensions.Caching.Memory;

namespace KubeDashApi.Services;

public class MessageWorker : BackgroundService
{
    private readonly ILogger<MessageWorker> _logger;
    readonly KubernetesService _kubernetesService;
    readonly IMemoryCache _memoryCache;
    readonly KubernetesDashboardHubService _dashboardHubService;
    private readonly IKubernetes _kubernetesClient;

    public MessageWorker(
        ILogger<MessageWorker> logger,
        KubernetesService kubernetesService,
        IMemoryCache memoryCache,
        KubernetesDashboardHubService dashboardHubService,
        IKubernetes kubernetesClient)
    {
        _logger = logger;
        _kubernetesService = kubernetesService;
        _memoryCache = memoryCache;
        _dashboardHubService = dashboardHubService;
        _kubernetesClient = kubernetesClient;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Kubernetes MessageWorker started");

        // Start watching for Kubernetes events
        _ = Task.Run(async () => await WatchNodes(stoppingToken), stoppingToken);
        _ = Task.Run(async () => await WatchPods(stoppingToken), stoppingToken);
        _ = Task.Run(async () => await WatchEvents(stoppingToken), stoppingToken);

        // Periodically update cluster metrics
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var metrics = await _kubernetesService.GetMetrics();
                _memoryCache.Set(KubernetesService.MetricsCacheKey, metrics, TimeSpan.FromMinutes(1));
                await _dashboardHubService.SendClusterUpdate(Constants.DefaultCluster.Id, metrics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cluster metrics");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task WatchNodes(CancellationToken cancellationToken)
    {
        try
        {
            await _kubernetesService.WatchMetrics(
                onEvent: async (eventType, node) =>
                {
                    _logger.LogInformation($"Node event: {eventType} - {node.Metadata.Name}");
                    await _dashboardHubService.SendNodeUpdate(Constants.DefaultCluster.Id, new { EventType = eventType, Node = node });
                },
                onError: ex => _logger.LogError(ex, "Error watching nodes"),
                onClosed: () => _logger.LogInformation("Node watch closed"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start node watch");
        }
    }

    private async Task WatchPods(CancellationToken cancellationToken)
    {
        try
        {
            var response = await _kubernetesClient.CoreV1.ListPodForAllNamespacesWithHttpMessagesAsync(watch: true);
            response.Watch<V1Pod, V1PodList>(
                onEvent: async (eventType, pod) =>
                {
                    _logger.LogInformation($"Pod event: {eventType} - {pod.Metadata.Name} in {pod.Metadata.NamespaceProperty}");
                    // Send to namespace-specific group
                    await _dashboardHubService.SendPodUpdate(Constants.DefaultCluster.Id, pod.Metadata.NamespaceProperty, new { EventType = eventType, Pod = pod });
                    // Also send to cluster group for general pod updates
                    await _dashboardHubService.SendClusterPodUpdate(Constants.DefaultCluster.Id, new { EventType = eventType, Pod = pod });
                },
                onError: ex => _logger.LogError(ex, "Error watching pods"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start pod watch");
        }
    }

    private async Task WatchEvents(CancellationToken cancellationToken)
    {
        try
        {
            var response = await _kubernetesClient.CoreV1.ListEventForAllNamespacesWithHttpMessagesAsync(watch: true);
            response.Watch<Corev1Event, Corev1EventList>(
                onEvent: async (eventType, k8sEvent) =>
                {
                    _logger.LogInformation($"K8s event: {eventType} - {k8sEvent.Message}");
                    await _dashboardHubService.SendEventUpdate(Constants.DefaultCluster.Id, new { EventType = eventType, Event = k8sEvent });
                },
                onError: ex => _logger.LogError(ex, "Error watching events"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start event watch");
        }
    }
}