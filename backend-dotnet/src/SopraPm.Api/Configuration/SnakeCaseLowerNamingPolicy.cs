using System.Text;
using System.Text.Json;

namespace SopraPm.Api.Configuration;

/// <summary>
/// PascalCase -> snake_case for JSON property names: WbRef -> "wb_ref",
/// DataEngAssigneeId -> "data_eng_assignee_id".
///
/// .NET 8 ships this as JsonNamingPolicy.SnakeCaseLower, but this project
/// targets net7.0 (matching sopra-nexus-api), where that does not exist. The
/// exact key names are pinned by JsonContractTests — the React client reads
/// them, so they are a contract, not a formatting preference.
/// </summary>
public sealed class SnakeCaseLowerNamingPolicy : JsonNamingPolicy
{
    public static readonly SnakeCaseLowerNamingPolicy Instance = new();

    public override string ConvertName(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;

        var builder = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                // No separator before the first character, nor after one that is
                // already a separator.
                if (i > 0 && builder[^1] != '_') builder.Append('_');
                builder.Append(char.ToLowerInvariant(c));
            }
            else
            {
                builder.Append(c);
            }
        }
        return builder.ToString();
    }
}
