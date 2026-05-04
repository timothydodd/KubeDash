using k8s;
using k8s.Models;
using KubeDashApi.Models;

namespace KubeDashApi.Services.Interfaces;

public interface IKubernetesService
{
    Task WatchMetrics(Action<WatchEventType, V1Node> onEvent, Action<Exception>? onError = null, Action? onClosed = null);
    Task<Cluster> GetMetrics();
}