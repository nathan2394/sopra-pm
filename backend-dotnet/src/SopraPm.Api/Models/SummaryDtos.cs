namespace SopraPm.Api.Models;

public sealed class PhaseSummaryDto
{
    public string Phase { get; set; } = "";
    public int Items { get; set; }
    public int TotalSp { get; set; }
    public int DoneSp { get; set; }
    public int Pending { get; set; }
    public int InProgress { get; set; }
    public int InReview { get; set; }
    public int Backlog { get; set; }
    public int Done { get; set; }
    public double CompletionPct { get; set; }
}

public sealed class ProjectSummaryDto
{
    public ProjectDto Project { get; set; } = new();
    public int Items { get; set; }
    public int TotalSp { get; set; }
    public int DoneSp { get; set; }
    public double CompletionPct { get; set; }
    public List<PhaseSummaryDto> Phases { get; set; } = new();
}

public sealed class PriorityBucketDto
{
    public int Count { get; set; }
    public int Sp { get; set; }
    public int DoneSp { get; set; }
}

public sealed class DashboardSummaryDto
{
    public int TotalItems { get; set; }
    public int TotalSp { get; set; }
    public int DoneItems { get; set; }
    public int DoneSp { get; set; }
    public int Pending { get; set; }
    public int InProgress { get; set; }
    public int InReview { get; set; }
    public int Backlog { get; set; }
    public double CompletionPct { get; set; }
    public Dictionary<string, PriorityBucketDto> ByPriority { get; set; } = new();
    public Dictionary<string, PriorityBucketDto> BySystem { get; set; } = new();
}

public sealed class QuarterlyDto
{
    public string Quarter { get; set; } = "";
    public int Items { get; set; }
    public int DoneItems { get; set; }
    public int TotalSp { get; set; }
    public int DoneSp { get; set; }
    public double CompletionPct { get; set; }
}

public sealed class SprintVelocityDto
{
    public int SprintId { get; set; }
    public string Name { get; set; } = "";
    public string Quarter { get; set; } = "";
    public int PlannedSp { get; set; }
    public int CompletedSp { get; set; }
    public int Items { get; set; }
    public string Status { get; set; } = "";
    public int CapacitySp { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
}

public sealed class TeamWorkloadDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public List<string> Areas { get; set; } = new();
    public string? Rules { get; set; }
    public int CapacitySp { get; set; }
    public string? AvatarColor { get; set; }
    /// <summary>Total items this person is on, across every assignee role.</summary>
    public int Items { get; set; }
    public int DevItems { get; set; }
    public int QaItems { get; set; }
    public int AssignedSp { get; set; }
    public int DoneSp { get; set; }
    public int InProgress { get; set; }
    public double CompletionPct { get; set; }
    public double UtilizationPct { get; set; }
}
