namespace SopraPm.Api.Configuration;

/// <summary>
/// Minimal .env loader so the C# backend reads the same backend/.env file the
/// Python backend did (python-dotenv's load_dotenv equivalent). Values already
/// present in the real environment win, matching load_dotenv's default of not
/// overriding exported variables.
/// </summary>
public static class DotEnv
{
    public static void Load(string path)
    {
        if (!File.Exists(path)) return;

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            var eq = line.IndexOf('=');
            if (eq <= 0) continue;

            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();

            // Strip a single layer of matching quotes.
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
            {
                value = value[1..^1];
            }

            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }

    /// <summary>Walks up from the app's base directory looking for a .env file.</summary>
    public static void LoadNearest(string fileName = ".env")
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, fileName);
            if (File.Exists(candidate))
            {
                Load(candidate);
                return;
            }
            dir = dir.Parent;
        }
    }
}
