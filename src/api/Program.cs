using PortsideApi.Common.HealthChecks;
using PortsideApi.Data;
using PortsideApi.Hubs;
using PortsideApi.Middleware;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

namespace PortsideApi;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var config = builder.Configuration;
        ILogger logger = LoggerFactory.Create(b =>
        {
            b.AddSimpleConsole(c =>
            {
                c.SingleLine = true;
                c.IncludeScopes = false;
                c.TimestampFormat = "HH:mm:ss ";
            });
        }).CreateLogger("PreHost");

        builder.Services.AddControllers();
        builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        builder.Services.AddMemoryCache();
        builder.Services.AddHttpLogging(_ => { });
        builder.Services.AddSignalR();

        builder.Services
            .AddCorsPolicy(config, logger)
            .AddBackgroundServices()
            .AddCompressionAndCaching()
            .AddPersistence(config)
            .AddAuth(config)
            .AddAppHealthChecks()
            .AddApplicationServices(config);

        var app = builder.Build();

        using (var scope = app.Services.CreateScope())
        {
            var dbInit = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
            dbInit.CreateTable();
        }

        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseMiddleware<GlobalExceptionMiddleware>();
        }

        app.UseCors("Origins");
        app.UseResponseCaching();
        app.UseResponseCompression();
        app.UseRouting();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseStaticFiles();
        app.UseDefaultFiles();

        app.MapControllers();
        app.MapHub<KubernetesDashboardHub>("/kubernetes-hub");
        app.MapHub<PodLogHub>("/podloghub");

        // Health endpoints (anonymous; safe to expose to load balancers / probes)
        app.MapHealthChecks("/api/health/live", new HealthCheckOptions
        {
            Predicate = _ => false, // liveness ignores all checks; just confirms process responding
            ResponseWriter = HealthCheckResponseWriter.Write,
        }).AllowAnonymous();

        app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
        {
            Predicate = c => c.Tags.Contains("ready"),
            ResponseWriter = HealthCheckResponseWriter.Write,
        }).AllowAnonymous();

        app.MapHealthChecks("/api/health", new HealthCheckOptions
        {
            ResponseWriter = HealthCheckResponseWriter.Write,
        }).AllowAnonymous();

        app.MapFallbackToFile("/index.html");

        app.Run();
    }
}
