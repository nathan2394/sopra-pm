using Microsoft.Extensions.Configuration;
using SopraPm.Api.Configuration;
using SopraPm.Api.Data;
using SopraPm.Tools;

// Admin CLI for SOPRA PM — the C# replacement for seed.py and manage_users.py.
//
// Usage:
//   dotnet run --project src/SopraPm.Tools -- seed [--reset]
//   dotnet run --project src/SopraPm.Tools -- users list
//   dotnet run --project src/SopraPm.Tools -- users set-password <id_or_email> <email> [password]
//   dotnet run --project src/SopraPm.Tools -- users disable <id_or_email>

const string Usage = """
    SOPRA PM admin CLI

      seed [--reset]                                       seed initial data (--reset wipes first)
      users list                                           list team members and login state
      users set-password <id_or_email> <email> [password]  enable/replace a login
      users disable <id_or_email>                          clear a member's password hash
    """;

DotEnv.LoadNearest();

var config = new ConfigurationBuilder().AddEnvironmentVariables().Build();
var db = new Db(Db.BuildConnectionString(config));

if (args.Length == 0)
{
    Console.WriteLine(Usage);
    return 1;
}

try
{
    switch (args[0])
    {
        case "seed":
            await SeedCommand.RunAsync(db, config, reset: args.Contains("--reset"));
            return 0;

        case "users":
            return await UsersCommand.RunAsync(db, args[1..]);

        default:
            Console.WriteLine(Usage);
            return 1;
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    return 1;
}
