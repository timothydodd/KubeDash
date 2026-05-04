using System.Security.Cryptography;
using KubeDashApi.Data.Models;
using RoboDodd.OrmLite;

namespace KubeDashApi.Services;

public class RefreshTokenService
{
    private readonly DbConnectionFactory _dbFactory;
    private readonly IConfiguration _configuration;

    public RefreshTokenService(DbConnectionFactory dbFactory, IConfiguration configuration)
    {
        _dbFactory = dbFactory;
        _configuration = configuration;
    }

    public async Task<RefreshToken> CreateRefreshTokenAsync(Guid userId)
    {
        var token = GenerateRefreshToken();
        var expiryDays = _configuration.GetValue<int>("JwtSettings:RefreshTokenExpiryDays", 30);

        var refreshToken = new RefreshToken
        {
            Token = token,
            UserId = userId,
            ExpiryDate = DateTime.UtcNow.AddDays(expiryDays),
            IsRevoked = false,
            CreatedDate = DateTime.UtcNow
        };

        using var db = _dbFactory.CreateConnection();
        refreshToken.Id = (int)await db.InsertAsync(refreshToken, selectIdentity: true);
        return refreshToken;
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token)
    {
        using var db = _dbFactory.CreateConnection();
        return (await db.SelectAsync<RefreshToken>(x => x.Token == token && !x.IsRevoked)).FirstOrDefault();
    }

    public async Task<bool> ValidateRefreshTokenAsync(string token)
    {
        var rt = await GetRefreshTokenAsync(token);
        return rt != null && rt.ExpiryDate > DateTime.UtcNow;
    }

    public async Task RevokeRefreshTokenAsync(string token)
    {
        using var db = _dbFactory.CreateConnection();
        var rt = (await db.SelectAsync<RefreshToken>(x => x.Token == token)).FirstOrDefault();
        if (rt != null)
        {
            rt.IsRevoked = true;
            await db.UpdateAsync(rt);
        }
    }

    public async Task RevokeAllUserRefreshTokensAsync(Guid userId)
    {
        using var db = _dbFactory.CreateConnection();
        var tokens = await db.SelectAsync<RefreshToken>(x => x.UserId == userId && !x.IsRevoked);
        foreach (var t in tokens)
        {
            t.IsRevoked = true;
            await db.UpdateAsync(t);
        }
    }

    public async Task<RefreshToken> RotateRefreshTokenAsync(string oldToken, Guid userId)
    {
        await RevokeRefreshTokenAsync(oldToken);
        return await CreateRefreshTokenAsync(userId);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}
