using System.Collections.Concurrent;
using k8s;
using Microsoft.AspNetCore.SignalR;
using KubeDashApi.Hubs;

namespace KubeDashApi.Services;

public sealed record PodLogLine(
    long Id,
    string Pod,
    string Namespace,
    string Line,
    string LogLevel,
    DateTime TimeStamp,
    long SequenceNumber);

public sealed class PodLogStreamService : IAsyncDisposable
{
    private readonly IKubernetes _kubernetes;
    private readonly IHubContext<PodLogHub> _hub;
    private readonly ILogger<PodLogStreamService> _logger;
    private readonly ConcurrentDictionary<string, PodStream> _streams = new();
    private long _sequence;

    public PodLogStreamService(IKubernetes kubernetes, IHubContext<PodLogHub> hub, ILogger<PodLogStreamService> logger)
    {
        _kubernetes = kubernetes;
        _hub = hub;
        _logger = logger;
    }

    private static string Key(string ns, string pod) => $"{ns}/{pod}";

    public Task SubscribeAsync(string connectionId, string ns, string pod)
    {
        var key = Key(ns, pod);
        var stream = _streams.GetOrAdd(key, _ => StartPodStream(ns, pod));
        stream.Subscribers.TryAdd(connectionId, 0);
        return Task.CompletedTask;
    }

    public Task UnsubscribeAsync(string connectionId, string ns, string pod)
    {
        var key = Key(ns, pod);
        if (_streams.TryGetValue(key, out var stream))
        {
            stream.Subscribers.TryRemove(connectionId, out _);
            if (stream.Subscribers.IsEmpty)
            {
                stream.Cts.Cancel();
                _streams.TryRemove(key, out _);
            }
        }
        return Task.CompletedTask;
    }

    public void RemoveAllForConnection(string connectionId)
    {
        foreach (var (key, stream) in _streams)
        {
            if (stream.Subscribers.TryRemove(connectionId, out _) && stream.Subscribers.IsEmpty)
            {
                stream.Cts.Cancel();
                _streams.TryRemove(key, out _);
            }
        }
    }

    private PodStream StartPodStream(string ns, string pod)
    {
        var cts = new CancellationTokenSource();
        var stream = new PodStream(cts);

        _ = Task.Run(async () =>
        {
            try
            {
                using var resp = await _kubernetes.CoreV1.ReadNamespacedPodLogWithHttpMessagesAsync(
                    name: pod,
                    namespaceParameter: ns,
                    follow: true,
                    timestamps: true,
                    tailLines: 200,
                    cancellationToken: cts.Token);

                using var reader = new StreamReader(resp.Body);
                string? line;
                while (!cts.IsCancellationRequested && (line = await reader.ReadLineAsync(cts.Token)) != null)
                {
                    var entry = ParseLine(ns, pod, line);
                    var groupName = $"pod-{ns}-{pod}";
                    await _hub.Clients.Group(groupName).SendAsync("ReceiveLog", new[] { entry }, cts.Token);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Pod log stream ended for {Ns}/{Pod}", ns, pod);
            }
            finally
            {
                _streams.TryRemove(Key(ns, pod), out _);
            }
        }, cts.Token);

        return stream;
    }

    private PodLogLine ParseLine(string ns, string pod, string raw)
    {
        var ts = DateTime.UtcNow;
        var content = raw;
        var spaceIdx = raw.IndexOf(' ');
        if (spaceIdx > 0 && DateTime.TryParse(raw.Substring(0, spaceIdx), out var parsed))
        {
            ts = parsed.ToUniversalTime();
            content = raw.Substring(spaceIdx + 1);
        }

        var level = "Information";
        var upper = content.ToUpperInvariant();
        if (upper.Contains("ERROR") || upper.Contains("EXCEPTION") || upper.Contains("FATAL")) level = "Error";
        else if (upper.Contains("WARN")) level = "Warning";
        else if (upper.Contains("DEBUG")) level = "Debug";
        else if (upper.Contains("TRACE")) level = "Trace";

        return new PodLogLine(
            Id: Interlocked.Increment(ref _sequence),
            Pod: pod,
            Namespace: ns,
            Line: content,
            LogLevel: level,
            TimeStamp: ts,
            SequenceNumber: _sequence);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var (_, stream) in _streams)
        {
            stream.Cts.Cancel();
        }
        _streams.Clear();
        await Task.CompletedTask;
    }

    private sealed class PodStream
    {
        public CancellationTokenSource Cts { get; }
        public ConcurrentDictionary<string, byte> Subscribers { get; } = new();
        public PodStream(CancellationTokenSource cts) => Cts = cts;
    }
}
