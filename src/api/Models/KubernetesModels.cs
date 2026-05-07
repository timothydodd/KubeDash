namespace PortsideApi.Models;

public class Cluster
{
    public double CpuUsage { get; set; }
    public double MemoryUsage { get; set; }
    public double CpuTotal { get; set; }
    public double MemoryTotal { get; set; }
    public double CpuPercentage { get; set; }
    public double MemoryPercentage { get; set; }
    public List<NodeStats> Nodes { get; set; } = new List<NodeStats>();
}

public class NodeStats
{
    public required string Name { get; set; }
    public double? CpuTotal { get; set; }
    public double? MemoryTotal { get; set; }
    public double? MemoryUsage { get; set; }
    public double? MemoryPercentage { get; set; }
    public double CpuLoad { get; set; }
    public double CpuPercentage { get; set; }
}