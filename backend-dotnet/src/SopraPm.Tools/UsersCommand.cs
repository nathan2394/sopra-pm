using SopraPm.Api.Auth;
using SopraPm.Api.Data;

namespace SopraPm.Tools;

/// <summary>
/// Manages SOPRA PM login accounts (port of manage_users.py).
///
/// Accounts are admin-seeded: there is no self-service signup page. Every login
/// is just a dbo.TeamMembers row that has an Email and a PasswordHash set.
/// </summary>
internal static class UsersCommand
{
    public static async Task<int> RunAsync(Db db, string[] args)
    {
        if (args.Length == 0) return Fail("Usage: users list | set-password | disable");

        switch (args[0])
        {
            case "list":
                await ListAsync(db);
                return 0;

            case "set-password":
                if (args.Length < 3)
                    return Fail("Usage: users set-password <id_or_email> <email> [password]");
                return await SetPasswordAsync(db, args[1], args[2], args.Length > 3 ? args[3] : null);

            case "disable":
                if (args.Length < 2) return Fail("Usage: users disable <id_or_email>");
                return await DisableAsync(db, args[1]);

            default:
                return Fail($"Unknown users command '{args[0]}'");
        }
    }

    private static async Task ListAsync(Db db)
    {
        var rows = await db.FetchAllAsync<TeamMemberRow>(
            "SELECT Id, Name, Role, Email, PasswordHash FROM dbo.TeamMembers ORDER BY Id");

        Console.WriteLine($"{"ID",-4} {"NAME",-16} {"ROLE",-16} {"EMAIL",-28} LOGIN ENABLED");
        foreach (var r in rows)
        {
            var enabled = string.IsNullOrEmpty(r.PasswordHash) ? "no" : "yes";
            Console.WriteLine($"{r.Id,-4} {r.Name,-16} {r.Role,-16} {r.Email ?? "—",-28} {enabled}");
        }
    }

    private static async Task<int> SetPasswordAsync(Db db, string identifier, string email, string? password)
    {
        var member = await FindMemberAsync(db, identifier);
        if (member is null) return Fail($"No team member matching '{identifier}'");

        if (password is null)
        {
            password = ReadHidden("New password: ");
            var confirm = ReadHidden("Confirm password: ");
            if (password != confirm) return Fail("Passwords do not match");
        }

        if (password.Length < 8) return Fail("Password must be at least 8 characters");

        await db.ExecuteAsync(
            "UPDATE dbo.TeamMembers SET Email=@p0, PasswordHash=@p1 WHERE Id=@p2",
            SqlParams.Positional(email, AuthService.HashPassword(password), member.Id));

        Console.WriteLine($"Login enabled for {member.Name} ({email}).");
        return 0;
    }

    private static async Task<int> DisableAsync(Db db, string identifier)
    {
        var member = await FindMemberAsync(db, identifier);
        if (member is null) return Fail($"No team member matching '{identifier}'");

        await db.ExecuteAsync(
            "UPDATE dbo.TeamMembers SET PasswordHash=NULL WHERE Id=@p0",
            SqlParams.Positional(member.Id));

        Console.WriteLine($"Login disabled for {member.Name}.");
        return 0;
    }

    private static Task<TeamMemberRow?> FindMemberAsync(Db db, string identifier) =>
        int.TryParse(identifier, out var id)
            ? db.FetchOneAsync<TeamMemberRow>(
                "SELECT * FROM dbo.TeamMembers WHERE Id=@p0", SqlParams.Positional(id))
            : db.FetchOneAsync<TeamMemberRow>(
                "SELECT * FROM dbo.TeamMembers WHERE LOWER(Email)=LOWER(@p0)", SqlParams.Positional(identifier));

    /// <summary>Console password prompt that does not echo (getpass equivalent).</summary>
    private static string ReadHidden(string prompt)
    {
        Console.Write(prompt);
        var buffer = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (buffer.Length > 0) buffer.Length--;
                continue;
            }
            if (!char.IsControl(key.KeyChar)) buffer.Append(key.KeyChar);
        }
        Console.WriteLine();
        return buffer.ToString();
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine(message);
        return 1;
    }
}
