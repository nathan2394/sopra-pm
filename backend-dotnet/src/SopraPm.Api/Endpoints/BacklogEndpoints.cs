using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

public static class BacklogEndpoints
{
    /// <summary>
    /// Every BacklogItems column plus a count of attached files. File bytes must
    /// never ride along on a list query, so they live in their own table and are
    /// fetched from the attachment endpoints.
    /// </summary>
    internal const string ItemColumns =
        "Id, WbRef, Title, [System], Priority, Quarter, ProjectId, Phase, SprintId, " +
        "DevAssigneeId, QaAssigneeId, UiuxAssigneeId, DataEngAssigneeId, StoryPoints, " +
        "TargetDate, ActualDate, PercentDone, [Status], Notes, Url, CreatedAt, UpdatedAt, " +
        "(SELECT COUNT(*) FROM dbo.BacklogAttachments a WHERE a.ItemId = dbo.BacklogItems.Id) AS AttachmentCount";

    /// <summary>API field -> DB column, for the dynamically built UPDATE.</summary>
    private static readonly Dictionary<string, string> UpdateColumns = new()
    {
        ["wb_ref"] = "WbRef",
        ["title"] = "Title",
        ["system"] = "[System]",
        ["priority"] = "Priority",
        ["quarter"] = "Quarter",
        ["project_id"] = "ProjectId",
        ["phase"] = "Phase",
        ["sprint_id"] = "SprintId",
        ["dev_assignee_id"] = "DevAssigneeId",
        ["qa_assignee_id"] = "QaAssigneeId",
        ["uiux_assignee_id"] = "UiuxAssigneeId",
        ["data_eng_assignee_id"] = "DataEngAssigneeId",
        ["story_points"] = "StoryPoints",
        ["target_date"] = "TargetDate",
        ["actual_date"] = "ActualDate",
        ["percent_done"] = "PercentDone",
        ["status"] = "[Status]",
        ["notes"] = "Notes",
        ["url"] = "Url",
    };

    /// <summary>Fields whose changes are auto-logged to dbo.Activity, in log order.</summary>
    private static readonly (string Key, string Label)[] TrackedFields =
    {
        ("status", "Status"),
        ("priority", "Priority"),
        ("dev_assignee_id", "Dev assignee"),
        ("qa_assignee_id", "QA assignee"),
        ("uiux_assignee_id", "UI/UX assignee"),
        ("data_eng_assignee_id", "AI Engineer assignee"),
        ("sprint_id", "Sprint"),
        ("project_id", "Project"),
        ("phase", "Phase"),
        ("story_points", "Story points"),
        ("percent_done", "% done"),
    };

