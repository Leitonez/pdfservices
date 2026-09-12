using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;

namespace PdfServices.API.Services;

/// <summary>Authenticates capability calls through the X-Api-Key header.</summary>
public class ApiKeyAuthenticator
{
    public const string HeaderName = "X-Api-Key";

    private static readonly TimeSpan LastUsedResolution = TimeSpan.FromHours(1);

    private readonly CosmosContext _db;
    private readonly ILogger<ApiKeyAuthenticator> _logger;

    public ApiKeyAuthenticator(CosmosContext db, ILogger<ApiKeyAuthenticator> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<ApiKeyDocument> AuthenticateAsync(HttpRequest request)
    {
        string key = request.Headers[HeaderName].ToString().Trim();
        if (key.Length == 0)
        {
            throw new ApiException(401, "missing_api_key", "Informe sua chave de API no header " + HeaderName + ".");
        }

        if (!key.StartsWith(SecureTokens.ApiKeyPrefix, StringComparison.Ordinal) || key.Length > 128)
        {
            throw InvalidKey();
        }

        string id = SecureTokens.Sha256Hex(key);
        ApiKeyDocument apiKey;
        try
        {
            ItemResponse<ApiKeyDocument> response = await _db.ApiKeys.ReadItemAsync<ApiKeyDocument>(id, new PartitionKey(id));
            apiKey = response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            throw InvalidKey();
        }

        DateTime now = DateTime.UtcNow;
        if (!apiKey.LastUsedAt.HasValue || now - apiKey.LastUsedAt.Value > LastUsedResolution)
        {
            try
            {
                await _db.ApiKeys.PatchItemAsync<ApiKeyDocument>(id, new PartitionKey(id), new List<PatchOperation> { PatchOperation.Set("/lastUsedAt", now) });
            }
            catch (CosmosException ex)
            {
                _logger.LogWarning("Could not update lastUsedAt of API key {KeyId}: HTTP {StatusCode}", apiKey.KeyId, (int)ex.StatusCode);
            }
        }

        return apiKey;
    }

    public static ApiException InvalidKey()
    {
        return new ApiException(401, "invalid_api_key", "Chave de API inválida ou revogada.");
    }
}
