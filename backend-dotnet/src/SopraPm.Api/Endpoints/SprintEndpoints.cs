using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

public static class SprintEndpoints
{
    public static RouteGroupBuilder MapSprintEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/sprints", async (string? quarter, Db db) =>
        {
            var rows = quarter is { Length: > 0 }
                ? await db.FetchAllAsync<SprintRow>(
                    "SELECT * FROM dbo.Sprints WHERE Quarter=@p0 ORDER BY SprintNumber",
                    SqlParams.Positional(quarter))
                : await db.FetchAllAsync<SprintRow>("SELECT * FROM dbo.Sprints ORDER BY SprintNumber");
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/sprints", async (SprintCreate data, Db db) =>
        {
            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.Sprints (SprintNumber, Name, Quarter, StartDate, EndDate, Goal, [Status], CapacitySp)
                VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7)
                """,
                SqlParams.Positional(data.SprintNumber, data.Name, data.Quarter, data.StartDate,
                    data.EndDate, data.Goal, data.Status, data.CapacitySp));

            return (await FetchSprintAsync(db, newId)).ToDto();
        });

        api.MapGet("/sprints/{sprintId:int}", async (int sprintId, Db db) =>
            (await FetchSprintAsync(db, sprintId)).ToDto());

        api.MapPatch("/sprints/{sprintId:int}", async (int sprintId, SprintUpdate data, Db db) =>
        {
            var fields = new List<string>();
            var values = new List<object?>();

            void Set(string column, object? value)
            {
                if (value is null) return;
                fields.Add($"{column}={SqlParams.Name(values.Count)}");
                values.Add(value);
            }

            Set("SprintNumber", data.SprintNumber);
            Set("Name", data.Name);
            Set("Quarter", data.Quarter);
            Set("StartDate", data.StartDate);
            Set("EndDate", data.EndDate);
            Set("Goal", data.Goal);
            Set("[Status]", data.Status);
            Set("CapacitySp", data.CapacitySp);

            if (fields.Count > 0)
            {
                values.Add(sprintId);
                var affected = await db.ExecuteAsync(
                    $"UPDATE dbo.Sprints SET {string.Join(", ", fields)} WHERE Id={SqlParams.Name(values.Count - 1)}",
                    SqlParams.Positional(values));
                if (affected == 0) throw ApiException.NotFound("Sprint not found");
            }

            return (await FetchSprintAsync(db, sprintId)).ToDto();
        });

        api.MapDelete("/sprints/{sprintId:int}", async (int sprintId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.Sprints WHERE Id=@p0", SqlParams.Positional(sprintId));
            if (affected == 0) throw ApiException.NotFound("Sprint not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }

    private static async Task<SprintRow> FetchSprintAsync(Db db, int sprintId) =>
        await db.FetchOneAsync<SprintRow>(
            "SELECT * FROM dbo.Sprints WHERE Id=@p0", SqlParams.Positional(sprintId))
        ?? throw ApiException.NotFound("Sprint not found");
}
