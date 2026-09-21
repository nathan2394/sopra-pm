using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using SopraPm.Api.Auth;
using SopraPm.Api.Data;

namespace SopraPm.Tools;

/// <summary>
/// Seeds the initial SOPRA PM dataset (port of seed.py).
///
/// Idempotent: skips the insert when dbo.TeamMembers already has rows unless
/// --reset is passed. Also provisions a login (Email + PasswordHash) for every
/// seeded team member, all sharing one default password so the app is usable
/// immediately after seeding. Change these before handing the system to real
/// users — see the printed credentials table at the end of the run, and the
/// "users" command for changing/disabling passwords afterward.
/// </summary>
internal static class SeedCommand
{
    private static readonly string[] TablesInDeleteOrder =
        { "Activity", "BacklogItems", "Projects", "Sprints", "TeamMembers" };

    public static async Task RunAsync(Db db, IConfiguration config, bool reset)
    {
        var defaultPassword = config["SEED_DEFAULT_PASSWORD"] ?? "SopraPM@2026";

        await using var conn = new SqlConnection(db.ConnectionString);
        await conn.OpenAsync();

        if (reset)
        {
            Console.WriteLine("Wiping existing data...");
            await using var wipe = await conn.BeginTransactionAsync();
            foreach (var table in TablesInDeleteOrder)
            {
                var hadRows = await conn.ExecuteScalarAsync<int>(
                    $"SELECT COUNT(*) FROM dbo.{table}", transaction: wipe) > 0;
                await conn.ExecuteAsync($"DELETE FROM dbo.{table}", transaction: wipe);
                // Only RESEED if the table has had rows before; skipping RESEED on
                // never-populated tables keeps the first insert at Id=1 (IDENTITY default).
                if (hadRows)
                    await conn.ExecuteAsync($"DBCC CHECKIDENT ('dbo.{table}', RESEED, 0)", transaction: wipe);
            }
            await wipe.CommitAsync();
        }

        var existing = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.TeamMembers");
        if (existing > 0 && !reset)
        {
            Console.WriteLine("Data already present; skipping (use --reset to wipe).");
            return;
        }

        await using var tx = await conn.BeginTransactionAsync();

        // Team (+ login accounts)
        var passwordHash = AuthService.HashPassword(defaultPassword);
        var memberIds = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var m in SeedData.Team)
        {
            var id = await conn.ExecuteScalarAsync<int>(
                """
                INSERT INTO dbo.TeamMembers
                    (Name, Role, Email, PasswordHash, Areas, Rules, CapacitySp, AvatarColor)
                OUTPUT INSERTED.Id
                VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)
                """,
                SqlParams.Positional(m.Name, m.Role, m.Email, passwordHash, m.Areas, m.Rules,
                    m.CapacitySp, m.AvatarColor),
                tx);
            memberIds[m.Name] = id;
        }
        Console.WriteLine($"Inserted {SeedData.Team.Length} team members (all with login enabled)");

        // Projects
        var projectIds = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var p in SeedData.Projects)
        {
            var id = await conn.ExecuteScalarAsync<int>(
                """
                INSERT INTO dbo.Projects (Name, Code, [Description], [System], OwnerId, Color, [Status])
                OUTPUT INSERTED.Id
                VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6)
                """,
                SqlParams.Positional(p.Name, p.Code, p.Description, p.System,
                    LookupOrNull(memberIds, p.OwnerName), p.Color, p.Status),
                tx);
            projectIds[p.Code] = id;
        }
        Console.WriteLine($"Inserted {SeedData.Projects.Length} projects");

        // Sprints
        var sprintIds = new Dictionary<int, int>();
        foreach (var s in SeedData.Sprints)
        {
            var id = await conn.ExecuteScalarAsync<int>(
                """
                INSERT INTO dbo.Sprints (SprintNumber, Name, Quarter, StartDate, EndDate, Goal, [Status], CapacitySp)
                OUTPUT INSERTED.Id
                VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7)
                """,
                SqlParams.Positional(s.SprintNumber, s.Name, s.Quarter, s.StartDate, s.EndDate,
                    s.Goal, s.Status, s.CapacitySp),
                tx);
            sprintIds[s.SprintNumber] = id;
        }
        Console.WriteLine($"Inserted {SeedData.Sprints.Length} sprints");

        // Backlog
        foreach (var b in SeedData.Backlog)
        {
            var demo = SeedData.DemoStatuses.GetValueOrDefault(b.WbRef)
                       ?? new SeedData.DemoStatus("Backlog", 0, null);
            var extra = SeedData.ExtraAssignments.GetValueOrDefault(b.WbRef)
                        ?? new SeedData.ExtraAssignees(null, null);

            await conn.ExecuteAsync(
                """
                INSERT INTO dbo.BacklogItems
                    (WbRef, Title, [System], Priority, Quarter, ProjectId, Phase, SprintId,
                     DevAssigneeId, QaAssigneeId, UiuxAssigneeId, DataEngAssigneeId,
                     StoryPoints, ActualDate, PercentDone, [Status], Notes)
                VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14,@p15,@p16)
                """,
                SqlParams.Positional(
                    b.WbRef, b.Title, b.System, b.Priority, b.Quarter,
                    b.ProjectCode is null ? null : projectIds.GetValueOrDefault(b.ProjectCode),
                    b.Phase,
                    b.SprintNumber is null ? null : sprintIds.GetValueOrDefault(b.SprintNumber.Value),
                    LookupOrNull(memberIds, b.Dev),
                    LookupOrNull(memberIds, b.Qa),
                    LookupOrNull(memberIds, extra.Uiux),
                    LookupOrNull(memberIds, extra.DataEng),
                    b.StoryPoints, demo.ActualDate, demo.PercentDone, demo.Status, b.Notes),
                tx);
        }
        Console.WriteLine($"Inserted {SeedData.Backlog.Length} backlog items");

        await tx.CommitAsync();
        Console.WriteLine("Seed complete.");

        Console.WriteLine("\nLogin credentials (change these before real use — see the \"users\" command):");
        Console.WriteLine($"  Password for every account: {defaultPassword}");
        foreach (var m in SeedData.Team)
            Console.WriteLine($"    {m.Email,-24} {m.Name} ({m.Role})");
    }

    private static int? LookupOrNull(Dictionary<string, int> ids, string? name) =>
        name is not null && ids.TryGetValue(name, out var id) ? id : null;
}
