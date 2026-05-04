using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace KubeDashApi.Common.HealthChecks;

public static class HealthCheckResponseWriter
{
    public static Task Write(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        var payload = new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration.TotalMilliseconds,
            entries = report.Entries.ToDictionary(
                kv => kv.Key,
                kv => new
                {
                    status = kv.Value.Status.ToString(),
                    description = kv.Value.Description,
                    duration = kv.Value.Duration.TotalMilliseconds,
                    error = kv.Value.Exception?.Message,
                }),
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        }));
    }
}
