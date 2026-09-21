using System.Globalization;
using Dapper;

namespace SopraPm.Api.Data;

/// <summary>Row/value helpers shared by the mappers (db.py's iso/csv_split/csv_join).</summary>
public static class RowHelpers
{
    /// <summary>DATETIME2 column -> ISO-8601 string, matching Python's datetime.isoformat().</summary>
    public static string? Iso(DateTime? value) =>
        value?.ToString("yyyy-MM-ddTHH:mm:ss.ffffff", CultureInfo.InvariantCulture);

    /// <summary>DATE column -> "yyyy-MM-dd", matching Python's date.isoformat().</summary>
    public static string? IsoDate(DateTime? value) =>
        value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static List<string> CsvSplit(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return new List<string>();
        return value.Split(',')
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .ToList();
    }

    public static string? CsvJoin(IEnumerable<string>? items)
    {
        if (items is null) return null;
        var list = items.ToList();
        return list.Count == 0 ? null : string.Join(",", list);
    }

    /// <summary>Rounds like Python's round(x, 1) for the percentages the API returns.</summary>
    public static double Pct(double numerator, double denominator) =>
        denominator > 0 ? Math.Round(numerator / denominator * 100, 1, MidpointRounding.ToEven) : 0;
}

/// <summary>
/// Builds @p0/@p1/... parameter sets for the dynamically assembled UPDATE and
/// filtered SELECT statements, which is what the Python code expressed with
/// pymssql's positional %s placeholders.
/// </summary>
public static class SqlParams
{
    public static DynamicParameters Positional(params object?[] values) =>
        Positional((IEnumerable<object?>)values);

    public static DynamicParameters Positional(IEnumerable<object?> values)
    {
        var p = new DynamicParameters();
        var i = 0;
        foreach (var v in values) p.Add($"p{i++}", v);
        return p;
    }

    /// <summary>"@p{index}" — the placeholder that pairs with <see cref="Positional(object?[])"/>.</summary>
    public static string Name(int index) => $"@p{index}";
}
