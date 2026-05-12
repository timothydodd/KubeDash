using RoboDodd.OrmLite;

namespace PortsideApi.Data.Models;

public class SystemSetting
{
    [PrimaryKey]
    public string Key { get; set; } = string.Empty;

    public string ValueJson { get; set; } = "{}";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
