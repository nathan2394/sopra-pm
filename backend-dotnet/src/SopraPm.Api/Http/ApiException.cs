using System.Net;
using System.Text.Json;

namespace SopraPm.Api.Http;

/// <summary>
/// The C# stand-in for FastAPI's HTTPException: aborts the request and renders
/// {"detail": "..."} with the given status, which is the error shape the React
/// client already reads.
/// </summary>
public sealed class ApiException : Exception
{
    public ApiException(int statusCode, string detail) : base(detail)
    {
        StatusCode = statusCode;
        Detail = detail;
    }

    public int StatusCode { get; }
    public string Detail { get; }
    public Dictionary<string, string> Headers { get; init; } = new();

    public static ApiException NotFound(string detail) => new((int)HttpStatusCode.NotFound, detail);
    public static ApiException BadRequest(string detail) => new((int)HttpStatusCode.BadRequest, detail);

    public static ApiException Unauthorized(string detail) =>
        new((int)HttpStatusCode.Unauthorized, detail)
        {
            Headers = { ["WWW-Authenticate"] = "Bearer" },
        };
}

/// <summary>Renders ApiException (and unexpected errors) as FastAPI-shaped JSON.</summary>
public sealed class ApiExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiExceptionMiddleware> _logger;

    public ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ApiException ex)
        {
            await WriteAsync(context, ex.StatusCode, ex.Detail, ex.Headers);
        }
        catch (BadHttpRequestException ex)
        {
            // Minimal-API binding failure (malformed body, unparsable route value).
            await WriteAsync(context, ex.StatusCode, ex.Message, new Dictionary<string, string>());
        }
        catch (JsonException ex)
        {
            // Malformed or unbindable request body — FastAPI answers 422 here.
            await WriteAsync(context, 422, ex.Message, new Dictionary<string, string>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, 500, "Internal Server Error", new Dictionary<string, string>());
        }
    }

    private static async Task WriteAsync(
        HttpContext context, int status, string detail, Dictionary<string, string> headers)
    {
        if (context.Response.HasStarted) return;

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json; charset=utf-8";
        foreach (var (key, value) in headers) context.Response.Headers[key] = value;

        await context.Response.WriteAsJsonAsync(new Dictionary<string, string> { ["detail"] = detail });
    }
}
