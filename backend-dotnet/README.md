# SOPRA PM — .NET backend

C# / ASP.NET Core **7.0** port of the FastAPI backend in [`../backend`](../backend).
Same routes, same JSON shapes, same SQL Server database — the React frontend in
[`../frontend`](../frontend) needs no changes.

```
backend-dotnet/
├── .env                        MSSQL_*/JWT_*/CORS_ORIGINS — same keys as backend/.env
├── SopraPm.sln
├── src/
│   ├── SopraPm.Api/            the web API (was server.py + db.py + auth.py)
│   └── SopraPm.Tools/          admin CLI  (was seed.py + manage_users.py)
└── tests/
    └── SopraPm.Api.Tests/      integration suite (was tests/test_sopra_pm_mssql.py)
```

## Running it

The database is unchanged — keep using [`../database/schema.sql`](../database/schema.sql)
and the migrations in [`../database/migrations`](../database/migrations).

```bash
dotnet run --project backend-dotnet/src/SopraPm.Api
```

Listens on `http://0.0.0.0:8000` locally (from `Properties/launchSettings.json`),
which is what `frontend/.env`'s `REACT_APP_BACKEND_URL` already points at.

### Routes

The API lives entirely under `/api`, exactly as in the FastAPI version.

| URL | |
|---|---|
| `/` | redirects to `/swagger` when Swagger is on, otherwise a JSON signpost |
| `/api/` | `{"message": "SOPRA PM API", "version": "..."}` |
| `/api/health` | `{"ok": true, "db": "Microsoft SQL Server ..."}` |
| `/swagger` | API explorer, when enabled (see below) |

The root route is the one addition over the Python backend, which 404'd there.
It exists so opening the host in a browser doesn't look like a broken deploy.

### Deploying

`launchSettings.json` applies to `dotnet run` only, never to a published app.
**Set the port with `ASPNETCORE_URLS`** (or let IIS/nginx own the binding):

```bash
ASPNETCORE_URLS=http://0.0.0.0:801 dotnet SopraPm.Api.dll
```

Do not put `"Urls"` back into `appsettings.json` — it silently overrides
`ASPNETCORE_URLS`, so the app keeps listening on the hardcoded port however the
host is configured.

### Logs

Serilog, configured from the `Serilog` section of `appsettings.json` — console
plus a daily rolling file, the same arrangement `sopra-nexus-api` uses:

```
<app directory>/logs/log-YYYYMMDD.txt
```

`UseSerilogRequestLogging()` writes one line per request, so a 404 is visible:

```
2026-09-21 19:47:36.766 +07:00 [INF] HTTP GET / responded 404 in 5.3244 ms
```

The path is relative to the app's working directory. Under systemd use
`journalctl -u <service> -f` for the console stream; under IIS the stdout log is
off until you enable it in `web.config`, so the Serilog file is the reliable one.
`Microsoft` and `System` are capped at `Warning` — drop those overrides to see
framework-level routing detail.

### Swagger

<http://localhost:8000/swagger>; the raw document is at
`/swagger/v1/swagger.json`. On by default in Development, off elsewhere. To
expose it on a deployed instance, set `SWAGGER_ENABLED=true` — it publishes the
whole API surface, so it stays a deliberate choice rather than a default.

To call a protected route from the UI:

1. `POST /api/auth/login` with `{"email": "...", "password": "..."}`.
2. Copy `access_token` out of the response.
3. Hit **Authorize** (top right) and paste it — no `Bearer ` prefix, Swagger
   adds that itself.

Only `GET /api/`, `GET /api/health` and `POST /api/auth/login` are unlocked; the
other 29 operations show a padlock. That list comes from the same
`RequireBearer()` call that installs the auth filter, so the document cannot
drift from what the pipeline enforces.

Configuration comes from `backend-dotnet/.env` (the loader walks up from the
build output, so `dotnet run` from anywhere finds it). Real environment
variables win over the file, matching `load_dotenv`'s default.

### Database connection

