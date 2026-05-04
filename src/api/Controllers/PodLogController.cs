using k8s;
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
            logLevel = p.Status?.Phase ?? "Unknown"
        });
        return Ok(result);
    }

    [HttpGet("tail")]
    public async Task<IActionResult> GetRecentLogs(
        [FromQuery] string @namespace,
        [FromQuery] string pod,
        [FromQuery] int tailLines = 500,
        [FromQuery] int? sinceSeconds = null)
    {
        try
        {
            using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                name: pod,
                namespaceParameter: @namespace,
                follow: false,
                timestamps: true,
                tailLines: sinceSeconds.HasValue ? null : tailLines,
                sinceSeconds: sinceSeconds);
            using var reader = new StreamReader(resp.Body);
            var text = await reader.ReadToEndAsync();
            return Ok(new { lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries) });
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
            using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                name: pod,
                namespaceParameter: @namespace,
                follow: false,
                timestamps: false,
                sinceSeconds: sinceSeconds);

            using var reader = new StreamReader(resp.Body);
            var text = await reader.ReadToEndAsync();
            int errors = 0, warnings = 0;
            foreach (var line in text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            {
                var u = line.ToUpperInvariant();
                if (u.Contains("ERROR") || u.Contains("EXCEPTION") || u.Contains("FATAL")) errors++;
                else if (u.Contains("WARN")) warnings++;
            }
            var result = new { error = errors, warning = warnings, sinceSeconds };
            _cache.Set(key, result, TimeSpan.FromSeconds(60));
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Log count fetch failed for {Ns}/{Pod}", @namespace, pod);
            return Ok(new { error = 0, warning = 0, sinceSeconds, unavailable = true });
        }
    }
}
