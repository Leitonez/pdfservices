using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Models;
using PdfServices.API.Services;

namespace PdfServices.API.Functions;

public class ApiKeyFunctions
{
    private const int MaxKeysPerAccount = 20;
    private const int PrefixLength = 12;

    private readonly CosmosContext _db;
    private readonly UserAuthenticator _users;
    private readonly ILogger<ApiKeyFunctions> _logger;

    public ApiKeyFunctions(CosmosContext db, UserAuthenticator users, ILogger<ApiKeyFunctions> logger)
    {
        _db = db;
        _users = users;
        _logger = logger;
    }

    [Function("ListApiKeys")]
    public Task<IActionResult> List([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/account/api-keys")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            List<ApiKeyDocument> keys = await QueryKeysAsync(account.Document.Id, null);
            return ApiResults.Ok(keys.ConvertAll(ApiKeyResponse.From));
        });
    }

    [Function("CreateApiKey")]
    public Task<IActionResult> Create([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/account/api-keys")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            CreateApiKeyRequest body = await RequestReader.ReadJsonAsync<CreateApiKeyRequest>(req);
            string name = Validation.Clean(body.Name);
            if (string.IsNullOrEmpty(name) || name.Length > 60)
            {
                const string message = "Dê um nome à chave (até 60 caracteres).";
                throw new ApiException(400, "validation_error", message, new Dictionary<string, string> { { "name", message } });
            }

            List<ApiKeyDocument> existing = await QueryKeysAsync(account.Document.Id, null);
            if (existing.Count >= MaxKeysPerAccount)
            {
                throw new ApiException(400, "limit_reached", "Limite de " + MaxKeysPerAccount + " chaves atingido. Exclua uma chave antes de criar outra.");
            }

            string key = SecureTokens.NewApiKey();
            string id = SecureTokens.Sha256Hex(key);
            ApiKeyDocument document = new ApiKeyDocument
            {
                Id = id,
                KeyId = SecureTokens.NewId(),
                AccountId = account.Document.Id,
                Name = name,
                Prefix = key.Substring(0, PrefixLength),
                CreatedAt = DateTime.UtcNow
            };

            await _db.ApiKeys.CreateItemAsync(document, new PartitionKey(id));

            ApiKeyResponse response = ApiKeyResponse.From(document);
            response.Key = key;
            return ApiResults.Json(201, response);
        });
    }

    [Function("DeleteApiKey")]
    public Task<IActionResult> Delete([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "v1/account/api-keys/{keyId}")] HttpRequest req, string keyId)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            List<ApiKeyDocument> keys = await QueryKeysAsync(account.Document.Id, keyId);
            if (keys.Count == 0)
            {
                throw new ApiException(404, "not_found", "Chave de API não encontrada.");
            }

            try
            {
                await _db.ApiKeys.DeleteItemAsync<ApiKeyDocument>(keys[0].Id, new PartitionKey(keys[0].Id));
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
            }

            return new NoContentResult();
        });
    }

    private async Task<List<ApiKeyDocument>> QueryKeysAsync(string accountId, string keyId)
    {
        QueryDefinition query = keyId == null
            ? new QueryDefinition("SELECT * FROM c WHERE c.accountId = @accountId ORDER BY c.createdAt DESC")
                .WithParameter("@accountId", accountId)
            : new QueryDefinition("SELECT * FROM c WHERE c.accountId = @accountId AND c.keyId = @keyId")
                .WithParameter("@accountId", accountId)
                .WithParameter("@keyId", keyId);

        List<ApiKeyDocument> result = new List<ApiKeyDocument>();
        using (FeedIterator<ApiKeyDocument> iterator = _db.ApiKeys.GetItemQueryIterator<ApiKeyDocument>(query))
        {
            while (iterator.HasMoreResults)
            {
                result.AddRange(await iterator.ReadNextAsync());
            }
        }

        return result;
    }
}
