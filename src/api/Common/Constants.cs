using System.Text.Json;

namespace PortsideApi.Common;

public class Constants
{
    public static JsonSerializerOptions JsonOptions = new JsonSerializerOptions() 
    { 
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static class CacheKeys
    {
        public const string Nodes = "k8s_nodes";
        public const string Metrics = "k8s_metrics";
        public const string Pods = "k8s_pods";
        public const string Deployments = "k8s_deployments";
        public const string Services = "k8s_services";
        public const string Namespaces = "k8s_namespaces";
        public const string Events = "k8s_events";
    }

    public static class DefaultCluster
    {
        public const string Id = "default";
        public const string Name = "Default Cluster";
    }
}
