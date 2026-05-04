using Microsoft.Extensions.Diagnostics.HealthChecks;
using RoboDodd.OrmLite;

namespace KubeDashApi.Common.HealthChecks;

public sealed class SqliteHealthCheck : IHealthCheck
{
    private readonly DbConnectionFactory _dbFactory;

    public SqliteHealthCheck(DbConnectionFactory dbFactory) => _dbFactory = dbFactory;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var db = _dbFactory.CreateConnection();
            if (db is System.Data.Common.DbConnection async)
            {
                await async.OpenAsync(cancellationToken);
            }
            else
            {
                db.Open();
            }
            return HealthCheckResult.Healthy("SQLite reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("SQLite unreachable", ex);
        }
    }
}
