namespace SopraPm.Api.Models;

// Wire shapes. C# properties stay PascalCase; JsonNamingPolicy.SnakeCaseLower
// (configured in Program.cs) renders them as the snake_case keys the frontend
// already consumes — e.g. WbRef -> "wb_ref", CapacitySp -> "capacity_sp".

public sealed class TeamMemberDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Email { get; set; }
    public List<string> Areas { get; set; } = new();
    public string? Rules { get; set; }
    public int CapacitySp { get; set; } = 20;
    public string? AvatarColor { get; set; }
    public string? CreatedAt { get; set; }
}

public sealed class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class LoginResponse
{
    public string AccessToken { get; set; } = "";
    public string TokenType { get; set; } = "bearer";
    public TeamMemberDto User { get; set; } = new();
}

public sealed class TeamMemberCreate
{
    public required string Name { get; set; }
    public required string Role { get; set; }
    public string? Email { get; set; }
    public List<string> Areas { get; set; } = new();
    public string? Rules { get; set; }
    public int CapacitySp { get; set; } = 20;
    public string? AvatarColor { get; set; }
}

public sealed class TeamMemberUpdate
{
    public string? Name { get; set; }
    public string? Role { get; set; }
    public string? Email { get; set; }
    public List<string>? Areas { get; set; }
    public string? Rules { get; set; }
    public int? CapacitySp { get; set; }
    public string? AvatarColor { get; set; }
}

public sealed class SprintDto
{
    public int Id { get; set; }
    public int SprintNumber { get; set; }
    public string Name { get; set; } = "";
    public string Quarter { get; set; } = "";
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public string? Goal { get; set; }
    public string Status { get; set; } = "Planned";
    public int CapacitySp { get; set; } = 30;
    public string? CreatedAt { get; set; }
}

public sealed class SprintCreate
{
    public int SprintNumber { get; set; }
    public required string Name { get; set; }
    public required string Quarter { get; set; }
    public required string StartDate { get; set; }
    public required string EndDate { get; set; }
    public string? Goal { get; set; }
    public string Status { get; set; } = "Planned";
    public int CapacitySp { get; set; } = 30;
}

public sealed class SprintUpdate
{
    public int? SprintNumber { get; set; }
    public string? Name { get; set; }
    public string? Quarter { get; set; }
    public string? StartDate { get; set; }
    public string? EndDate { get; set; }
    public string? Goal { get; set; }
    public string? Status { get; set; }
    public int? CapacitySp { get; set; }
}

public sealed class ProjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string? Description { get; set; }
    public string? System { get; set; }
    public int? OwnerId { get; set; }
    public string Color { get; set; } = "#0033CC";
    public string Status { get; set; } = "Active";
    public string? CreatedAt { get; set; }
}

public sealed class ProjectCreate
{
    public required string Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public string? System { get; set; }
    public int? OwnerId { get; set; }
    public string Color { get; set; } = "#0033CC";
    public string Status { get; set; } = "Active";
}

public sealed class ProjectUpdate
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Description { get; set; }
    public string? System { get; set; }
    public int? OwnerId { get; set; }
    public string? Color { get; set; }
    public string? Status { get; set; }
}

public sealed class BacklogItemDto
{
    public int Id { get; set; }
    public string WbRef { get; set; } = "";
    public string Title { get; set; } = "";
    public string System { get; set; } = "";
    public string Priority { get; set; } = "";
    public string Quarter { get; set; } = "";
    public int? ProjectId { get; set; }
    public string? Phase { get; set; }
    public int? SprintId { get; set; }
    public int? DevAssigneeId { get; set; }
    public int? QaAssigneeId { get; set; }
    public int? UiuxAssigneeId { get; set; }
    public int? DataEngAssigneeId { get; set; }
    public int StoryPoints { get; set; }
    public string? TargetDate { get; set; }
    public string? ActualDate { get; set; }
    public int PercentDone { get; set; }
    public string Status { get; set; } = "Backlog";
    public string? Notes { get; set; }
    public string? Url { get; set; }
    /// <summary>How many files are attached. The files themselves come from
    /// GET /api/backlog/{id}/attachments.</summary>
    public int AttachmentCount { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

public sealed class BacklogItemCreate
{
    /// <summary>Optional: left blank, the server assigns the project's next reference.</summary>
    public string? WbRef { get; set; }
    public required string Title { get; set; }
    public required string System { get; set; }
    public required string Priority { get; set; }
    public required string Quarter { get; set; }
    public int? ProjectId { get; set; }
    public string? Phase { get; set; }
    public int? SprintId { get; set; }
    public int? DevAssigneeId { get; set; }
    public int? QaAssigneeId { get; set; }
    public int? UiuxAssigneeId { get; set; }
    public int? DataEngAssigneeId { get; set; }
    public int StoryPoints { get; set; }
    public string? TargetDate { get; set; }
    public string? ActualDate { get; set; }
    public int PercentDone { get; set; }
    public string Status { get; set; } = "Backlog";
    public string? Notes { get; set; }
    public string? Url { get; set; }
}

// NOTE: there is deliberately no BacklogItemUpdate DTO. PATCH /api/backlog/{id}
// has to tell "key absent" from "key present but null" (clearing a sprint or an
// assignee is a real operation), which is what Pydantic's exclude_unset gave the
// Python version. BacklogEndpoints reads the raw JSON object instead.

public sealed class ActivityDto
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string Kind { get; set; } = "";
    public int? ActorId { get; set; }
    public string? Text { get; set; }
    public string? Field { get; set; }
    public string? FromValue { get; set; }
    public string? ToValue { get; set; }
    public string? CreatedAt { get; set; }
}

public sealed class AttachmentDto
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public string Name { get; set; } = "";
    public string ContentType { get; set; } = "";
    public int Size { get; set; }
    public int? CreatedBy { get; set; }
    public string? CreatedAt { get; set; }
}

public sealed class TaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int BacklogItemId { get; set; }
    public int AssigneeId { get; set; }
    public string Status { get; set; } = "In Progress";
    public string? Blocker { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

public sealed class TaskCreate
{
    public string? Title { get; set; }
    public int? AssigneeId { get; set; }
    public string? Status { get; set; }
    public string? Blocker { get; set; }
}

public sealed class TaskUpdate
{
    public string? Title { get; set; }
    public int? AssigneeId { get; set; }
    public string? Status { get; set; }
    public string? Blocker { get; set; }
}

public sealed class DailyTaskDto
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int BacklogItemId { get; set; }
    public int AssigneeId { get; set; }
    public string Status { get; set; } = "In Progress";
    public string? Blocker { get; set; }
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }

    public string ItemWbRef { get; set; } = "";
    public string ItemTitle { get; set; } = "";
    public string? ItemStatus { get; set; }
    public int? ProjectId { get; set; }
    public string ProjectName { get; set; } = "Unassigned project";
    public string? ProjectCode { get; set; }
    public string? ProjectColor { get; set; }
    public string? AssigneeName { get; set; }
    public string? AssigneeRole { get; set; }
    public string? AssigneeColor { get; set; }
}

public sealed class CommentCreate
{
    public string? Text { get; set; }
    public int? ActorId { get; set; }
}
