using k8s;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace KubeDashApi.Common.HealthChecks;

public sealed class KubernetesHealthCheck : IHealthCheck
{
    private readonly IKubernetes _kubernetes;

    public KubernetesHealthCheck(IKubernetes kubernetes) => _kubernetes = kubernetes;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var version = await _kubernetes.Version.GetCodeAsync(cancellationToken);
            return HealthCheckResult.Healthy($"Kubernetes API reachable (v{version.GitVersion})");
        }
        catch (Exception ex)
        {
            // Don't fail the whole app if K8s is briefly unreachable; report Degraded.
            return HealthCheckResult.Degraded("Kubernetes API unreachable", ex);
        }
    }
}
