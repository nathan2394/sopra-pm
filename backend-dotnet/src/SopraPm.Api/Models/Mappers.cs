using SopraPm.Api.Data;
using SopraPm.Api.Endpoints;
using static SopraPm.Api.Data.RowHelpers;

namespace SopraPm.Api.Models;

/// <summary>DB row (PascalCase columns) -> API DTO (snake_case JSON).</summary>
public static class Mappers
{
    public static TeamMemberDto ToDto(this TeamMemberRow r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Role = r.Role,
        Email = r.Email,
        Areas = CsvSplit(r.Areas),
        Rules = r.Rules,
        CapacitySp = r.CapacitySp,
        AvatarColor = r.AvatarColor,
        CreatedAt = Iso(r.CreatedAt),
    };

    public static SprintDto ToDto(this SprintRow r) => new()
    {
        Id = r.Id,
        SprintNumber = r.SprintNumber,
        Name = r.Name,
        Quarter = r.Quarter,
        StartDate = IsoDate(r.StartDate)!,
        EndDate = IsoDate(r.EndDate)!,
        Goal = r.Goal,
        Status = r.Status,
        CapacitySp = r.CapacitySp,
        CreatedAt = Iso(r.CreatedAt),
    };

    public static ProjectDto ToDto(this ProjectRow r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Code = r.Code,
        Description = r.Description,
        System = r.System,
        OwnerId = r.OwnerId,
        Color = r.Color,
        Status = r.Status,
        CreatedAt = Iso(r.CreatedAt),
    };

    public static BacklogItemDto ToDto(this BacklogItemRow r) => new()
    {
        Id = r.Id,
        WbRef = r.WbRef,
        Title = r.Title,
        System = r.System,
        Priority = r.Priority,
        Quarter = r.Quarter,
        ProjectId = r.ProjectId,
        Phase = r.Phase,
        SprintId = r.SprintId,
        DevAssigneeId = r.DevAssigneeId,
        QaAssigneeId = r.QaAssigneeId,
        UiuxAssigneeId = r.UiuxAssigneeId,
        DataEngAssigneeId = r.DataEngAssigneeId,
        StoryPoints = r.StoryPoints,
        TargetDate = IsoDate(r.TargetDate),
        ActualDate = IsoDate(r.ActualDate),
        PercentDone = r.PercentDone,
        Status = r.Status,
        Notes = r.Notes,
        Url = r.Url,
        AttachmentCount = r.AttachmentCount,
        CreatedAt = Iso(r.CreatedAt),
        UpdatedAt = Iso(r.UpdatedAt),
    };

    public static AttachmentDto ToDto(this AttachmentMetaRow r) => new()
    {
        Id = r.Id,
        ItemId = r.ItemId,
        Name = r.Name,
        ContentType = r.ContentType,
        Size = r.Size,
        CreatedBy = r.CreatedBy,
        CreatedAt = Iso(r.CreatedAt),
    };

    public static TaskDto ToDto(this TaskRow r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        BacklogItemId = r.BacklogItemId,
        AssigneeId = r.AssigneeId,
        Status = TaskEndpoints.Normalize(r.Status),
        Blocker = r.Blocker,
        CreatedAt = Iso(r.CreatedAt),
        UpdatedAt = Iso(r.UpdatedAt),
    };

    public static DailyTaskDto ToDto(this DailyTaskRow r) => new()
    {
        Id = r.Id,
        Title = r.Title,
        BacklogItemId = r.BacklogItemId,
        AssigneeId = r.AssigneeId,
        Status = TaskEndpoints.Normalize(r.Status),
        Blocker = r.Blocker,
        CreatedAt = Iso(r.CreatedAt),
        UpdatedAt = Iso(r.UpdatedAt),
        ItemWbRef = r.ItemWbRef,
        ItemTitle = r.ItemTitle,
        ItemStatus = r.ItemStatus,
        ProjectId = r.ProjectId,
        // Items outside a project still need a bucket to group under.
        ProjectName = string.IsNullOrWhiteSpace(r.ProjectName) ? "Unassigned project" : r.ProjectName,
        ProjectCode = r.ProjectCode,
        ProjectColor = r.ProjectColor,
        AssigneeName = r.AssigneeName,
        AssigneeRole = r.AssigneeRole,
        AssigneeColor = r.AssigneeColor,
    };

    public static ShippedItemDto ToDto(this ShippedItemRow r) => new()
    {
        Id = r.Id,
        WbRef = r.WbRef,
        Title = r.Title,
        Status = r.Status,
        StoryPoints = r.StoryPoints,
        ActualDate = IsoDate(r.ActualDate),
        ProjectId = r.ProjectId,
        ProjectName = string.IsNullOrWhiteSpace(r.ProjectName) ? "Unassigned project" : r.ProjectName,
        ProjectCode = r.ProjectCode,
        ProjectColor = r.ProjectColor,
    };

    public static ActivityDto ToDto(this ActivityRow r) => new()
    {
        Id = r.Id,
        ItemId = r.ItemId,
        Kind = r.Kind,
        ActorId = r.ActorId,
        Text = r.Text,
        Field = r.Field,
        FromValue = r.FromValue,
        ToValue = r.ToValue,
        CreatedAt = Iso(r.CreatedAt),
    };
}
