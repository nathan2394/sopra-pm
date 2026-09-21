using System.Globalization;
using System.Text.Json.Nodes;
using Xunit;

namespace SopraPm.Api.Tests;

/// <summary>
/// SOPRA PM backend tests — Microsoft SQL Server backend, .NET API.
///
/// Covers: /api/health, team, sprints, projects (+summary, ON DELETE SET NULL),
/// backlog CRUD + filters + auto-activity, comments, activity delete,
/// backlog cascade delete, dashboard aggregates.
///
/// All test records use a WB-TEST prefix and clean up after themselves. The
/// main dataset must not be modified (36 seeded items, 7 projects).
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class SopraPmApiTests : ApiTestBase
{
    public SopraPmApiTests(ApiFixture fixture) : base(fixture) { }

    // ---------------- health ----------------
    [SkippableFact]
    public async Task Health_Reports_SqlServer()
    {
        RequireBackend();
        var data = await GetJsonAsync("health");
        Assert.True(data["ok"]!.GetValue<bool>());
        Assert.Contains("SQL Server", data["db"]!.GetValue<string>());
    }

    // ---------------- team ----------------
    [SkippableFact]
    public async Task Team_List_Returns_Int_Ids_And_Areas_Split()
    {
        RequireBackend();
        var members = await GetArrayAsync("team");
        Assert.NotEmpty(members);
        foreach (var m in members)
        {
            Assert.True(m!["id"]!.GetValue<int>() >= 1);
            Assert.IsType<JsonArray>(m["areas"]);
        }
        Assert.Contains(members, m => m!["areas"]!.AsArray().Count > 1);
    }

    [SkippableFact]
    public async Task Team_Crud_Areas_Join_And_Split()
    {
        RequireBackend();
        var created = await PostAsync("team", new
        {
            name = "TEST_QA_Member",
            role = "QA",
            email = "test@sopra.io",
            areas = new[] { "Nexora", "Internal" },
            capacity_sp = 15,
        });
        Assert.Equal(200, (int)created.StatusCode);

        var member = await ReadAsync(created);
        Assert.Equal(new[] { "Nexora", "Internal" }, member["areas"]!.AsArray().Select(a => a!.GetValue<string>()));
        var id = member["id"]!.GetValue<int>();

        var patched = await PatchAsync($"team/{id}", new { areas = new[] { "Nexora" }, capacity_sp = 22 });
        Assert.Equal(200, (int)patched.StatusCode);
        var updated = await ReadAsync(patched);
        Assert.Equal(new[] { "Nexora" }, updated["areas"]!.AsArray().Select(a => a!.GetValue<string>()));
        Assert.Equal(22, updated["capacity_sp"]!.GetValue<int>());

        Assert.Equal(200, (int)(await Client.DeleteAsync($"team/{id}")).StatusCode);
        Assert.Equal(404, (int)(await Client.GetAsync($"team/{id}")).StatusCode);
    }

    // ---------------- sprints ----------------
    [SkippableFact]
    public async Task Sprints_List_Ordered_By_Sprint_Number()
    {
        RequireBackend();
        var sprints = await GetArrayAsync("sprints");
        Assert.NotEmpty(sprints);
        var numbers = sprints.Select(s => s!["sprint_number"]!.GetValue<int>()).ToList();
        Assert.Equal(numbers.OrderBy(n => n), numbers);
    }

    [SkippableFact]
    public async Task Sprints_Filter_By_Quarter()
    {
        RequireBackend();
        var all = await GetArrayAsync("sprints");
        Skip.If(all.Count == 0, "no sprints seeded");

        var quarter = all[0]!["quarter"]!.GetValue<string>();
        var filtered = await GetArrayAsync($"sprints?quarter={Uri.EscapeDataString(quarter)}");
        Assert.All(filtered, s => Assert.Equal(quarter, s!["quarter"]!.GetValue<string>()));
    }

    // ---------------- projects ----------------
    [SkippableFact]
    public async Task Seven_Projects_Seeded_With_Expected_Codes()
    {
        RequireBackend();
        var projects = await GetArrayAsync("projects");
        var codes = projects.Select(p => p!["code"]?.GetValue<string>()).ToHashSet();
        foreach (var code in new[] { "SCE", "SCR", "HRS", "WMS", "BIM", "TMS", "INT" })
            Assert.Contains(code, codes);
    }

    [SkippableFact]
    public async Task Sce_Project_Summary_Phase_Counts()
    {
        RequireBackend();
        var projects = await GetArrayAsync("projects");
        var sce = projects.First(p => p!["code"]?.GetValue<string>() == "SCE");

        var summary = await GetJsonAsync($"projects/{sce!["id"]!.GetValue<int>()}/summary");
        var phases = summary["phases"]!.AsArray()
            .ToDictionary(p => p!["phase"]!.GetValue<string>(), p => p!["items"]!.GetValue<int>());

        Assert.Equal(1, phases.GetValueOrDefault("Phase 1"));
        Assert.Equal(2, phases.GetValueOrDefault("Phase 2"));
        Assert.Equal(3, phases.GetValueOrDefault("Phase 3"));
    }

    [SkippableFact]
    public async Task Project_Delete_Sets_Backlog_ProjectId_Null()
    {
        RequireBackend();
        var createdProject = await PostAsync("projects",
            new { name = "TEST_ProjDelete", code = "TDL", system = "Internal" });
        Assert.Equal(200, (int)createdProject.StatusCode);
        var projectId = (await ReadAsync(createdProject))["id"]!.GetValue<int>();

        var createdItem = await PostAsync("backlog", new
        {
            wb_ref = "WB-TESTDEL",
            title = "TEST fk detach",
            system = "Internal",
            priority = "P3",
            quarter = "Q1 2026",
            project_id = projectId,
            story_points = 1,
        });
        Assert.Equal(200, (int)createdItem.StatusCode);
        var itemId = (await ReadAsync(createdItem))["id"]!.GetValue<int>();

        // Delete project — FK ON DELETE SET NULL should detach
        Assert.Equal(200, (int)(await Client.DeleteAsync($"projects/{projectId}")).StatusCode);

        var detached = await GetJsonAsync($"backlog/{itemId}");
        Assert.Null(detached["project_id"]?.GetValue<int?>());

        await Client.DeleteAsync($"backlog/{itemId}");
    }

    // ---------------- backlog ----------------
    [SkippableFact]
    public async Task Backlog_36_Items_Seeded()
    {
        RequireBackend();
        Assert.Equal(36, (await GetArrayAsync("backlog")).Count);
    }

    [SkippableTheory]
    [InlineData("priority", "P1")]
    [InlineData("system", "Nexora")]
    [InlineData("status", "Done")]
    [InlineData("quarter", "Q1 2026")]
    [InlineData("phase", "Phase 1")]
    public async Task Backlog_Filters(string key, string value)
    {
        RequireBackend();
        var rows = await GetArrayAsync($"backlog?{key}={Uri.EscapeDataString(value)}");
        Assert.All(rows, row => Assert.Equal(value, row![key]!.GetValue<string>()));
    }

    [SkippableFact]
    public async Task Backlog_Patch_Logs_Activity_And_Status_Done_Sets_Percent()
    {
        RequireBackend();
        var backlogItems = await GetArrayAsync("backlog?status=Backlog");
        Assert.NotEmpty(backlogItems);

        var item = backlogItems[0]!;
        var itemId = item["id"]!.GetValue<int>();
        var originalStatus = item["status"]!.GetValue<string>();
        var originalPriority = item["priority"]!.GetValue<string>();
        var originalPercent = item["percent_done"]!.GetValue<int>();
        var originalActualDate = item["actual_date"]?.GetValue<string>();

        var actorId = (await GetArrayAsync("team"))[0]!["id"]!.GetValue<int>();
        var beforeActivityIds = (await GetArrayAsync($"backlog/{itemId}/activity"))
            .Select(a => a!["id"]!.GetValue<int>()).ToHashSet();

        var newPriority = originalPriority != "P1" ? "P1" : "P2";
        var patched = await PatchAsync($"backlog/{itemId}?actor_id={actorId}",
            new { status = "Done", priority = newPriority });
        Assert.Equal(200, (int)patched.StatusCode);

        var updated = await ReadAsync(patched);
        Assert.Equal("Done", updated["status"]!.GetValue<string>());
        Assert.Equal(100, updated["percent_done"]!.GetValue<int>());
        Assert.Equal(DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            updated["actual_date"]!.GetValue<string>());
        Assert.Equal(newPriority, updated["priority"]!.GetValue<string>());

        var afterActivity = await GetArrayAsync($"backlog/{itemId}/activity");
        var added = afterActivity
            .Where(a => a!["kind"]!.GetValue<string>() == "change")
            .Where(a => !beforeActivityIds.Contains(a!["id"]!.GetValue<int>()))
            .ToList();
        Assert.True(added.Count >= 2, "expected at least a status and a priority change row");

        var fields = added.Select(a => a!["field"]!.GetValue<string>()).ToHashSet();
        Assert.Contains("status", fields);
        Assert.Contains("priority", fields);

        // newest-first
        var ids = afterActivity.Select(a => a!["id"]!.GetValue<int>()).ToList();
        Assert.Equal(ids.OrderByDescending(i => i), ids);

        // Revert
        await PatchAsync($"backlog/{itemId}?actor_id={actorId}", new
        {
            status = originalStatus,
            priority = originalPriority,
            percent_done = originalPercent,
            actual_date = originalActualDate,
        });
    }

    // ---------------- activity / comments ----------------
    [SkippableFact]
    public async Task Comment_Post_Get_Delete_And_Validation()
    {
        RequireBackend();
        var itemId = (await GetArrayAsync("backlog"))[0]!["id"]!.GetValue<int>();

        // empty text -> 400
        Assert.Equal(400, (int)(await PostAsync($"backlog/{itemId}/comments", new { text = "   " })).StatusCode);

        // missing item -> 404
        Assert.Equal(404, (int)(await PostAsync("backlog/999999/comments", new { text = "hi" })).StatusCode);

        var created = await PostAsync($"backlog/{itemId}/comments", new { text = "TEST comment" });
        Assert.Equal(200, (int)created.StatusCode);
        var comment = await ReadAsync(created);
        Assert.Equal("comment", comment["kind"]!.GetValue<string>());
        Assert.Equal("TEST comment", comment["text"]!.GetValue<string>());

        var commentId = comment["id"]!.GetValue<int>();
        Assert.Equal(200, (int)(await Client.DeleteAsync($"activity/{commentId}")).StatusCode);
        Assert.Equal(404, (int)(await Client.DeleteAsync($"activity/{commentId}")).StatusCode);
    }

    [SkippableFact]
    public async Task Delete_Activity_Rejects_Change_Rows()
    {
        RequireBackend();
        JsonNode? changeRow = null;
        foreach (var item in await GetArrayAsync("backlog"))
        {
            var activity = await GetArrayAsync($"backlog/{item!["id"]!.GetValue<int>()}/activity");
            changeRow = activity.FirstOrDefault(a => a!["kind"]!.GetValue<string>() == "change");
            if (changeRow is not null) break;
        }
        Skip.If(changeRow is null, "no change activity rows to test with");

        var response = await Client.DeleteAsync($"activity/{changeRow!["id"]!.GetValue<int>()}");
        Assert.Equal(404, (int)response.StatusCode);
    }

    [SkippableFact]
    public async Task Backlog_Delete_Cascades_Activity()
    {
        RequireBackend();
        var created = await PostAsync("backlog", new
        {
            wb_ref = "WB-TESTCASCADE",
            title = "TEST cascade",
            system = "Internal",
            priority = "P4",
            quarter = "Q1 2026",
            story_points = 1,
        });
        Assert.Equal(200, (int)created.StatusCode);
        var itemId = (await ReadAsync(created))["id"]!.GetValue<int>();

        await PostAsync($"backlog/{itemId}/comments", new { text = "TEST" });
        Assert.NotEmpty(await GetArrayAsync($"backlog/{itemId}/activity"));

        Assert.Equal(200, (int)(await Client.DeleteAsync($"backlog/{itemId}")).StatusCode);
        Assert.Equal(404, (int)(await Client.GetAsync($"backlog/{itemId}")).StatusCode);
        Assert.Empty(await GetArrayAsync($"backlog/{itemId}/activity"));
    }

    // ---------------- dashboards ----------------
    [SkippableFact]
    public async Task Dashboard_Summary_Totals()
    {
        RequireBackend();
        var summary = await GetJsonAsync("dashboard/summary");
        Assert.Equal(228, summary["total_sp"]!.GetValue<int>());
        Assert.Equal(16, summary["done_sp"]!.GetValue<int>());
        Assert.Equal(7.0, summary["completion_pct"]!.GetValue<double>());
    }

    [SkippableFact]
    public async Task Dashboard_Quarterly_Returns_Four_Quarters()
    {
        RequireBackend();
        Assert.Equal(4, (await GetArrayAsync("dashboard/quarterly")).Count);
    }

    [SkippableFact]
    public async Task Dashboard_Sprint_Velocity_Left_Joins_All_Sprints()
    {
        RequireBackend();
        var velocity = await GetArrayAsync("dashboard/sprint-velocity");
        var sprints = await GetArrayAsync("sprints");
        Assert.Equal(sprints.Count, velocity.Count);
    }

    [SkippableFact]
    public async Task Dashboard_Team_Workload_Sorted_Desc()
    {
        RequireBackend();
        var rows = await GetArrayAsync("dashboard/team-workload");
        var assigned = rows.Select(r => r!["assigned_sp"]!.GetValue<int>()).ToList();
        Assert.Equal(assigned.OrderByDescending(x => x), assigned);
    }
}
