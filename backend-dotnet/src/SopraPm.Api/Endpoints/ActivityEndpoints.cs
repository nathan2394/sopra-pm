using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

public static class ActivityEndpoints
{
    public static RouteGroupBuilder MapActivityEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/backlog/{itemId:int}/activity", async (int itemId, Db db) =>
        {
            var rows = await db.FetchAllAsync<ActivityRow>(
                "SELECT * FROM dbo.Activity WHERE ItemId=@p0 ORDER BY CreatedAt DESC, Id DESC",
                SqlParams.Positional(itemId));
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/backlog/{itemId:int}/comments", async (int itemId, CommentCreate data, Db db) =>
        {
            var exists = await db.FetchOneAsync<int?>(
                "SELECT Id FROM dbo.BacklogItems WHERE Id=@p0", SqlParams.Positional(itemId));
            if (exists is null) throw ApiException.NotFound("Item not found");

            var text = (data.Text ?? "").Trim();
            if (text.Length == 0) throw ApiException.BadRequest("Comment text required");

            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.Activity (ItemId, Kind, ActorId, [Text])
                VALUES (@p0, @p1, @p2, @p3)
                """,
                SqlParams.Positional(itemId, "comment", data.ActorId, text));

            var row = await db.FetchOneAsync<ActivityRow>(
                "SELECT * FROM dbo.Activity WHERE Id=@p0", SqlParams.Positional(newId));
            return row!.ToDto();
        });

        api.MapDelete("/activity/{activityId:int}", async (int activityId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.Activity WHERE Id=@p0 AND Kind='comment'",
                SqlParams.Positional(activityId));
            if (affected == 0) throw ApiException.NotFound("Comment not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }
}
