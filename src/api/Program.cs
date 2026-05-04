using KubeDashApi.Hubs;
using KubeDashApi.Middleware;

namespace KubeDashApi;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        var config = builder.Configuration;
        var env = builder.Environment;
        ILogger logger = LoggerFactory.Create(builder =>
        {
            builder.AddSimpleConsole(c =>
            {
                c.SingleLine = true;
                c.IncludeScopes = false;
                c.TimestampFormat = "HH:mm:ss ";
            });
        }).CreateLogger("PreHost");


        // Add core services
        builder.Services.AddControllers();
        builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        builder.Services.AddMemoryCache();
        builder.Services.AddHttpLogging(_ => { });
        builder.Services.AddSignalR();

        // Add modular service groups
        builder.Services
            .AddCorsPolicy(config, logger)
            .AddBackgroundServices()
            .AddCompressionAndCaching()
            .AddApplicationServices(config);



        var app = builder.Build();
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseMiddleware<GlobalExceptionMiddleware>();
        }




        // Configure the HTTP request pipeline.

        app.UseCors("Origins");
        app.UseResponseCaching();
        app.UseResponseCompression();
        app.UseRouting();
        //    app.UseAuthorization();
        app.UseStaticFiles();
        app.UseDefaultFiles();

        app.MapControllers();

        app.MapFallbackToFile("/index.html");
        app.MapHub<KubernetesDashboardHub>("/kubernetes-hub");




        app.Run();
    }
}
