using k8s;
using k8s.Models;
using PortsideApi.Models;

namespace PortsideApi.Services.Interfaces;

public interface IKubernetesService
{
    Task WatchMetrics(Action<WatchEventType, V1Node> onEvent, Action<Exception>? onError = null, Action? onClosed = null);
    Task<Cluster> GetMetrics();
}