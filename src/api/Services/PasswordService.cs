using PortsideApi.Data.Models;
using Microsoft.AspNetCore.Identity;

namespace PortsideApi.Services;

public class PasswordService
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public string HashPassword(User user, string password)
        => _passwordHasher.HashPassword(user, password);

    public bool VerifyPassword(User user, string password)
        => _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password) == PasswordVerificationResult.Success;
}
