using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using SopraPm.Api.Http;

namespace SopraPm.Api.Auth;

/// <summary>
/// Email + password authentication — the C# counterpart of auth.py.
///
/// Accounts are admin-seeded: there is no self-service signup. An admin sets
/// Email + PasswordHash on a dbo.TeamMembers row (see the SopraPm.Tools CLI),
/// and that person can then log in at POST /api/auth/login to receive a JWT
/// bearer token. Every /api/* route except /api/, /api/health and
/// /api/auth/login requires that token via Authorization: Bearer &lt;token&gt;.
/// </summary>
public sealed class AuthService
{
    private const string Algorithm = SecurityAlgorithms.HmacSha256;

    private readonly SymmetricSecurityKey _key;
    private readonly int _expireMinutes;
    private readonly JsonWebTokenHandler _handler = new();

    public AuthService(IConfiguration cfg)
    {
        var secret = cfg["JWT_SECRET"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            // Fail loud in real deployments — a missing secret must never silently
            // fall back to something guessable.
            throw new InvalidOperationException(
                "JWT_SECRET is not set. Add JWT_SECRET=<a long random string> to backend-dotnet/.env");
        }

        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        _expireMinutes = int.TryParse(cfg["JWT_EXPIRE_MINUTES"], out var m) ? m : 60 * 24 * 7; // 7 days
    }

    // ---------------- Password hashing ----------------
    public static string HashPassword(string plainPassword) =>
        BCrypt.Net.BCrypt.HashPassword(plainPassword);

    public static bool VerifyPassword(string plainPassword, string? passwordHash)
    {
        if (string.IsNullOrEmpty(passwordHash)) return false;
        try
        {
            return BCrypt.Net.BCrypt.Verify(plainPassword, passwordHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }

    // ---------------- JWT ----------------
    public string CreateAccessToken(int subject, string? email, string? role)
    {
        var now = DateTime.UtcNow;
        var claims = new List<Claim> { new Claim("sub", subject.ToString()) };
        if (email is not null) claims.Add(new Claim("email", email));
        if (role is not null) claims.Add(new Claim("role", role));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            IssuedAt = now,
            NotBefore = now,
            Expires = now.AddMinutes(_expireMinutes),
            SigningCredentials = new SigningCredentials(_key, Algorithm),
        };
        return _handler.CreateToken(descriptor);
    }

    /// <summary>Validates a token and returns its claims, or throws a 401 ApiException.</summary>
    public async Task<ClaimsIdentity> DecodeAccessTokenAsync(string token)
    {
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _key,
            ValidAlgorithms = new[] { Algorithm },
            ClockSkew = TimeSpan.Zero, // PyJWT applies no leeway either
        };

        var result = await _handler.ValidateTokenAsync(token, parameters);
        if (!result.IsValid)
        {
            throw result.Exception is SecurityTokenExpiredException
                ? ApiException.Unauthorized("Session expired")
                : ApiException.Unauthorized("Invalid token");
        }
        return result.ClaimsIdentity;
    }
}
