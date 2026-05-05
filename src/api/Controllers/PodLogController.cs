using k8s;
using KubeDashApi.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace KubeDashApi.Controllers;

[Authorize]
[ApiController]
[Route("api/log")]
public class PodLogController : ControllerBase
{
    private readonly IKubernetes _kubernetes;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PodLogController> _logger;

    public PodLogController(IKubernetes kubernetes, IMemoryCache cache, ILogger<PodLogController> logger)
    {
        _kubernetes = kubernetes;
        _cache = cache;
        _logger = logger;
    }

    [HttpGet("pods")]
    public async Task<IActionResult> GetPods()
    {
        var pods = await _kubernetes.CoreV1.ListPodForAllNamespacesAsync();
        var result = pods.Items.Select(p => new
        {
            name = p.Metadata.Name,
            deployment = p.Metadata.OwnerReferences?.FirstOrDefault()?.Name ?? p.Metadata.Name,
            @namespace = p.Metadata.NamespaceProperty,
            logLevel = p.Status?.Phase ?? "Unknown",
            containers = p.Spec?.Containers?.Select(c => c.Name).ToArray() ?? Array.Empty<string>()
        });
        return Ok(result);
    }

    [HttpGet("tail")]
    public async Task<IActionResult> GetRecentLogs(
        [FromQuery] string @namespace,
        [FromQuery] string pod,
        [FromQuery] string? container = null,
        [FromQuery] int tailLines = 500,
        [FromQuery] int? sinceSeconds = null)
    {
        try
        {
            var containers = container is { Length: > 0 }
                ? new[] { container }
                : await GetContainerNames(@namespace, pod);

            var lines = new List<string>();
            foreach (var c in containers)
            {
                using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                    name: pod,
                    namespaceParameter: @namespace,
                    container: c,
                    follow: false,
                    timestamps: true,
                    tailLines: sinceSeconds.HasValue ? null : tailLines,
                    sinceSeconds: sinceSeconds);
                using var reader = new StreamReader(resp.Body);
                var text = await reader.ReadToEndAsync();
                foreach (var rawLine in text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                {
                    // Preserve "<timestamp> " prefix (frontend strips it for display)
                    // but clean inline level/time/ANSI noise from the message body.
                    var spaceIdx = rawLine.IndexOf(' ');
                    if (spaceIdx > 0)
                    {
                        var ts = rawLine.Substring(0, spaceIdx);
                        var body = LogLineCleaner.Clean(rawLine.Substring(spaceIdx + 1));
                        lines.Add($"{ts} {body}");
                    }
                    else
                    {
                        lines.Add(LogLineCleaner.Clean(rawLine));
                    }
                }
            }
            return Ok(new { lines });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch logs for {Ns}/{Pod}", @namespace, pod);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("counts")]
    public async Task<IActionResult> GetLogCounts(
        [FromQuery] string @namespace,
        [FromQuery] string pod,
        [FromQuery] int sinceSeconds = 86400)
    {
        var key = $"logcounts:{@namespace}/{pod}:{sinceSeconds}";
        if (_cache.TryGetValue(key, out object? cached))
        {
            return Ok(cached);
        }

        try
        {
            var containers = await GetContainerNames(@namespace, pod);
            int errors = 0, warnings = 0;

            foreach (var c in containers)
            {
                try
                {
                    using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                        name: pod,
                        namespaceParameter: @namespace,
                        container: c,
                        follow: false,
                        timestamps: false,
                        sinceSeconds: sinceSeconds);

                    using var reader = new StreamReader(resp.Body);
                    var text = await reader.ReadToEndAsync();
                    foreach (var line in text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                    {
                        var u = line.ToUpperInvariant();
                        if (u.Contains("ERROR") || u.Contains("EXCEPTION") || u.Contains("FATAL")) errors++;
                        else if (u.Contains("WARN")) warnings++;
                    }
                }
                catch (k8s.Autorest.HttpOperationException)
                {
                    // Container may not have logs yet (just-started, init), skip silently.
                }
            }

            var result = new { error = errors, warning = warnings, sinceSeconds };
            _cache.Set(key, result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }
        catch (Exception ex)
        {
            // Cache the unavailable result too so we don't hammer K8s.
            var fallback = new { error = 0, warning = 0, sinceSeconds, unavailable = true };
            _cache.Set(key, fallback, TimeSpan.FromMinutes(5));
            _logger.LogWarning("Log count fetch failed for {Ns}/{Pod}: {Message}", @namespace, pod, ex.Message);
            return Ok(fallback);
        }
    }

    private async Task<string[]> GetContainerNames(string ns, string pod)
    {
        var key = $"containers:{ns}/{pod}";
        if (_cache.TryGetValue(key, out string[]? cached) && cached is not null)
        {
            return cached;
        }
        var p = await _kubernetes.CoreV1.ReadNamespacedPodAsync(pod, ns);
        var names = p.Spec?.Containers?.Select(c => c.Name).ToArray() ?? Array.Empty<string>();
        _cache.Set(key, names, TimeSpan.FromMinutes(5));
        return names;
    }
}
