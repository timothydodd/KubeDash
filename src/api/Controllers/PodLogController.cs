using k8s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KubeDashApi.Controllers;

[Authorize]
[ApiController]
[Route("api/log")]
public class PodLogController : ControllerBase
{
    private readonly IKubernetes _kubernetes;
    private readonly ILogger<PodLogController> _logger;

    public PodLogController(IKubernetes kubernetes, ILogger<PodLogController> logger)
    {
        _kubernetes = kubernetes;
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
    public async Task<IActionResult> GetRecentLogs([FromQuery] string @namespace, [FromQuery] string pod, [FromQuery] int tailLines = 500)
    {
        try
        {
            using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                name: pod,
                namespaceParameter: @namespace,
                follow: false,
                timestamps: true,
                tailLines: tailLines);
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
}
