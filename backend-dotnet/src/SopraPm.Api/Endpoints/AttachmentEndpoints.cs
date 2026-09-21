using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using SopraPm.Api.Data;
using SopraPm.Api.Http;
using SopraPm.Api.Models;

namespace SopraPm.Api.Endpoints;

/// <summary>
/// Files attached to a backlog item — pasted screenshots and PDFs — stored in
/// dbo.BacklogAttachments.
///
/// The bytes live in the row rather than on disk so there is nothing to
/// configure on the IIS app pool and the files are covered by the existing
/// database backup. That only holds while attachments stay small, hence the
/// size cap below.
/// </summary>
public static class AttachmentEndpoints
{
    /// <summary>Upper bound on a single attachment. Kept modest because the bytes sit in the row.</summary>
    public const int MaxBytes = 10 * 1024 * 1024; // 10 MB

    /// <summary>Accepted types, each paired with the magic bytes that prove it.</summary>
    private static readonly Dictionary<string, byte[][]> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = new[] { new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D } },   // %PDF-
        ["image/png"] = new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } },               // .PNG
        ["image/jpeg"] = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
        ["image/gif"] = new[] { new byte[] { 0x47, 0x49, 0x46, 0x38 } },               // GIF8
        ["image/webp"] = new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } },              // RIFF....WEBP
    };

    public static RouteGroupBuilder MapAttachmentEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/backlog/{itemId:int}/attachments", async (int itemId, Db db) =>
        {
            var rows = await db.FetchAllAsync<AttachmentMetaRow>(
                """
                SELECT Id, ItemId, [Name], ContentType, [Size], CreatedBy, CreatedAt
                  FROM dbo.BacklogAttachments
                 WHERE ItemId=@p0
                 ORDER BY CreatedAt, Id
                """,
                SqlParams.Positional(itemId));
            return rows.Select(r => r.ToDto()).ToList();
        });

        api.MapPost("/backlog/{itemId:int}/attachments", async (
            int itemId,
            [FromQuery(Name = "actor_id")] int? actorId,
            HttpRequest request,
            Db db) =>
        {
            if (!request.HasFormContentType)
                throw ApiException.BadRequest("Expected a multipart/form-data upload");

            var form = await request.ReadFormAsync();
            if (form.Files.Count == 0) throw ApiException.BadRequest("No file uploaded");

            var exists = await db.FetchOneAsync<int?>(
                "SELECT Id FROM dbo.BacklogItems WHERE Id=@p0", SqlParams.Positional(itemId));
            if (exists is null) throw ApiException.NotFound("Item not found");

            var saved = new List<AttachmentDto>();
            foreach (var file in form.Files)
            {
                if (file.Length == 0) continue;
                if (file.Length > MaxBytes)
                    throw ApiException.BadRequest(
                        $"{file.FileName} is larger than the {MaxBytes / (1024 * 1024)} MB limit");

                await using var stream = file.OpenReadStream();
                using var buffer = new MemoryStream();
                await stream.CopyToAsync(buffer);
                var bytes = buffer.ToArray();

                var contentType = ResolveContentType(file, bytes);
                var name = BuildName(file, contentType);

                var newId = await db.InsertReturningIdAsync(
                    """
                    INSERT INTO dbo.BacklogAttachments (ItemId, [Name], ContentType, [Size], [Data], CreatedBy)
                    VALUES (@p0, @p1, @p2, @p3, @p4, @p5)
                    """,
                    SqlParams.Positional(itemId, name, contentType, bytes.Length, bytes, actorId));

                saved.Add(new AttachmentDto
                {
                    Id = newId,
                    ItemId = itemId,
                    Name = name,
                    ContentType = contentType,
                    Size = bytes.Length,
                    CreatedBy = actorId,
                });
            }

            if (saved.Count == 0) throw ApiException.BadRequest("No file uploaded");
            return saved;
        });

        api.MapGet("/attachments/{attachmentId:int}", async (int attachmentId, Db db) =>
        {
            await using var conn = new SqlConnection(db.ConnectionString);
            var row = await conn.QueryFirstOrDefaultAsync<AttachmentFileRow>(
                "SELECT [Name], ContentType, [Data] FROM dbo.BacklogAttachments WHERE Id=@p0",
                SqlParams.Positional(attachmentId));

            if (row?.Data is null) throw ApiException.NotFound("Attachment not found");

            // No fileDownloadName: images must render inline in an <img>, and a
            // PDF opens in the browser viewer rather than forcing a save dialog.
            return Results.File(row.Data, row.ContentType ?? "application/octet-stream");
        });

        api.MapDelete("/attachments/{attachmentId:int}", async (int attachmentId, Db db) =>
        {
            var affected = await db.ExecuteAsync(
                "DELETE FROM dbo.BacklogAttachments WHERE Id=@p0", SqlParams.Positional(attachmentId));
            if (affected == 0) throw ApiException.NotFound("Attachment not found");
            return Results.Ok(new { ok = true });
        });

        return api;
    }

    /// <summary>
    /// Decides the stored type from the bytes, not the browser's claim. A pasted
    /// screenshot arrives with a generic name and sometimes no usable type at all.
    /// </summary>
    private static string ResolveContentType(IFormFile file, byte[] bytes)
    {
        foreach (var pair in AllowedTypes)
        {
            if (!pair.Value.Any(sig => StartsWith(bytes, sig))) continue;

            // RIFF also fronts .wav and .avi; a real WEBP names itself at offset 8.
            if (pair.Key == "image/webp" && !(bytes.Length >= 12 &&
                    bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50))
                continue;

            return pair.Key;
        }

        var label = string.IsNullOrWhiteSpace(file.FileName) ? "That file" : file.FileName;
        throw ApiException.BadRequest($"{label} is not a PDF or an image (PNG, JPEG, GIF, WEBP)");
    }

    /// <summary>Pasted images arrive as "blob" or "image.png"; give them something readable.</summary>
    private static string BuildName(IFormFile file, string contentType)
    {
        var raw = Path.GetFileName(file.FileName ?? "");
        if (!string.IsNullOrWhiteSpace(raw) && raw != "blob" && Path.HasExtension(raw))
            return raw.Length > 260 ? raw.Substring(raw.Length - 260) : raw;

        var ext = contentType switch
        {
            "application/pdf" => "pdf",
            "image/png" => "png",
            "image/jpeg" => "jpg",
            "image/gif" => "gif",
            "image/webp" => "webp",
            _ => "bin",
        };
        return $"pasted-{DateTime.Now:yyyyMMdd-HHmmss}.{ext}";
    }

    private static bool StartsWith(byte[] bytes, byte[] signature)
    {
        if (bytes.Length < signature.Length) return false;
        for (var i = 0; i < signature.Length; i++)
            if (bytes[i] != signature[i]) return false;
        return true;
    }

    private sealed class AttachmentFileRow
    {
        public string? Name { get; init; }
        public string? ContentType { get; init; }
        public byte[]? Data { get; init; }
    }
}
