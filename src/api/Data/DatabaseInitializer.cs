using PortsideApi.Data.Models;
using PortsideApi.Services;
using RoboDodd.OrmLite;

namespace PortsideApi.Data;

public class DatabaseInitializer
{
    private readonly DbConnectionFactory _dbFactory;
    private readonly PasswordService _passwordService;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(DbConnectionFactory dbFactory, PasswordService passwordService, ILogger<DatabaseInitializer> logger)
    {
        _dbFactory = dbFactory;
        _passwordService = passwordService;
        _logger = logger;
    }

    public void CreateTable()
    {
        using var db = _dbFactory.CreateConnection();

        if (db.CreateTableIfNotExists<User>(true))
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                UserName = "admin",
                PasswordHash = "",
                TimeStamp = DateTime.UtcNow
            };
            user.PasswordHash = _passwordService.HashPassword(user, "admin");
            db.Insert(user);
            _logger.LogInformation("Seeded default admin user (username: admin / password: admin)");
        }
        db.CreateTableIfNotExists<RefreshToken>(true);
        db.CreateTableIfNotExists<UserPreference>(true);
    }
}
