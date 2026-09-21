using SopraPm.Api.Auth;
using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth");

        // Open: this is how a caller obtains a token in the first place.
        auth.MapPost("/login", async (LoginRequest data, Db db, AuthService authService) =>
        {
            var row = await db.FetchOneAsync<TeamMemberRow>(
                "SELECT * FROM dbo.TeamMembers WHERE LOWER(Email)=LOWER(@p0)",
                SqlParams.Positional(data.Email));

            if (row is null || !AuthService.VerifyPassword(data.Password, row.PasswordHash))
                throw new ApiException(401, "Invalid email or password");

            return new LoginResponse
            {
                AccessToken = authService.CreateAccessToken(row.Id, row.Email, row.Role),
                User = row.ToDto(),
            };
        });

        auth.MapGet("/me", (HttpContext http) => http.CurrentUser().ToDto())
            .RequireBearer();
    }

    public static void MapPublicEndpoints(this WebApplication app, string apiVersion)
    {
        var pub = app.MapGroup("/api");

        pub.MapGet("/", () => new Dictionary<string, object?>
        {
            ["message"] = "SOPRA PM API",
            ["version"] = apiVersion,
        });

        pub.MapGet("/health", async (Db db) =>
        {
            try
            {
                var version = await db.PingAsync();
                return Results.Json(new Dictionary<string, object?> { ["ok"] = true, ["db"] = version });
            }
            catch (Exception ex)
            {
                return Results.Json(new Dictionary<string, object?> { ["ok"] = false, ["error"] = ex.Message });
            }
        });
    }
}
