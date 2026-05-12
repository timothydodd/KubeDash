using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortsideApi.Services;

namespace PortsideApi.Controllers;

[Authorize]
[ApiController]
[Route("api/monitor")]
public class MonitorSettingsController : ControllerBase
{
    private readonly MonitorSettingsService _settings;
    private readonly PodMonitorService _monitor;

    public MonitorSettingsController(MonitorSettingsService settings, PodMonitorService monitor)
    {
        _settings = settings;
        _monitor = monitor;
    }

    [HttpGet("settings")]
    public IActionResult GetSettings() => Ok(_settings.Get());

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] MonitorSettings settings)
    {
        if (settings == null) return BadRequest(new { error = "Invalid settings body" });
        var saved = await _settings.Save(settings);
        return Ok(saved);
    }

    [HttpGet("counts")]
    public IActionResult GetCounts()
    {
        var snapshot = _monitor.CurrentCounts.ToDictionary(
            kv => kv.Key,
            kv => new { error = kv.Value.Error, warning = kv.Value.Warning, updatedAt = kv.Value.UpdatedAt });
        return Ok(snapshot);
    }

    [HttpGet("metrics")]
    public IActionResult GetMetricsSnapshot()
    {
        var snapshot = _monitor.CurrentMetrics.ToDictionary(
            kv => kv.Key,
            kv => new
            {
                cpu = kv.Value.Cpu,
                memory = kv.Value.Memory,
                cpuPercent = kv.Value.CpuPercent,
                memoryPercent = kv.Value.MemoryPercent,
                updatedAt = kv.Value.UpdatedAt,
            });
        return Ok(snapshot);
    }
}
