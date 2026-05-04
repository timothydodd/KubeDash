using KubeDashApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace KubeDashApi.Hubs;

[Authorize]
public class PodLogHub : Hub
{
    private readonly PodLogStreamService _streams;

    public PodLogHub(PodLogStreamService streams)
    {
        _streams = streams;
    }

    public async Task SubscribeToPod(string namespaceName, string podName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"pod-{namespaceName}-{podName}");
        await _streams.SubscribeAsync(Context.ConnectionId, namespaceName, podName);
    }

    public async Task UnsubscribeFromPod(string namespaceName, string podName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"pod-{namespaceName}-{podName}");
        await _streams.UnsubscribeAsync(Context.ConnectionId, namespaceName, podName);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _streams.RemoveAllForConnection(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
