using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Dapper;
using PortsideApi.Data.Models;
using PortsideApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RoboDodd.OrmLite;

namespace PortsideApi.Controllers;

[Authorize]
[ApiController]
[Route("api/auth")]
public class AuthController : Controller
{
    private readonly DbConnectionFactory _dbFactory;
    private readonly AuthService _authService;
    private readonly PasswordService _passwordService;
    private readonly RefreshTokenService _refreshTokenService;
    private readonly IConfiguration _configuration;

    public AuthController(DbConnectionFactory dbFactory, AuthService authService, PasswordService passwordService, RefreshTokenService refreshTokenService, IConfiguration configuration)
    {
        _dbFactory = dbFactory;
        _authService = authService;
        _passwordService = passwordService;
        _refreshTokenService = refreshTokenService;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            using var db = _dbFactory.CreateConnection();
            var user = (await db.QueryAsync<User>("SELECT * FROM User WHERE UserName = @UserName", new { request.UserName })).FirstOrDefault();
            if (user == null || !_authService.ValidateUser(user, request.Password))
                return Unauthorized(new { Error = "Invalid username or password" });

            var token = _authService.GenerateJwtToken(user);
            var refresh = await _refreshTokenService.CreateRefreshTokenAsync(user.Id);

            return Ok(new LoginResponse
            {
                AccessToken = token,
                RefreshToken = refresh.Token,
                ExpiresIn = _configuration.GetValue<int>("JwtSettings:ExpiryMinutes", 60) * 60
            });
        }
        catch
        {
            return StatusCode(500, new { Error = "An error occurred during authentication" });
        }
    }

    [Authorize]
    [HttpGet("user")]
    public async Task<IActionResult> GetUser()
    {
        var userName = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                     ?? User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
        if (userName == null) return Unauthorized();

        using var db = _dbFactory.CreateConnection();
        var user = (await db.QueryAsync<User>("SELECT * FROM User WHERE UserName = @UserName", new { UserName = userName })).FirstOrDefault();
        if (user == null) return NotFound();

        return Ok(new UserResponse { Id = user.Id, UserName = user.UserName });
    }

    [Authorize]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePasswordAsync([FromBody] ChangePasswordRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userName = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                     ?? User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
        if (userName == null) return Unauthorized(new { Error = "User not authenticated" });

        using var db = _dbFactory.CreateConnection();
        var user = (await db.QueryAsync<User>("SELECT * FROM User WHERE UserName = @UserName", new { UserName = userName })).FirstOrDefault();
        if (user == null) return NotFound(new { Error = "User not found" });
        if (!_authService.ValidateUser(user, request.OldPassword))
            return Unauthorized(new { Error = "Current password is incorrect" });

        user.PasswordHash = _passwordService.HashPassword(user, request.NewPassword);
        await db.UpdateAsync(user);
        return Ok(new { Message = "Password changed successfully" });
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var principal = _authService.GetPrincipalFromExpiredToken(request.AccessToken);
        if (principal == null) return BadRequest(new { Error = "Invalid access token" });

        var userId = _authService.GetUserIdFromPrincipal(principal);
        if (!userId.HasValue) return BadRequest(new { Error = "Invalid access token" });

        if (!await _refreshTokenService.ValidateRefreshTokenAsync(request.RefreshToken))
            return Unauthorized(new { Error = "Invalid refresh token" });

        using var db = _dbFactory.CreateConnection();
        var user = (await db.SelectAsync<User>(u => u.Id == userId.Value)).FirstOrDefault();
        if (user == null) return NotFound(new { Error = "User not found" });

        var newRefresh = await _refreshTokenService.RotateRefreshTokenAsync(request.RefreshToken, user.Id);
        var newAccess = _authService.GenerateJwtToken(user);

        return Ok(new LoginResponse
        {
            AccessToken = newAccess,
            RefreshToken = newRefresh.Token,
            ExpiresIn = _configuration.GetValue<int>("JwtSettings:ExpiryMinutes", 60) * 60
        });
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> RevokeToken([FromBody] RevokeTokenRequest request)
    {
        await _refreshTokenService.RevokeRefreshTokenAsync(request.RefreshToken);
        return Ok(new { Message = "Token revoked successfully" });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = _authService.GetUserIdFromPrincipal(User);
        if (userId.HasValue)
            await _refreshTokenService.RevokeAllUserRefreshTokensAsync(userId.Value);
        return Ok(new { Message = "Logged out successfully" });
    }
}

public class LoginRequest
{
    [Required, StringLength(100, MinimumLength = 3)]
    [RegularExpression(@"^[a-zA-Z0-9_@.-]+$")]
    public required string UserName { get; set; }

    [Required, StringLength(256, MinimumLength = 1)]
    public required string Password { get; set; }
}

public class ChangePasswordRequest
{
    [Required, StringLength(256, MinimumLength = 1)]
    public required string OldPassword { get; set; }

    [Required, StringLength(256, MinimumLength = 8)]
    public required string NewPassword { get; set; }
}

public class LoginResponse
{
    public required string AccessToken { get; set; }
    public required string RefreshToken { get; set; }
    public int ExpiresIn { get; set; }
}

public class UserResponse
{
    public Guid Id { get; set; }
    public required string UserName { get; set; }
}

public class RefreshTokenRequest
{
    [Required] public required string AccessToken { get; set; }
    [Required] public required string RefreshToken { get; set; }
}

public class RevokeTokenRequest
{
    [Required] public required string RefreshToken { get; set; }
}
