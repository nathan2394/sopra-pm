using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;
using static SopraPm.Api.Data.RowHelpers;

namespace SopraPm.Api.Endpoints;

public static class ProjectEndpoints
{
    public static RouteGroupBuilder MapProjectEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/projects", async (Db db) =>
        {
            var rows = await db.FetchAllAsync<ProjectRow>("SELECT * FROM dbo.Projects ORDER BY Id");
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/projects", async (ProjectCreate data, Db db) =>
        {
            var newId = await db.InsertReturningIdAsync(
                """
                INSERT INTO dbo.Projects (Name, Code, [Description], [System], OwnerId, Color, [Status])
                VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6)
                """,
                SqlParams.Positional(data.Name, data.Code, data.Description, data.System,
                    data.OwnerId, data.Color, data.Status));

            return (await FetchProjectAsync(db, newId)).ToDto();
        });

        api.MapGet("/projects/{projectId:int}", async (int projectId, Db db) =>
            (await FetchProjectAsync(db, projectId)).ToDto());

        api.MapPatch("/projects/{projectId:int}", async (int projectId, ProjectUpdate data, Db db) =>
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
            Set("Code", data.Code);
            Set("[Description]", data.Description);
            Set("[System]", data.System);
            Set("OwnerId", data.OwnerId);
            Set("Color", data.Color);
            Set("[Status]", data.Status);

            if (fields.Count > 0)
            {
                values.Add(projectId);
                var affected = await db.ExecuteAsync(
                    $"UPDATE dbo.Projects SET {string.Join(", ", fields)} WHERE Id={SqlParams.Name(values.Count - 1)}",
                    SqlParams.Positional(values));
                if (affected == 0) throw ApiException.NotFound("Project not found");
            }

            return (await FetchProjectAsync(db, projectId)).ToDto();
        });

        api.MapDelete("/projects/{projectId:int}", async (int projectId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.Projects WHERE Id=@p0", SqlParams.Positional(projectId));
            if (affected == 0) throw ApiException.NotFound("Project not found");
            // FK ON DELETE SET NULL automatically detaches backlog items
            return Results.Ok(new { ok = true });
        });

        api.MapGet("/projects/{projectId:int}/summary", async (int projectId, Db db) =>
        {
            var project = await FetchProjectAsync(db, projectId);

            var items = await db.FetchAllAsync<BacklogItemRow>(
                $"SELECT {BacklogEndpoints.ItemColumns} FROM dbo.BacklogItems WHERE ProjectId=@p0",
                SqlParams.Positional(projectId));

            var totalSp = items.Sum(i => i.StoryPoints);
            var doneSp = items.Where(i => i.Status == "Done").Sum(i => i.StoryPoints);

            var phases = new Dictionary<string, PhaseSummaryDto>();
            foreach (var item in items)
            {
                var phaseName = string.IsNullOrEmpty(item.Phase) ? "Unphased" : item.Phase;
                if (!phases.TryGetValue(phaseName, out var phase))
                {
                    phase = new PhaseSummaryDto { Phase = phaseName };
                    phases[phaseName] = phase;
                }

                phase.Items += 1;
                phase.TotalSp += item.StoryPoints;
                switch (item.Status)
                {
                    case "Done":
                        phase.DoneSp += item.StoryPoints;
                        phase.Done += 1;
                        break;
                    case "Pending":
                        phase.Pending += 1;
                        break;
                    case "In Progress":
                        phase.InProgress += 1;
                        break;
                    case "In Review":
                        phase.InReview += 1;
                        break;
                    default:
                        phase.Backlog += 1;
                        break;
                }
            }

            var phaseList = phases.Values.OrderBy(p => p.Phase, StringComparer.Ordinal).ToList();
            foreach (var phase in phaseList) phase.CompletionPct = Pct(phase.DoneSp, phase.TotalSp);

            return new ProjectSummaryDto
            {
                Project = project.ToDto(),
                Items = items.Count,
                TotalSp = totalSp,
                DoneSp = doneSp,
                CompletionPct = Pct(doneSp, totalSp),
                Phases = phaseList,
            };
        });

        return api;
    }

    private static async Task<ProjectRow> FetchProjectAsync(Db db, int projectId) =>
        await db.FetchOneAsync<ProjectRow>(
            "SELECT * FROM dbo.Projects WHERE Id=@p0", SqlParams.Positional(projectId))
        ?? throw ApiException.NotFound("Project not found");
}
