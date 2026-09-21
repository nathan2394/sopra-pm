using Dapper;
using Microsoft.Data.SqlClient;

namespace SopraPm.Api.Data;

/// <summary>
/// SQL Server access for SOPRA PM — the C# counterpart of the old db.py.
///
/// Connections are opened per query and returned to ADO.NET's built-in
/// connection pool, so there is no hand-rolled pooling here (the Python version
/// needed asyncio.to_thread because pymssql is a blocking driver;
/// Microsoft.Data.SqlClient is natively async).
/// </summary>
public sealed class Db
{
    public Db(string connectionString) => ConnectionString = connectionString;

    public string ConnectionString { get; }

    /// <summary>
    /// ConnectionStrings:DefaultConnection wins when it is set — that is the one
    /// place to point the app at a different server. Otherwise the string is
    /// assembled from the MSSQL_* pieces the Python backend used, so an existing
    /// backend/.env keeps working untouched.
    /// </summary>
    public static string BuildConnectionString(IConfiguration cfg)
    {
        var configured = cfg.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        var host = Required(cfg, "MSSQL_HOST");
        var port = Required(cfg, "MSSQL_PORT");
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = $"{host},{port}",
            UserID = Required(cfg, "MSSQL_USER"),
            Password = Required(cfg, "MSSQL_PASSWORD"),
            InitialCatalog = Required(cfg, "MSSQL_DB"),
            ConnectTimeout = 15,
            CommandTimeout = 30,
            // Dev SQL Server containers use a self-signed certificate. Set
            // MSSQL_TRUST_CERT=false once a real certificate is in place.
            TrustServerCertificate = !string.Equals(
                cfg["MSSQL_TRUST_CERT"], "false", StringComparison.OrdinalIgnoreCase),
            Encrypt = true,
            MultipleActiveResultSets = false,
        };
        return builder.ConnectionString;
    }

    private static string Required(IConfiguration cfg, string key) =>
        cfg[key] ?? throw new InvalidOperationException(
            $"No ConnectionStrings:DefaultConnection, and {key} is not set either. " +
            "Set one or the other in backend-dotnet/.env or the environment.");

    private SqlConnection NewConnection() => new(ConnectionString);

    // ---------------- Core primitives ----------------
    public async Task<List<T>> FetchAllAsync<T>(string sql, object? param = null)
    {
        await using var conn = NewConnection();
        var rows = await conn.QueryAsync<T>(sql, param);
        return rows.AsList();
    }

    public async Task<T?> FetchOneAsync<T>(string sql, object? param = null)
    {
        await using var conn = NewConnection();
        return await conn.QueryFirstOrDefaultAsync<T>(sql, param);
    }

    /// <summary>Executes a non-query statement. Returns the affected row count.</summary>
    public async Task<int> ExecuteAsync(string sql, object? param = null)
    {
        await using var conn = NewConnection();
        return await conn.ExecuteAsync(sql, param);
    }

    /// <summary>Executes an INSERT and returns SCOPE_IDENTITY() as an int.</summary>
    public async Task<int> InsertReturningIdAsync(string sql, object? param = null)
    {
        await using var conn = NewConnection();
        var id = await conn.ExecuteScalarAsync<int?>(
            sql + "; SELECT CAST(SCOPE_IDENTITY() AS INT)", param);
        return id ?? throw new InvalidOperationException("INSERT did not return SCOPE_IDENTITY");
    }

    public async Task<string> PingAsync()
    {
        var version = await FetchOneAsync<string>("SELECT @@VERSION") ?? "";
        return version.Length > 80 ? version[..80] : version;
    }
}
