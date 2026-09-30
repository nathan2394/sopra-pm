using Microsoft.AspNetCore.Mvc;
using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

/// <summary>
/// Management roll-up for a period: the task activity behind it, plus the
/// backlog items that actually landed. Returns the underlying rows rather than
/// only totals, so the page can drill from a number down to the task that
/// produced it without another round trip.
/// </summary>
public static class InsightEndpoints
{
    public static RouteGroupBuilder MapInsightEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/insights/weekly", async (
            [FromQuery(Name = "from")] string? from,
            [FromQuery(Name = "to")] string? to,
            Db db) =>
        {
            if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
                throw ApiException.BadRequest("Both from and to dates are required");

            return await BuildWeeklyAsync(db, from, to);
        });

        return api;
    }

    /// <summary>
    /// The same roll-up, served WITHOUT a bearer token so a manager can open the
    /// report link directly. It is deliberately read-only and exposes nothing
    /// beyond the weekly figures: no emails, no password hashes, no write route.
    ///
    /// Set PUBLIC_REPORT_TOKEN to require ?k=&lt;token&gt; on the link; leave it unset
    /// and the report is open to anyone who has the URL.
    /// </summary>
    public static RouteGroupBuilder MapPublicReportEndpoints(this RouteGroupBuilder pub)
    {
        pub.MapGet("/weekly", async (
            [FromQuery(Name = "from")] string? from,
            [FromQuery(Name = "to")] string? to,
            [FromQuery(Name = "k")] string? key,
            IConfiguration cfg,
            Db db) =>
        {
            var required = cfg["PUBLIC_REPORT_TOKEN"];
            if (!string.IsNullOrWhiteSpace(required) && key != required)
                throw new ApiException(401, "This report link is not valid");

            if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to))
                throw ApiException.BadRequest("Both from and to dates are required");

            return await BuildWeeklyAsync(db, from, to);
        });

        return pub;
    }

    private static async Task<WeeklyInsightDto> BuildWeeklyAsync(Db db, string from, string to)
    {
        var tasks = await db.FetchAllAsync<DailyTaskRow>(
            """
            SELECT t.Id, t.Title, t.BacklogItemId, t.AssigneeId, t.[Status], t.Blocker,
                   t.CreatedAt, t.UpdatedAt,
                   b.WbRef AS ItemWbRef, b.Title AS ItemTitle, b.[Status] AS ItemStatus,
                   b.ProjectId, p.Name AS ProjectName, p.Code AS ProjectCode, p.Color AS ProjectColor,
                   m.Name AS AssigneeName, m.Role AS AssigneeRole, m.AvatarColor AS AssigneeColor
              FROM dbo.Tasks t
              INNER JOIN dbo.BacklogItems b ON b.Id = t.BacklogItemId
              LEFT  JOIN dbo.Projects p     ON p.Id = b.ProjectId
              LEFT  JOIN dbo.TeamMembers m  ON m.Id = t.AssigneeId
             WHERE (CAST(t.CreatedAt AS DATE) BETWEEN CAST(@p0 AS DATE) AND CAST(@p1 AS DATE))
                OR (CAST(t.UpdatedAt AS DATE) BETWEEN CAST(@p0 AS DATE) AND CAST(@p1 AS DATE))
             ORDER BY p.Name, b.WbRef, t.Id
            """,
            SqlParams.Positional(from, to));

        var shipped = await db.FetchAllAsync<ShippedItemRow>(
            """
            SELECT b.Id, b.WbRef, b.Title, b.[Status], b.StoryPoints, b.ActualDate,
                   b.ProjectId, p.Name AS ProjectName, p.Code AS ProjectCode, p.Color AS ProjectColor
              FROM dbo.BacklogItems b
              LEFT JOIN dbo.Projects p ON p.Id = b.ProjectId
             WHERE b.ActualDate BETWEEN CAST(@p0 AS DATE) AND CAST(@p1 AS DATE)
             ORDER BY b.ActualDate, b.WbRef
            """,
            SqlParams.Positional(from, to));

        return new WeeklyInsightDto
        {
            From = from,
            To = to,
            Tasks = tasks.Select(r => r.ToDto()).ToList(),
            ShippedItems = shipped.Select(r => r.ToDto()).ToList(),
        };
    }
}
