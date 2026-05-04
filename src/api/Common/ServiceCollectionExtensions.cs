using System.IO.Compression;
using k8s;
using KubeDashApi.Common;
using KubeDashApi.Hubs;
using KubeDashApi.Services;
using KubeDashApi.Services.Interfaces;
using Microsoft.AspNetCore.ResponseCompression;

public static class ServiceCollectionExtensions
{

    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration config, ILogger logger)
    {
        var origins = config.GetValue<string>("AllowedOrigins")?.Split(',');
        services.AddCors(options =>
        {
            options.AddPolicy("Origins", policy =>
            {
                if (origins is not null)
                {
                    logger.LogInformation("CORS policy set to allow origins: {origins}", string.Join(", ", origins));
                    policy.WithOrigins(origins)
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .SetIsOriginAllowed(_ => true)
                          .AllowCredentials();
                }
                else
                {
                    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
                }
            });
        });
        return services;
    }
    public static IServiceCollection AddBackgroundServices(this IServiceCollection services)
    {
        services.AddHostedService<MessageWorker>();
        return services;
    }
    public static IServiceCollection AddCompressionAndCaching(this IServiceCollection services)
    {
        services.AddRequestDecompression();
        services.AddResponseCaching();
        services.AddResponseCompression(options =>
        {
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
            {
            "application/json"
        });
        });
        services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

        services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Optimal);

        return services;
    }
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration config)
    {
        // Kubernetes configuration
        var kconfig = KubernetesClientConfiguration.BuildDefaultConfig();
        services.AddSingleton<IKubernetes>(sp => new Kubernetes(kconfig));

        // Service registrations
        services.AddSingleton<KubernetesService>();
        services.AddSingleton<IKubernetesService>(provider => provider.GetRequiredService<KubernetesService>());

        services.AddSingleton<TimedCache>();
        services.AddSingleton<KubernetesDashboardHubService>();

        services.AddLogging(logging =>
        {
            logging.AddSimpleConsole(c =>
            {
                c.SingleLine = true;
                c.IncludeScopes = false;
                c.TimestampFormat = "HH:mm:ss ";
            });
        });

        return services;

    }
}
