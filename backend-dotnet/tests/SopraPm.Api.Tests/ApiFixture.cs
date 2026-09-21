using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using SopraPm.Api.Configuration;
using Xunit;

namespace SopraPm.Api.Tests;

/// <summary>
/// Talks to a running SOPRA PM API against a seeded SQL Server — the same
/// contract the pytest suite had, plus the bearer token that every /api/* route
/// now requires.
///
/// Point it somewhere else with SOPRA_PM_BASE_URL / TEST_EMAIL / TEST_PASSWORD.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public HttpClient Client { get; private set; } = null!;
    public string? SkipReason { get; private set; }

    public async Task InitializeAsync()
    {
        DotEnv.LoadNearest();

        var baseUrl = (Environment.GetEnvironmentVariable("SOPRA_PM_BASE_URL")
                       ?? Environment.GetEnvironmentVariable("REACT_APP_BACKEND_URL")
                       ?? "http://localhost:8000").TrimEnd('/');

        Client = new HttpClient { BaseAddress = new Uri(baseUrl + "/api/"), Timeout = TimeSpan.FromSeconds(30) };

        var email = Environment.GetEnvironmentVariable("TEST_EMAIL") ?? "nathan@sopra.com";
        var password = Environment.GetEnvironmentVariable("TEST_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("SEED_DEFAULT_PASSWORD")
                       ?? "SopraPM@2026";

        try
        {
            var response = await Client.PostAsJsonAsync("auth/login", new { email, password });
            if (!response.IsSuccessStatusCode)
            {
                SkipReason = $"Login failed ({(int)response.StatusCode}) for {email} at {baseUrl}.";
                return;
            }

            var body = await response.Content.ReadFromJsonAsync<JsonNode>();
            var token = body?["access_token"]?.GetValue<string>();
            if (string.IsNullOrEmpty(token))
            {
                SkipReason = "Login response carried no access_token.";
                return;
            }

            Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        catch (HttpRequestException ex)
        {
            SkipReason = $"SOPRA PM API not reachable at {baseUrl}: {ex.Message}";
        }
    }

    public Task DisposeAsync()
    {
        Client?.Dispose();
        return Task.CompletedTask;
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "sopra-pm-api";
}

/// <summary>Shared helpers so the tests read like the requests-based originals.</summary>
public abstract class ApiTestBase
{
    private readonly ApiFixture _fixture;

    protected ApiTestBase(ApiFixture fixture) => _fixture = fixture;

    protected HttpClient Client => _fixture.Client;

    /// <summary>Skips the test when there is no live, seeded backend to talk to.</summary>
    protected void RequireBackend()
    {
        Skip.If(_fixture.SkipReason is not null, _fixture.SkipReason ?? "");
    }

    protected async Task<JsonNode> GetJsonAsync(string path)
    {
        var response = await Client.GetAsync(path);
        Assert.Equal(200, (int)response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonNode>())!;
    }

    protected async Task<JsonArray> GetArrayAsync(string path) => (await GetJsonAsync(path)).AsArray();

    protected Task<HttpResponseMessage> PostAsync(string path, object body) =>
        Client.PostAsJsonAsync(path, body);

    protected Task<HttpResponseMessage> PatchAsync(string path, object body) =>
        Client.PatchAsJsonAsync(path, body);

    protected static async Task<JsonNode> ReadAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonNode>())!;
}
