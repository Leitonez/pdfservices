using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using PdfServices.API.Data;

namespace PdfServices.API.Services;

/// <summary>
/// Account persistence helpers. Account updates use partial PATCH operations so they never overwrite
/// the balance, which is changed concurrently by the billing flow.
/// </summary>
public class AccountStore
{
    private readonly CosmosContext _db;

    public AccountStore(CosmosContext db)
    {
        _db = db;
    }

    public async Task<Versioned<AccountDocument>> GetAsync(string accountId)
    {
        if (string.IsNullOrEmpty(accountId))
        {
            return null;
        }

        try
        {
            ItemResponse<AccountDocument> response = await _db.Accounts.ReadItemAsync<AccountDocument>(accountId, new PartitionKey(accountId));
            return new Versioned<AccountDocument>(response.Resource, response.ETag);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<EmailIndexDocument> GetEmailIndexAsync(string normalizedEmail)
    {
        string id = SecureTokens.Sha256Hex(normalizedEmail);
        try
        {
            ItemResponse<EmailIndexDocument> response = await _db.Emails.ReadItemAsync<EmailIndexDocument>(id, new PartitionKey(id));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <summary>Finds an active account by e-mail, or null.</summary>
    public async Task<Versioned<AccountDocument>> FindActiveByEmailAsync(string normalizedEmail)
    {
        EmailIndexDocument index = await GetEmailIndexAsync(normalizedEmail);
        if (index == null)
        {
            return null;
        }

        Versioned<AccountDocument> account = await GetAsync(index.AccountId);
        if (account == null || account.Document.Status != AccountStatus.Active)
        {
            return null;
        }

        return account;
    }

    public async Task<Versioned<AccountDocument>> PatchAsync(string accountId, IReadOnlyList<PatchOperation> operations, string ifMatchETag = null)
    {
        PatchItemRequestOptions options = ifMatchETag == null ? null : new PatchItemRequestOptions { IfMatchEtag = ifMatchETag };
        ItemResponse<AccountDocument> response = await _db.Accounts.PatchItemAsync<AccountDocument>(accountId, new PartitionKey(accountId), operations, options);
        return new Versioned<AccountDocument>(response.Resource, response.ETag);
    }
}

public class Versioned<T>
{
    public Versioned(T document, string eTag)
    {
        Document = document;
        ETag = eTag;
    }

    public T Document { get; }

    public string ETag { get; }
}
