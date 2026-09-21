using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SopraPm.Api.Models;
using Xunit;

namespace SopraPm.Api.Tests;

/// <summary>
/// Guards the wire contract the React client depends on: the API must emit the
/// same snake_case keys the FastAPI backend did. These run without a database —
/// they boot the real app and use the serializer options it actually registered,
/// rather than a hand-rolled copy of them.
/// </summary>
public sealed class JsonContractTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly JsonSerializerOptions _options;

    public JsonContractTests(WebApplicationFactory<Program> factory)
    {
        _options = factory.Services
            .GetRequiredService<IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions>>()
            .Value.SerializerOptions;
    }

    [Fact]
    public void Backlog_Item_Serializes_To_Snake_Case()
    {
        var json = JsonSerializer.Serialize(new BacklogItemDto
        {
            Id = 1,
            WbRef = "WB-01",
            StoryPoints = 8,
            PercentDone = 100,
            DevAssigneeId = 3,
            UiuxAssigneeId = 4,
            DataEngAssigneeId = 5,
            TargetDate = "2026-07-20",
        }, _options);

        using var doc = JsonDocument.Parse(json);
        var keys = doc.RootElement.EnumerateObject().Select(p => p.Name).ToList();

        Assert.Contains("wb_ref", keys);
        Assert.Contains("story_points", keys);
        Assert.Contains("percent_done", keys);
        Assert.Contains("dev_assignee_id", keys);
        Assert.Contains("uiux_assignee_id", keys);
        Assert.Contains("data_eng_assignee_id", keys);
        Assert.Contains("target_date", keys);
        Assert.DoesNotContain(keys, k => k.Any(char.IsUpper));
    }

    [Fact]
    public void Login_Response_Uses_Access_Token_Keys()
    {
        var json = JsonSerializer.Serialize(
            new LoginResponse { AccessToken = "t", User = new TeamMemberDto { CapacitySp = 20 } }, _options);

        using var doc = JsonDocument.Parse(json);
        Assert.Equal("t", doc.RootElement.GetProperty("access_token").GetString());
        Assert.Equal("bearer", doc.RootElement.GetProperty("token_type").GetString());
        Assert.Equal(20, doc.RootElement.GetProperty("user").GetProperty("capacity_sp").GetInt32());
    }

    [Fact]
    public void Dashboard_Dictionary_Keys_Are_Left_Verbatim()
    {
        var json = JsonSerializer.Serialize(new DashboardSummaryDto
        {
            TotalSp = 228,
            ByPriority = { ["P1"] = new() { Count = 7 } },
            BySystem = { ["Ecommerce"] = new() { Count = 11 } },
        }, _options);

        using var doc = JsonDocument.Parse(json);
        Assert.Equal(228, doc.RootElement.GetProperty("total_sp").GetInt32());
        // Priority and system names are data, not property names — they must not be mangled.
        Assert.Equal(7, doc.RootElement.GetProperty("by_priority").GetProperty("P1").GetProperty("count").GetInt32());
        Assert.Equal(11, doc.RootElement.GetProperty("by_system").GetProperty("Ecommerce").GetProperty("count").GetInt32());
    }

    [Fact]
    public void Requests_Deserialize_From_Snake_Case()
    {
        var item = JsonSerializer.Deserialize<BacklogItemCreate>(
            """
            {"wb_ref":"WB-99","title":"t","system":"WMS","priority":"P1","quarter":"Q3 2026",
             "story_points":5,"data_eng_assignee_id":9,"percent_done":40}
            """, _options)!;

        Assert.Equal("WB-99", item.WbRef);
        Assert.Equal(5, item.StoryPoints);
        Assert.Equal(9, item.DataEngAssigneeId);
        Assert.Equal(40, item.PercentDone);
    }
}
