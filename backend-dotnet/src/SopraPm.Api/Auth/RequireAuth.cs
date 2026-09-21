using SopraPm.Api.Data;
using SopraPm.Api.Http;

namespace SopraPm.Api.Auth;

/// <summary>
/// Endpoint filter equivalent of auth.py's get_current_user dependency:
/// resolves the caller's dbo.TeamMembers row from the bearer token and rejects
/// the request with a 401 when it cannot.
/// </summary>
public sealed class RequireAuthFilter : IEndpointFilter
{
    public const string CurrentUserKey = "SopraPm.CurrentUser";

    private readonly AuthService _auth;
    private readonly Db _db;

    public RequireAuthFilter(AuthService auth, Db db)
    {
        _auth = auth;
        _db = db;
    }

    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;

        var token = ReadBearerToken(http);
        if (string.IsNullOrWhiteSpace(token))
            throw ApiException.Unauthorized("Not authenticated");

        var identity = await _auth.DecodeAccessTokenAsync(token);
        var subject = identity.FindFirst("sub")?.Value;
        if (!int.TryParse(subject, out var userId))
            throw ApiException.Unauthorized("Invalid token");

        var row = await _db.FetchOneAsync<TeamMemberRow>(
            "SELECT * FROM dbo.TeamMembers WHERE Id=@p0", SqlParams.Positional(userId));
        if (row is null || string.IsNullOrEmpty(row.PasswordHash))
            throw ApiException.Unauthorized("Account disabled");

        http.Items[CurrentUserKey] = row;
        return await next(context);
    }

    private static string? ReadBearerToken(HttpContext http)
    {
        var header = http.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(header)) return null;

        var parts = header.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || !parts[0].Equals("Bearer", StringComparison.OrdinalIgnoreCase))
            return null;

        return parts[1].Trim();
    }
}

public static class CurrentUserExtensions
{
    /// <summary>The authenticated caller's row. Only valid inside a route guarded by RequireAuthFilter.</summary>
    public static TeamMemberRow CurrentUser(this HttpContext http) =>
        http.Items[RequireAuthFilter.CurrentUserKey] as TeamMemberRow
        ?? throw new InvalidOperationException("No authenticated user on this request.");
}
