using Microsoft.AspNetCore.Mvc;
using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

/// <summary>
/// Tasks: the individual pieces of work under a backlog item, each owned by one
/// team member and carrying its own status and optional blocker note.
/// </summary>
public static class TaskEndpoints
{
    /// <summary>A task is either done or not; the backlog's five statuses are for items.</summary>
    public const string Complete = "Complete";
    public const string Incomplete = "Incomplete";

    /// <summary>
    /// Rows written before migration 007 may still say "Done", "Completed",
    /// "In Progress", ... The live table uses "Completed", so the done-ish
    /// spellings are matched loosely rather than by exact value — otherwise a
    /// finished task reads back as outstanding everywhere it is counted.
    /// </summary>
    private static readonly HashSet<string> DoneSpellings =
        new(StringComparer.OrdinalIgnoreCase) { "Complete", "Completed", "Done", "Closed", "Selesai" };

    public static string Normalize(string? status) =>
        status is not null && DoneSpellings.Contains(status.Trim()) ? Complete : Incomplete;

    private static string? Validate(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        return status is Complete or Incomplete
            ? status
            : throw ApiException.BadRequest("Task status must be 'Complete' or 'Incomplete'");
    }

    public static RouteGroupBuilder MapTaskEndpoints(this RouteGroupBuilder api)
    {
        // One row per task, already carrying its backlog item, project and
        // assignee, so the daily view needs a single round trip rather than one
        // lookup per task.
        api.MapGet("/tasks/daily", async (
            [FromQuery(Name = "date")] string? date,
            [FromQuery(Name = "member_id")] int? memberId,
            [FromQuery(Name = "project_id")] int? projectId,
            [FromQuery(Name = "status")] string? status,
            Db db) =>
        {
            var where = new List<string>();
            var values = new List<object?>();

            void Filter(string clause, object? value)
            {
                if (value is null or "") return;
                where.Add(string.Format(clause, SqlParams.Name(values.Count)));
                values.Add(value);
            }

            // "That day" means the task was created or last touched on it. Tasks
            // predate no other date column, so this is what daily activity is.
            if (!string.IsNullOrWhiteSpace(date))
            {
                where.Add($"(CAST(t.CreatedAt AS DATE) = CAST({SqlParams.Name(values.Count)} AS DATE)" +
                          $" OR CAST(t.UpdatedAt AS DATE) = CAST({SqlParams.Name(values.Count)} AS DATE))");
                values.Add(date);
            }
            Filter("t.AssigneeId = {0}", memberId);
            Filter("b.ProjectId = {0}", projectId);
            Filter("t.[Status] = {0}", status);

            var sql = """
                SELECT t.Id, t.Title, t.BacklogItemId, t.AssigneeId, t.[Status], t.Blocker,
                       t.CreatedAt, t.UpdatedAt,
                       b.WbRef AS ItemWbRef, b.Title AS ItemTitle, b.[Status] AS ItemStatus,
                       b.ProjectId, p.Name AS ProjectName, p.Code AS ProjectCode, p.Color AS ProjectColor,
                       m.Name AS AssigneeName, m.Role AS AssigneeRole, m.AvatarColor AS AssigneeColor
                  FROM dbo.Tasks t
                  INNER JOIN dbo.BacklogItems b ON b.Id = t.BacklogItemId
                  LEFT  JOIN dbo.Projects p     ON p.Id = b.ProjectId
                  LEFT  JOIN dbo.TeamMembers m  ON m.Id = t.AssigneeId
                """;
            if (where.Count > 0) sql += " WHERE " + string.Join(" AND ", where);
            sql += " ORDER BY p.Name, b.WbRef, t.Id";

            var rows = await db.FetchAllAsync<DailyTaskRow>(sql, SqlParams.Positional(values));
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapGet("/backlog/{itemId:int}/tasks", async (int itemId, Db db) =>
        {
            var rows = await db.FetchAllAsync<TaskRow>(
                """
                SELECT Id, Title, BacklogItemId, AssigneeId, [Status], Blocker, CreatedAt, UpdatedAt
                  FROM dbo.Tasks
                 WHERE BacklogItemId=@p0
                 ORDER BY Id
                """,
                SqlParams.Positional(itemId));
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/backlog/{itemId:int}/tasks", async (int itemId, TaskCreate data, Db db) =>
        {
            var title = (data.Title ?? "").Trim();
            if (title.Length == 0) throw ApiException.BadRequest("Task title required");

            // AssigneeId is NOT NULL in the schema, so a task always has an owner.
            if (data.AssigneeId is null) throw ApiException.BadRequest("Task assignee required");

            var item = await db.FetchOneAsync<int?>(
                "SELECT Id FROM dbo.BacklogItems WHERE Id=@p0", SqlParams.Positional(itemId));
            if (item is null) throw ApiException.NotFound("Item not found");

            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.Tasks (Title, BacklogItemId, AssigneeId, [Status], Blocker)
                VALUES (@p0, @p1, @p2, @p3, @p4)
                """,
                SqlParams.Positional(title, itemId, data.AssigneeId,
                    Validate(data.Status) ?? Incomplete,
                    string.IsNullOrWhiteSpace(data.Blocker) ? null : data.Blocker));

            return (await FetchTaskAsync(db, newId)).ToDto();
        });

        api.MapPatch("/tasks/{taskId:int}", async (int taskId, TaskUpdate data, Db db) =>
        {
            var fields = new List<string>();
            var values = new List<object?>();

            void Set(string column, object? value)
            {
                if (value is null) return;
                fields.Add($"{column}={SqlParams.Name(values.Count)}");
                values.Add(value);
            }

            if (data.Title is not null)
            {
                var title = data.Title.Trim();
                if (title.Length == 0) throw ApiException.BadRequest("Task title required");
                Set("Title", title);
            }
            Set("AssigneeId", data.AssigneeId);
            Set("[Status]", Validate(data.Status));

            // Blocker is the one field you clear by sending an empty string.
            if (data.Blocker is not null)
            {
                fields.Add($"Blocker={SqlParams.Name(values.Count)}");
                values.Add(data.Blocker.Trim().Length == 0 ? null : data.Blocker.Trim());
            }

            if (fields.Count > 0)
            {
                // No trigger on this table, so the timestamp is maintained here.
                fields.Add("UpdatedAt=GETDATE()");
                values.Add(taskId);
                var affected = await db.ExecuteAsync(
                    $"UPDATE dbo.Tasks SET {string.Join(", ", fields)} WHERE Id={SqlParams.Name(values.Count - 1)}",
                    SqlParams.Positional(values));
                if (affected == 0) throw ApiException.NotFound("Task not found");
            }

            return (await FetchTaskAsync(db, taskId)).ToDto();
        });

        api.MapDelete("/tasks/{taskId:int}", async (int taskId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.Tasks WHERE Id=@p0", SqlParams.Positional(taskId));
            if (affected == 0) throw ApiException.NotFound("Task not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }

    private static async Task<TaskRow> FetchTaskAsync(Db db, int taskId) =>
        await db.FetchOneAsync<TaskRow>(
            """
            SELECT Id, Title, BacklogItemId, AssigneeId, [Status], Blocker, CreatedAt, UpdatedAt
              FROM dbo.Tasks WHERE Id=@p0
            """,
            SqlParams.Positional(taskId))
        ?? throw ApiException.NotFound("Task not found");
}
