using KubeDashApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace KubeDashApi.Hubs;

[Authorize]
public class KubernetesDashboardHub : Hub
{
    private readonly ClusterWatchManager _watchManager;

    public KubernetesDashboardHub(ClusterWatchManager watchManager)
    {
        _watchManager = watchManager;
    }

    public override async Task OnConnectedAsync()
    {
        _watchManager.AddSubscriber();
        await base.OnConnectedAsync();
        await Clients.Caller.SendAsync("Connected", Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _watchManager.RemoveSubscriber();
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SubscribeToCluster(string clusterId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"cluster-{clusterId}");
    }

    public async Task UnsubscribeFromCluster(string clusterId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"cluster-{clusterId}");
    }

    public async Task SubscribeToNamespace(string clusterId, string namespaceName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"cluster-{clusterId}-ns-{namespaceName}");
    }

    public async Task UnsubscribeFromNamespace(string clusterId, string namespaceName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"cluster-{clusterId}-ns-{namespaceName}");
    }
}

public class KubernetesDashboardHubService
{
    private readonly IHubContext<KubernetesDashboardHub> _hubContext;

    public KubernetesDashboardHubService(IHubContext<KubernetesDashboardHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendClusterUpdate(string clusterId, object data)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}").SendAsync("ClusterUpdate", data);
    }

    public async Task SendNamespaceUpdate(string clusterId, string namespaceName, object data)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}-ns-{namespaceName}").SendAsync("NamespaceUpdate", data);
    }

    public async Task SendNodeUpdate(string clusterId, object nodeData)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}").SendAsync("NodeUpdate", nodeData);
    }

    public async Task SendPodUpdate(string clusterId, string namespaceName, object podData)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}-ns-{namespaceName}").SendAsync("PodUpdate", podData);
    }

    public async Task SendClusterPodUpdate(string clusterId, object podData)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}").SendAsync("PodUpdate", podData);
    }

    public async Task SendEventUpdate(string clusterId, object eventData)
    {
        await _hubContext.Clients.Group($"cluster-{clusterId}").SendAsync("EventUpdate", eventData);
    }
}