    public static RouteGroupBuilder MapBacklogEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/backlog", async (
            [FromQuery(Name = "priority")] string? priority,
            [FromQuery(Name = "system")] string? system,
            [FromQuery(Name = "quarter")] string? quarter,
            [FromQuery(Name = "sprint_id")] int? sprintId,
            [FromQuery(Name = "status")] string? status,
            [FromQuery(Name = "dev_assignee_id")] int? devAssigneeId,
            [FromQuery(Name = "qa_assignee_id")] int? qaAssigneeId,
            [FromQuery(Name = "uiux_assignee_id")] int? uiuxAssigneeId,
            [FromQuery(Name = "data_eng_assignee_id")] int? dataEngAssigneeId,
            [FromQuery(Name = "project_id")] int? projectId,
            [FromQuery(Name = "phase")] string? phase,
            Db db) =>
        {
            var where = new List<string>();
            var values = new List<object?>();

            void Filter(string clause, object? value)
            {
                if (value is null or "") return;
                where.Add($"{clause}={SqlParams.Name(values.Count)}");
                values.Add(value);
            }

            Filter("Priority", priority);
            Filter("[System]", system);
            Filter("Quarter", quarter);
            Filter("SprintId", sprintId);
            Filter("[Status]", status);
            Filter("DevAssigneeId", devAssigneeId);
            Filter("QaAssigneeId", qaAssigneeId);
            Filter("UiuxAssigneeId", uiuxAssigneeId);
            Filter("DataEngAssigneeId", dataEngAssigneeId);
            Filter("ProjectId", projectId);
            Filter("Phase", phase);

            var sql = $"SELECT {ItemColumns} FROM dbo.BacklogItems";
            if (where.Count > 0) sql += " WHERE " + string.Join(" AND ", where);
            sql += " ORDER BY Id";

            var rows = await db.FetchAllAsync<BacklogItemRow>(sql, SqlParams.Positional(values));
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapGet("/backlog/next-ref", async (
            [FromQuery(Name = "project_id")] int? projectId, Db db) =>
        {
            var reference = await NextWbRefAsync(db, projectId);
            return new Dictionary<string, string> { ["wb_ref"] = reference };
        });

        api.MapPost("/backlog", async (BacklogItemCreate data, Db db) =>
        {
            // An omitted reference is assigned from the project's own series, so
            // the client never has to guess the next number.
            if (string.IsNullOrWhiteSpace(data.WbRef))
                data.WbRef = await NextWbRefAsync(db, data.ProjectId);

            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.BacklogItems
                    (WbRef, Title, [System], Priority, Quarter, ProjectId, Phase, SprintId,
                     DevAssigneeId, QaAssigneeId, UiuxAssigneeId, DataEngAssigneeId,
                     StoryPoints, TargetDate, ActualDate, PercentDone, [Status], Notes, Url)
                VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14,@p15,@p16,@p17,@p18)
                """,
                SqlParams.Positional(data.WbRef, data.Title, data.System, data.Priority, data.Quarter,
                    data.ProjectId, data.Phase, data.SprintId, data.DevAssigneeId, data.QaAssigneeId,
                    data.UiuxAssigneeId, data.DataEngAssigneeId, data.StoryPoints, data.TargetDate,
                    data.ActualDate, data.PercentDone, data.Status, data.Notes, data.Url));

            return (await FetchItemAsync(db, newId)).ToDto();
        });

        api.MapGet("/backlog/{itemId:int}", async (int itemId, Db db) =>
            (await FetchItemAsync(db, itemId)).ToDto());

        api.MapPatch("/backlog/{itemId:int}", async (
            int itemId,
            [FromQuery(Name = "actor_id")] int? actorId,
            HttpRequest request,
            Db db) =>
        {
            var before = await FetchItemAsync(db, itemId);

            // Read the raw JSON object rather than a typed DTO: a key that is
            // absent must behave differently from a key sent as null (clearing a
            // sprint or an assignee), which is Pydantic's exclude_unset behaviour.
            var body = await request.ReadFromJsonAsync<Dictionary<string, JsonElement>>()
                       ?? new Dictionary<string, JsonElement>();

            var updates = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (var (key, element) in body) updates[key] = ToClrValue(element);

            // Handle status -> Done auto side-effects
            if (updates.TryGetValue("status", out var newStatus) && (newStatus as string) == "Done")
            {
                if (!updates.ContainsKey("percent_done")) updates["percent_done"] = 100;
                if (!updates.ContainsKey("actual_date"))
                    updates["actual_date"] = DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }

            if (updates.Count > 0)
            {
                var fields = new List<string>();
                var values = new List<object?>();
                foreach (var (key, value) in updates)
                {
                    if (!UpdateColumns.TryGetValue(key, out var column)) continue;
                    fields.Add($"{column}={SqlParams.Name(values.Count)}");
                    values.Add(value);
                }

                if (fields.Count > 0)
                {
                    values.Add(itemId);
                    await db.ExecuteAsync(
                        $"UPDATE dbo.BacklogItems SET {string.Join(", ", fields)} WHERE Id={SqlParams.Name(values.Count - 1)}",
                        SqlParams.Positional(values));
                }
            }

            // Auto-log tracked field changes
            foreach (var (key, label) in TrackedFields)
            {
                if (!updates.TryGetValue(key, out var newValue)) continue;

                var oldText = Display(OldValue(before, key));
                var newText = Display(newValue);
                if (oldText == newText) continue;

                await db.ExecuteAsync(
                    """
                    INSERT INTO dbo.Activity (ItemId, Kind, ActorId, [Text], [Field], FromValue, ToValue)
                    VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6)
                    """,
                    SqlParams.Positional(itemId, "change", actorId, $"{label} changed", key,
                        oldText ?? "—", newText ?? "—"));
            }

            return (await FetchItemAsync(db, itemId)).ToDto();
        });

        api.MapDelete("/backlog/{itemId:int}", async (int itemId, Db db) =>
        {
            // Activity FK is ON DELETE CASCADE — no manual cleanup needed
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.BacklogItems WHERE Id=@p0", SqlParams.Positional(itemId));
            if (affected == 0) throw ApiException.NotFound("Item not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }


    /// <summary>
    /// The next free reference in a project's series — "NXC-004" after NXC-003.
    /// The prefix is the project's code (items with no project use "WB"), and the
    /// number continues from the highest one already used, so gaps left by
    /// deleted items are not reused.
    /// </summary>
    internal static async Task<string> NextWbRefAsync(Db db, int? projectId)
    {
        var prefix = "WB";
        if (projectId is not null)
        {
            var code = await db.FetchOneAsync<string>(
                "SELECT Code FROM dbo.Projects WHERE Id=@p0", SqlParams.Positional(projectId));
            if (!string.IsNullOrWhiteSpace(code)) prefix = code.Trim();
        }

        // Only rows whose suffix is purely numeric take part in the numbering;
        // a hand-typed "NXC-draft" must not break the sequence.
        var highest = await db.FetchOneAsync<int?>(
            """
            SELECT MAX(CAST(SUBSTRING(WbRef, LEN(@p0) + 2, 12) AS INT))
              FROM dbo.BacklogItems
             WHERE WbRef LIKE @p0 + '-%'
               AND LEN(WbRef) > LEN(@p0) + 1
               AND SUBSTRING(WbRef, LEN(@p0) + 2, 12) NOT LIKE '%[^0-9]%'
            """,
            SqlParams.Positional(prefix));

        return $"{prefix}-{(highest ?? 0) + 1:000}";
    }

    internal static async Task<BacklogItemRow> FetchItemAsync(Db db, int itemId) =>
        await db.FetchOneAsync<BacklogItemRow>(
            $"SELECT {ItemColumns} FROM dbo.BacklogItems WHERE Id=@p0", SqlParams.Positional(itemId))
        ?? throw ApiException.NotFound("Item not found");

    /// <summary>JSON value -> the CLR value handed to SqlClient (null becomes a SQL NULL).</summary>
    private static object? ToClrValue(JsonElement element) => element.ValueKind switch
    {
        // Dapper maps a plain null to SQL NULL; DBNull.Value makes it throw.
        JsonValueKind.Null or JsonValueKind.Undefined => null,
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Number => element.TryGetInt32(out var i) ? i : element.GetDouble(),
        JsonValueKind.String => element.GetString(),
        _ => element.GetRawText(),
    };

    /// <summary>The pre-update value of a tracked field, read off the snapshot row.</summary>
    private static object? OldValue(BacklogItemRow row, string key) => key switch
    {
        "status" => row.Status,
        "priority" => row.Priority,
        "dev_assignee_id" => row.DevAssigneeId,
        "qa_assignee_id" => row.QaAssigneeId,
        "uiux_assignee_id" => row.UiuxAssigneeId,
        "data_eng_assignee_id" => row.DataEngAssigneeId,
        "sprint_id" => row.SprintId,
        "project_id" => row.ProjectId,
        "phase" => row.Phase,
        "story_points" => row.StoryPoints,
        "percent_done" => row.PercentDone,
        _ => null,
    };

    /// <summary>Renders a tracked value for the activity log; null for "no value".</summary>
    private static string? Display(object? value) => value switch
    {
        null or DBNull => null,
        string s => s,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };
}
