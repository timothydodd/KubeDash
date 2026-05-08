using RoboDodd.OrmLite;

namespace PortsideApi.Data.Models;

public class UserPreference
{
    [PrimaryKey]
    public Guid UserId { get; set; }

    public string PreferencesJson { get; set; } = "{}";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
