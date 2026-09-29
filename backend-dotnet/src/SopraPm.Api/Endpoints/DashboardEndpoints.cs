using SopraPm.Api.Data;
using SopraPm.Api.Models;
using static SopraPm.Api.Data.RowHelpers;

namespace SopraPm.Api.Endpoints;

public static class DashboardEndpoints
{
    public static RouteGroupBuilder MapDashboardEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/dashboard/summary", async (Db db) =>
        {
            var totals = await db.FetchOneAsync<TotalsRow>(
                """
                SELECT
                    COUNT(*) AS TotalItems,
                    ISNULL(SUM(StoryPoints), 0) AS TotalSp,
                    SUM(CASE WHEN [Status]='Done' THEN 1 ELSE 0 END) AS DoneItems,
                    ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS DoneSp,
                    SUM(CASE WHEN [Status]='Pending'     THEN 1 ELSE 0 END) AS Pending,
                    SUM(CASE WHEN [Status]='In Progress' THEN 1 ELSE 0 END) AS InProgress,
                    SUM(CASE WHEN [Status]='In Review'   THEN 1 ELSE 0 END) AS InReview,
                    SUM(CASE WHEN [Status]='Backlog'     THEN 1 ELSE 0 END) AS Backlog
                FROM dbo.BacklogItems
                """) ?? new TotalsRow();

            var priorityRows = await db.FetchAllAsync<BucketRow>(
                """
                SELECT Priority AS Name,
                       COUNT(*) AS Count,
                       ISNULL(SUM(StoryPoints), 0) AS Sp,
                       ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS DoneSp
                  FROM dbo.BacklogItems
                 GROUP BY Priority
                """);

            // Every priority bucket is present even when nothing carries it.
            var byPriority = new Dictionary<string, PriorityBucketDto>
            {
                ["P1"] = new(), ["P2"] = new(), ["P3"] = new(), ["P4"] = new(),
            };
            foreach (var r in priorityRows) byPriority[r.Name] = r.ToBucket();

            var systemRows = await db.FetchAllAsync<BucketRow>(
                """
                SELECT [System] AS Name,
                       COUNT(*) AS Count,
                       ISNULL(SUM(StoryPoints), 0) AS Sp,
                       ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS DoneSp
                  FROM dbo.BacklogItems
                 GROUP BY [System]
                """);

            return new DashboardSummaryDto
            {
                TotalItems = totals.TotalItems,
                TotalSp = totals.TotalSp,
                DoneItems = totals.DoneItems,
                DoneSp = totals.DoneSp,
                Pending = totals.Pending,
                InProgress = totals.InProgress,
                InReview = totals.InReview,
                Backlog = totals.Backlog,
                CompletionPct = Pct(totals.DoneSp, totals.TotalSp),
                ByPriority = byPriority,
                BySystem = systemRows.ToDictionary(r => r.Name, r => r.ToBucket()),
            };
        });

        api.MapGet("/dashboard/quarterly", async (Db db) =>
        {
            var rows = await db.FetchAllAsync<QuarterRow>(
                """
                SELECT Quarter,
                       COUNT(*) AS Items,
                       SUM(CASE WHEN [Status]='Done' THEN 1 ELSE 0 END) AS DoneItems,
                       ISNULL(SUM(StoryPoints), 0) AS TotalSp,
                       ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS DoneSp
                  FROM dbo.BacklogItems
                 GROUP BY Quarter
                 ORDER BY Quarter
                """);

            return rows.Select(r => new QuarterlyDto
            {
                Quarter = r.Quarter,
                Items = r.Items,
                DoneItems = r.DoneItems,
                TotalSp = r.TotalSp,
                DoneSp = r.DoneSp,
                CompletionPct = Pct(r.DoneSp, r.TotalSp),
            }).ToList();
        });

        api.MapGet("/dashboard/sprint-velocity", async (Db db) =>
        {
            var rows = await db.FetchAllAsync<VelocityRow>(
                """
                SELECT s.Id AS SprintId, s.Name, s.Quarter, s.[Status], s.CapacitySp,
                       s.StartDate, s.EndDate,
                       ISNULL(SUM(b.StoryPoints), 0) AS PlannedSp,
                       ISNULL(SUM(CASE WHEN b.[Status]='Done' THEN b.StoryPoints ELSE 0 END), 0) AS CompletedSp,
                       COUNT(b.Id) AS Items
                  FROM dbo.Sprints s
                  LEFT JOIN dbo.BacklogItems b ON b.SprintId = s.Id
                 GROUP BY s.Id, s.Name, s.Quarter, s.[Status], s.CapacitySp, s.StartDate, s.EndDate, s.SprintNumber
                 ORDER BY s.SprintNumber
                """);

            return rows.Select(r => new SprintVelocityDto
            {
                SprintId = r.SprintId,
                Name = r.Name,
                Quarter = r.Quarter,
                PlannedSp = r.PlannedSp,
                CompletedSp = r.CompletedSp,
                Items = r.Items,
                Status = r.Status,
                CapacitySp = r.CapacitySp,
                StartDate = IsoDate(r.StartDate),
                EndDate = IsoDate(r.EndDate),
            }).ToList();
        });

        api.MapGet("/dashboard/team-workload", async (Db db) =>
        {
            // Story points count once for EVERY role assigned to an item, not just
            // the developer: design, UI/UX and AI engineering carry the same load,
            // and plenty of items have no developer at all. UNPIVOTing the four
            // assignee columns credits each assignee the item's full points.
            var rows = await db.FetchAllAsync<WorkloadRow>(
                """
                WITH Assignments AS (
                    SELECT DevAssigneeId     AS MemberId, StoryPoints, [Status], 'dev'  AS Kind FROM dbo.BacklogItems WHERE DevAssigneeId     IS NOT NULL
                    UNION ALL
                    SELECT QaAssigneeId      AS MemberId, StoryPoints, [Status], 'qa'   AS Kind FROM dbo.BacklogItems WHERE QaAssigneeId      IS NOT NULL
                    UNION ALL
                    SELECT UiuxAssigneeId    AS MemberId, StoryPoints, [Status], 'uiux' AS Kind FROM dbo.BacklogItems WHERE UiuxAssigneeId    IS NOT NULL
                    UNION ALL
                    SELECT DataEngAssigneeId AS MemberId, StoryPoints, [Status], 'ai'   AS Kind FROM dbo.BacklogItems WHERE DataEngAssigneeId IS NOT NULL
                )
                SELECT m.Id, m.Name, m.Role, m.Areas, m.Rules, m.CapacitySp, m.AvatarColor,
                       ISNULL(a.Items, 0)      AS Items,
                       ISNULL(a.DevItems, 0)   AS DevItems,
                       ISNULL(a.QaItems, 0)    AS QaItems,
                       ISNULL(a.AssignedSp, 0) AS AssignedSp,
                       ISNULL(a.DoneSp, 0)     AS DoneSp,
                       ISNULL(a.InProgress, 0) AS InProgress
                  FROM dbo.TeamMembers m
                  LEFT JOIN (
                     SELECT MemberId,
                            COUNT(*) AS Items,
                            SUM(CASE WHEN Kind='dev' THEN 1 ELSE 0 END) AS DevItems,
                            SUM(CASE WHEN Kind='qa'  THEN 1 ELSE 0 END) AS QaItems,
                            ISNULL(SUM(StoryPoints), 0) AS AssignedSp,
                            ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS DoneSp,
                            SUM(CASE WHEN [Status]='In Progress' THEN 1 ELSE 0 END) AS InProgress
                       FROM Assignments
                      GROUP BY MemberId
                  ) a ON a.MemberId = m.Id
                """);

            return rows
                .Select(r => new TeamWorkloadDto
                {
                    Id = r.Id,
                    Name = r.Name,
                    Role = r.Role,
                    Areas = CsvSplit(r.Areas),
                    Rules = r.Rules,
                    CapacitySp = r.CapacitySp,
                    AvatarColor = r.AvatarColor,
                    Items = r.Items,
                    DevItems = r.DevItems,
                    QaItems = r.QaItems,
                    AssignedSp = r.AssignedSp,
                    DoneSp = r.DoneSp,
                    InProgress = r.InProgress,
                    CompletionPct = Pct(r.DoneSp, r.AssignedSp),
                    UtilizationPct = Pct(r.AssignedSp, r.CapacitySp),
                })
                .OrderByDescending(x => x.AssignedSp)
                .ToList();
        });

        return api;
    }

    // ---- private row shapes for the aggregate queries ----
    private sealed class TotalsRow
    {
        public int TotalItems { get; init; }
        public int TotalSp { get; init; }
        public int DoneItems { get; init; }
        public int DoneSp { get; init; }
        public int Pending { get; init; }
        public int InProgress { get; init; }
        public int InReview { get; init; }
        public int Backlog { get; init; }
    }

    private sealed class BucketRow
    {
        public string Name { get; init; } = "";
        public int Count { get; init; }
        public int Sp { get; init; }
        public int DoneSp { get; init; }

        public PriorityBucketDto ToBucket() => new() { Count = Count, Sp = Sp, DoneSp = DoneSp };
    }

    private sealed class QuarterRow
    {
        public string Quarter { get; init; } = "";
        public int Items { get; init; }
        public int DoneItems { get; init; }
        public int TotalSp { get; init; }
        public int DoneSp { get; init; }
    }

    private sealed class VelocityRow
    {
        public int SprintId { get; init; }
        public string Name { get; init; } = "";
        public string Quarter { get; init; } = "";
        public string Status { get; init; } = "";
        public int CapacitySp { get; init; }
        public DateTime StartDate { get; init; }
        public DateTime EndDate { get; init; }
        public int PlannedSp { get; init; }
        public int CompletedSp { get; init; }
        public int Items { get; init; }
    }

    private sealed class WorkloadRow
    {
        public int Id { get; init; }
        public string Name { get; init; } = "";
        public string Role { get; init; } = "";
        public string? Areas { get; init; }
        public string? Rules { get; init; }
        public int CapacitySp { get; init; }
        public string? AvatarColor { get; init; }
        public int Items { get; init; }
        public int DevItems { get; init; }
        public int QaItems { get; init; }
        public int AssignedSp { get; init; }
        public int DoneSp { get; init; }
        public int InProgress { get; init; }
    }
}
