using PortsideApi.Data.Models;
using PortsideApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RoboDodd.OrmLite;

namespace PortsideApi.Controllers;

[Authorize]
[ApiController]
[Route("api/user/preferences")]
public class UserPreferencesController : Controller
{
    private readonly DbConnectionFactory _dbFactory;
    private readonly AuthService _authService;

    public UserPreferencesController(DbConnectionFactory dbFactory, AuthService authService)
    {
        _dbFactory = dbFactory;
        _authService = authService;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = _authService.GetUserIdFromPrincipal(User);
        if (!userId.HasValue) return Unauthorized();

        using var db = _dbFactory.CreateConnection();
        var pref = (await db.SelectAsync<UserPreference>(p => p.UserId == userId.Value)).FirstOrDefault();
        return Content(pref?.PreferencesJson ?? "{}", "application/json");
    }

    [HttpPut]
    public async Task<IActionResult> Put([FromBody] System.Text.Json.JsonElement body)
    {
        var userId = _authService.GetUserIdFromPrincipal(User);
        if (!userId.HasValue) return Unauthorized();

        var json = body.GetRawText();
        if (string.IsNullOrWhiteSpace(json)) json = "{}";

        // Cap payload to avoid unbounded growth
        if (json.Length > 64 * 1024)
            return BadRequest(new { Error = "Preferences payload too large" });

        using var db = _dbFactory.CreateConnection();
        var existing = (await db.SelectAsync<UserPreference>(p => p.UserId == userId.Value)).FirstOrDefault();
        if (existing == null)
        {
            await db.InsertAsync(new UserPreference
            {
                UserId = userId.Value,
                PreferencesJson = json,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.PreferencesJson = json;
            existing.UpdatedAt = DateTime.UtcNow;
            await db.UpdateAsync(existing);
        }

        return Content(json, "application/json");
    }
}
