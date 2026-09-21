using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SopraPm.Api.Auth;

/// <summary>Marks an endpoint as requiring a bearer token, for the OpenAPI document.</summary>
public sealed class RequiresBearerAttribute : Attribute { }

public static class BearerEndpointExtensions
{
    /// <summary>
    /// Enforces the bearer token *and* records that requirement in the OpenAPI
    /// document. Both go through this one call so Swagger can never drift from
    /// what the pipeline actually enforces.
    /// </summary>
    public static TBuilder RequireBearer<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.AddEndpointFilter<TBuilder, RequireAuthFilter>();
        builder.WithMetadata(new RequiresBearerAttribute());
        return builder;
    }
}

/// <summary>
/// Puts the padlock on the operations that carry <see cref="RequiresBearerAttribute"/>.
///
/// Authentication here is a plain endpoint filter rather than ASP.NET's
/// authorization stack, so Swashbuckle has no metadata of its own to infer this
/// from and has to be told explicitly.
/// </summary>
public sealed class BearerSecurityOperationFilter : IOperationFilter
{
    public const string SchemeId = "Bearer";

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var requiresBearer = context.ApiDescription.ActionDescriptor.EndpointMetadata
            .OfType<RequiresBearerAttribute>().Any();
        if (!requiresBearer) return;

        operation.Security = new List<OpenApiSecurityRequirement>
        {
            new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = SchemeId,
                    },
                }] = new List<string>()
            }
        };

        operation.Responses.TryAdd("401", new OpenApiResponse
        {
            Description = "Missing, expired or invalid bearer token.",
        });
    }
}
