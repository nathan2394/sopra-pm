using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;
using static SopraPm.Api.Data.RowHelpers;

namespace SopraPm.Api.Endpoints;

public static class TeamEndpoints
{
    public static RouteGroupBuilder MapTeamEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/team", async (Db db) =>
        {
            var rows = await db.FetchAllAsync<TeamMemberRow>("SELECT * FROM dbo.TeamMembers ORDER BY Id");
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/team", async (TeamMemberCreate data, Db db) =>
        {
            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.TeamMembers (Name, Role, Email, Areas, Rules, CapacitySp, AvatarColor)
                VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6)
                """,
                SqlParams.Positional(data.Name, data.Role, data.Email, CsvJoin(data.Areas),
                    data.Rules, data.CapacitySp, data.AvatarColor));

            var row = await FetchMemberAsync(db, newId);
            return row.ToDto();
        });

        api.MapGet("/team/{memberId:int}", async (int memberId, Db db) =>
            (await FetchMemberAsync(db, memberId)).ToDto());

        api.MapPatch("/team/{memberId:int}", async (int memberId, TeamMemberUpdate data, Db db) =>
        {
            var fields = new List<string>();
            var values = new List<object?>();

            void Set(string column, object? value)
            {
                if (value is null) return;
                fields.Add($"{column}={SqlParams.Name(values.Count)}");
                values.Add(value);
            }

            Set("Name", data.Name);
            Set("Role", data.Role);
            Set("Email", data.Email);
            Set("Rules", data.Rules);
            Set("CapacitySp", data.CapacitySp);
            Set("AvatarColor", data.AvatarColor);
            // Set() skips nulls, but clearing Areas is a real operation, so append
            // it directly. A plain null is what Dapper wants for SQL NULL.
            if (data.Areas is not null)
            {
                fields.Add($"Areas={SqlParams.Name(values.Count)}");
                values.Add(CsvJoin(data.Areas));
            }

            if (fields.Count > 0)
            {
                values.Add(memberId);
                var affected = await db.ExecuteAsync(
                    $"UPDATE dbo.TeamMembers SET {string.Join(", ", fields)} WHERE Id={SqlParams.Name(values.Count - 1)}",
                    SqlParams.Positional(values));
                if (affected == 0) throw ApiException.NotFound("Team member not found");
            }

            return (await FetchMemberAsync(db, memberId)).ToDto();
        });

        api.MapDelete("/team/{memberId:int}", async (int memberId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.TeamMembers WHERE Id=@p0", SqlParams.Positional(memberId));
            if (affected == 0) throw ApiException.NotFound("Team member not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }

    private static async Task<TeamMemberRow> FetchMemberAsync(Db db, int memberId) =>
        await db.FetchOneAsync<TeamMemberRow>(
            "SELECT * FROM dbo.TeamMembers WHERE Id=@p0", SqlParams.Positional(memberId))
        ?? throw ApiException.NotFound("Team member not found");
}