Set `ConnectionStrings:DefaultConnection` and it wins outright:

```ini
# backend-dotnet/.env  —  "__" is the config hierarchy separator
ConnectionStrings__DefaultConnection=Server=host,1433;Database=SOPRA_PM;User Id=...;Password=...;TrustServerCertificate=true
```

It is read from `appsettings.json`, `.env`, or a real environment variable, in
increasing order of precedence. **`appsettings.json` is committed to git**, so a
password placed there goes into history — prefer `.env` (gitignored) locally and
a real `ConnectionStrings__DefaultConnection` environment variable on a server.

When `DefaultConnection` is blank, the string is assembled from the `MSSQL_*`
keys the Python backend used, so an existing `backend/.env` keeps working. That
path has one key the Python version didn't need: `MSSQL_TRUST_CERT=true`.
Microsoft.Data.SqlClient encrypts by default and rejects the self-signed
certificate a dev SQL Server container ships with; set it to `false` once a real
certificate is installed. (In a full `DefaultConnection` string, put
`TrustServerCertificate=true` in the string itself instead.)

## Seeding and accounts

```bash
dotnet run --project backend-dotnet/src/SopraPm.Tools -- seed
dotnet run --project backend-dotnet/src/SopraPm.Tools -- seed --reset
dotnet run --project backend-dotnet/src/SopraPm.Tools -- users list
dotnet run --project backend-dotnet/src/SopraPm.Tools -- users set-password 1 nathan@sopra.com 'Str0ng!Pass'
dotnet run --project backend-dotnet/src/SopraPm.Tools -- users disable 1
```

`seed` is idempotent (skips when `dbo.TeamMembers` has rows) and provisions a
login for every seeded member using `SEED_DEFAULT_PASSWORD`. The dataset is the
same 13 members / 7 projects / 19 sprints / 36 backlog items as before, so a
database seeded by the Python script needs no reseeding.

Passwords stay bcrypt, so existing `PasswordHash` values keep working.

## Tests

The suite drives a **running** API against a **seeded** database, as the pytest
version did. Start the API first, then:

```bash
dotnet test backend-dotnet
```

Override the target with `SOPRA_PM_BASE_URL`, `TEST_EMAIL`, `TEST_PASSWORD`.
Every test logs in first — the old pytest suite predates the auth layer and sent
no bearer token, so it would now get 401s across the board. If the API is
unreachable or the login fails, the tests report as skipped rather than failed.

## Notes on the port

- **JSON naming.** C# properties are PascalCase; `SnakeCaseLowerNamingPolicy`
  renders them as the `wb_ref` / `capacity_sp` keys the frontend reads, on the
  way out and in. Dictionary keys (`by_priority`, `by_system`) are left verbatim.
  .NET 8 ships this as `JsonNamingPolicy.SnakeCaseLower`, but net7.0 has no such
  API, so it is hand-written and pinned by `JsonContractTests`.
- **C# 11.** net7.0 predates primary constructors and collection expressions, so
  the code uses explicit constructors and `new()` initialisers throughout.
- **Errors.** `ApiException` + `ApiExceptionMiddleware` reproduce FastAPI's
  `{"detail": "..."}` body, which the axios client already reads.
- **Auth.** `RequireAuthFilter` is a line-by-line equivalent of `get_current_user`,
  including the distinct 401 details ("Not authenticated", "Session expired",
  "Invalid token", "Account disabled"). `/api/`, `/api/health` and
  `/api/auth/login` stay open; everything else under `/api/` requires the token.
- **PATCH `/api/backlog/{id}`** reads the raw JSON object instead of a typed DTO.
  It has to tell an absent key from a key sent as `null` — clearing a sprint or
  an assignee is a real operation — which is what Pydantic's `exclude_unset`
  gave the Python version. The other PATCH routes ignore nulls, as before.
- **No connection-pool shim.** `db.py` wrapped the blocking pymssql driver in
  `asyncio.to_thread`; Microsoft.Data.SqlClient is natively async and pools
  connections itself.
