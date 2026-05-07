using System.ComponentModel.DataAnnotations;
using RoboDodd.OrmLite;

namespace PortsideApi.Data.Models;

public class RefreshToken
{
    [PrimaryKey]
    [AutoIncrement]
    public int Id { get; set; }

    [Required]
    [StringLength(255)]
    public required string Token { get; set; }

    [Required]
    [RoboDodd.OrmLite.ForeignKey(typeof(User), OnDelete = "CASCADE")]
    public required Guid UserId { get; set; }

    public DateTime ExpiryDate { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedDate { get; set; }
}
