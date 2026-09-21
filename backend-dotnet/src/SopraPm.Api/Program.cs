using System.Text.Json;
using System.Text.Json.Serialization;
using SopraPm.Api.Auth;
using SopraPm.Api.Configuration;
using SopraPm.Api.Data;
using SopraPm.Api.Endpoints;
using SopraPm.Api.Http;
using Microsoft.OpenApi.Models;
using Serilog;

const string ApiVersion = "2.0-mssql";
const string CorsPolicy = "SopraPmCors";

// The .env file is read before configuration is built, so MSSQL_*/JWT_* land in
// the environment provider exactly as the Python backend's load_dotenv did.
DotEnv.LoadNearest();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

// Serilog, configured from the "Serilog" section of appsettings.json: console
// plus a daily rolling file under logs/, the same arrangement sopra-nexus-api uses.
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // WbRef -> "wb_ref", CapacitySp -> "capacity_sp", ... on the way out *and* in.
    ApplyJsonContract(options.SerializerOptions);
});

// Swashbuckle reads MVC's JsonOptions, not the minimal-API ones above, so it
// has to be told the same contract or the generated OpenAPI document advertises
// camelCase names the API never emits.
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
    ApplyJsonContract(options.JsonSerializerOptions));

builder.Services.AddSingleton(sp =>
    new Db(Db.BuildConnectionString(sp.GetRequiredService<IConfiguration>())));
builder.Services.AddSingleton<AuthService>();

builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy =>
{
    var origins = (builder.Configuration["CORS_ORIGINS"] ?? "*")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (origins.Contains("*"))
    {
        // AllowAnyOrigin() and AllowCredentials() are mutually exclusive in
        // ASP.NET Core, so echo the caller's origin instead — which is what
        // Starlette's CORSMiddleware did for allow_origins=["*"] with credentials.
        policy.SetIsOriginAllowed(_ => true);
    }
    else
    {
        policy.WithOrigins(origins);
    }

    policy.AllowAnyMethod().AllowAnyHeader().AllowCredentials();
}));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "SOPRA PM API", Version = ApiVersion });

    c.AddSecurityDefinition(BearerSecurityOperationFilter.SchemeId, new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Call POST /api/auth/login, then paste the access_token here "
                    + "(Swagger adds the \"Bearer \" prefix itself).",
    });
    c.OperationFilter<BearerSecurityOperationFilter>();
});

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors(CorsPolicy);

// On by default in Development. Set SWAGGER_ENABLED=true to expose it on a
// deployed instance — it publishes the whole API surface, so that stays a
// deliberate choice rather than a default.
var swaggerEnabled = app.Configuration.GetValue<bool?>("SWAGGER_ENABLED")
                     ?? app.Environment.IsDevelopment();
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Site root. The API itself lives entirely under /api (as the FastAPI version
// did), so without this "/" is a bare 404 — which reads like a broken deployment
// when you open the host in a browser. Sends you to Swagger when it is on,
// otherwise says plainly where to go.
app.MapGet("/", () => swaggerEnabled
    ? Results.Redirect("/swagger")
    : Results.Json(new Dictionary<string, object?>
    {
        ["message"] = "SOPRA PM API",
        ["version"] = ApiVersion,
        ["api"] = "/api/",
        ["health"] = "/api/health",
    }))
    .ExcludeFromDescription();

// /api/ and /api/health stay open; /api/auth/login is open, /api/auth/me is not.
app.MapPublicEndpoints(ApiVersion);
app.MapAuthEndpoints();

// Every other /api/* route requires a valid bearer token.
var api = app.MapGroup("/api");
api.RequireBearer();
api.MapTeamEndpoints();
api.MapSprintEndpoints();
api.MapProjectEndpoints();
api.MapBacklogEndpoints();
api.MapActivityEndpoints();
api.MapAttachmentEndpoints();
api.MapDashboardEndpoints();

var logger = app.Services.GetRequiredService<ILogger<Program>>();

// Build AuthService now rather than on the first login. It throws when
// JWT_SECRET is missing, and as a lazily-resolved singleton that surfaced as an
// opaque 500 on every authenticated call while the app looked healthy. auth.py
// raised at import time for the same reason: a misconfigured deploy should
// refuse to start, not run half-broken.
try
{
    _ = app.Services.GetRequiredService<AuthService>();
}
catch (Exception ex)
{
    logger.LogCritical("Startup aborted: {Message}", ex.Message);
    throw;
}

try
{
    var version = await app.Services.GetRequiredService<Db>().PingAsync();
    logger.LogInformation("Connected to SQL Server: {Version}", version);
}
catch (Exception ex)
{
    logger.LogError("SQL Server connection failed: {Message}", ex.Message);
}

app.Run();

/// <summary>The single definition of the JSON wire contract, shared with the OpenAPI document.</summary>
static void ApplyJsonContract(JsonSerializerOptions options)
{
    options.PropertyNamingPolicy = SnakeCaseLowerNamingPolicy.Instance;
    options.PropertyNameCaseInsensitive = true;
    options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
}

/// <summary>Exposed so the integration tests can reference the API assembly.</summary>
public partial class Program { }
