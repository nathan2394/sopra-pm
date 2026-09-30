namespace SopraPm.Api.Data;

// Straight mirrors of the dbo.* tables (PascalCase, as the columns are named).
// The API DTOs in Models/ are the snake_case shapes that go over the wire.

public sealed class TeamMemberRow
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public string Role { get; init; } = "";
    public string? Email { get; init; }
    public string? PasswordHash { get; init; }
    public string? Areas { get; init; }
    public string? Rules { get; init; }
    public int CapacitySp { get; init; }
    public string? AvatarColor { get; init; }
    public DateTime? CreatedAt { get; init; }
}

public sealed class SprintRow
{
    public int Id { get; init; }
    public int SprintNumber { get; init; }
    public string Name { get; init; } = "";
    public string Quarter { get; init; } = "";
    public DateTime StartDate { get; init; }
    public DateTime EndDate { get; init; }
    public string? Goal { get; init; }
    public string Status { get; init; } = "Planned";
    public int CapacitySp { get; init; }
    public DateTime? CreatedAt { get; init; }
}

public sealed class ProjectRow
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public string? Code { get; init; }
    public string? Description { get; init; }
    public string? System { get; init; }
    public int? OwnerId { get; init; }
    public string Color { get; init; } = "#0033CC";
    public string Status { get; init; } = "Active";
    public DateTime? CreatedAt { get; init; }
}

public sealed class BacklogItemRow
{
    public int Id { get; init; }
    public string WbRef { get; init; } = "";
    public string Title { get; init; } = "";
    public string System { get; init; } = "";
    public string Priority { get; init; } = "";
    public string Quarter { get; init; } = "";
    public int? ProjectId { get; init; }
    public string? Phase { get; init; }
    public int? SprintId { get; init; }
    public int? DevAssigneeId { get; init; }
    public int? QaAssigneeId { get; init; }
    public int? UiuxAssigneeId { get; init; }
    public int? DataEngAssigneeId { get; init; }
    public int StoryPoints { get; init; }
    public DateTime? TargetDate { get; init; }
    public DateTime? ActualDate { get; init; }
    public int PercentDone { get; init; }
    public string Status { get; init; } = "Backlog";
    public string? Notes { get; init; }
    public string? Url { get; init; }
    public int AttachmentCount { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

public sealed class ActivityRow
{
    public int Id { get; init; }
    public int ItemId { get; init; }
    public string Kind { get; init; } = "";
    public int? ActorId { get; init; }
    public string? Text { get; init; }
    public string? Field { get; init; }
    public string? FromValue { get; init; }
    public string? ToValue { get; init; }
    public DateTime? CreatedAt { get; init; }
}

public sealed class AttachmentMetaRow
{
    public int Id { get; init; }
    public int ItemId { get; init; }
    public string Name { get; init; } = "";
    public string ContentType { get; init; } = "";
    public int Size { get; init; }
    public int? CreatedBy { get; init; }
    public DateTime? CreatedAt { get; init; }
}

public sealed class TaskRow
{
    public int Id { get; init; }
    public string Title { get; init; } = "";
    public int BacklogItemId { get; init; }
    public int AssigneeId { get; init; }
    public string? Status { get; init; }
    public string? Blocker { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

/// <summary>A task with the backlog item, project and assignee it belongs to.</summary>
public sealed class DailyTaskRow
{
    public int Id { get; init; }
    public string Title { get; init; } = "";
    public int BacklogItemId { get; init; }
    public int AssigneeId { get; init; }
    public string? Status { get; init; }
    public string? Blocker { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }

    public string ItemWbRef { get; init; } = "";
    public string ItemTitle { get; init; } = "";
    public string? ItemStatus { get; init; }
    public int? ProjectId { get; init; }
    public string? ProjectName { get; init; }
    public string? ProjectCode { get; init; }
    public string? ProjectColor { get; init; }
    public string? AssigneeName { get; init; }
    public string? AssigneeRole { get; init; }
    public string? AssigneeColor { get; init; }
}

/// <summary>A backlog item that reached its delivery date inside a period.</summary>
public sealed class ShippedItemRow
{
    public int Id { get; init; }
    public string WbRef { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Status { get; init; }
    public int StoryPoints { get; init; }
    public DateTime? ActualDate { get; init; }
    public int? ProjectId { get; init; }
    public string? ProjectName { get; init; }
    public string? ProjectCode { get; init; }
    public string? ProjectColor { get; init; }
}
