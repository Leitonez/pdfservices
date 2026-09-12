using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using PdfServices.API.Data;

namespace PdfServices.API.Services;

/// <summary>Single use tokens sent by e-mail. Only their SHA-256 is stored; expired documents are removed by TTL.</summary>
public class OneTimeTokenStore
{
    private readonly CosmosContext _db;

    public OneTimeTokenStore(CosmosContext db)
    {
        _db = db;
    }

    public async Task<string> CreateAsync(string purpose, string accountId, TimeSpan validity)
    {
        string token = SecureTokens.NewToken();
        string id = SecureTokens.Sha256Hex(token);
        DateTime now = DateTime.UtcNow;
        TokenDocument document = new TokenDocument
        {
            Id = id,
            Purpose = purpose,
            AccountId = accountId,
            CreatedAt = now,
            ExpiresAt = now.Add(validity),
            Ttl = (int)validity.TotalSeconds
        };

        await _db.Tokens.CreateItemAsync(document, new PartitionKey(id));
        return token;
    }

    /// <summary>Validates and deletes the token. Returns null when it is unknown, expired, already used or of another purpose.</summary>
    public async Task<TokenDocument> ConsumeAsync(string token, string purpose)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200)
        {
            return null;
        }

        string id = SecureTokens.Sha256Hex(token.Trim());
        TokenDocument document;
        try
        {
            ItemResponse<TokenDocument> response = await _db.Tokens.ReadItemAsync<TokenDocument>(id, new PartitionKey(id));
            document = response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        if (document.Purpose != purpose || document.ExpiresAt <= DateTime.UtcNow)
        {
            return null;
        }

        try
        {
            await _db.Tokens.DeleteItemAsync<TokenDocument>(id, new PartitionKey(id));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null; // consumed by a concurrent request
        }

        return document;
    }
}
