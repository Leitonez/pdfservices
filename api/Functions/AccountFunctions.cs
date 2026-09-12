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
using PdfServices.API.Services.Email;

namespace PdfServices.API.Functions;

/// <summary>Logged-in customer endpoints (bearer token).</summary>
public class AccountFunctions
{
    private readonly CosmosContext _db;
    private readonly AccountStore _accounts;
    private readonly UserAuthenticator _users;
    private readonly JwtTokenService _jwt;
    private readonly AccountMailer _mailer;
    private readonly ILogger<AccountFunctions> _logger;

    public AccountFunctions(CosmosContext db, AccountStore accounts, UserAuthenticator users, JwtTokenService jwt, AccountMailer mailer, ILogger<AccountFunctions> logger)
    {
        _db = db;
        _accounts = accounts;
        _users = users;
        _jwt = jwt;
        _mailer = mailer;
        _logger = logger;
    }

    [Function("GetAccount")]
    public Task<IActionResult> GetAccount([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/account")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            return ApiResults.Ok(AccountResponse.From(account.Document));
        });
    }

    [Function("ChangePassword")]
    public Task<IActionResult> ChangePassword([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/account/change-password")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            ChangePasswordRequest body = await RequestReader.ReadJsonAsync<ChangePasswordRequest>(req);

            if (!PasswordHasher.Verify(body.CurrentPassword, account.Document.PasswordHash))
            {
                throw new ApiException(400, "invalid_password", "Senha atual incorreta.", new Dictionary<string, string> { { "currentPassword", "Senha atual incorreta." } });
            }

            string passwordError = Validation.PasswordError(body.NewPassword);
            if (passwordError != null)
            {
                throw new ApiException(400, "validation_error", passwordError, new Dictionary<string, string> { { "newPassword", passwordError } });
            }

            Versioned<AccountDocument> updated = await _accounts.PatchAsync(account.Document.Id, new List<PatchOperation>
            {
                PatchOperation.Set("/passwordHash", PasswordHasher.Hash(body.NewPassword)),
                PatchOperation.Set("/securityStamp", SecureTokens.NewToken(16)),
                PatchOperation.Set("/updatedAt", DateTime.UtcNow)
            });

            await _mailer.SendPasswordChangedAsync(updated.Document);

            // Other sessions are invalidated by the new security stamp; this one continues with a fresh token.
            JwtTokenService.IssuedToken token = _jwt.Issue(updated.Document);
            return ApiResults.Ok(new SessionResponse
            {
                AccessToken = token.AccessToken,
                ExpiresAt = token.ExpiresAt,
                Account = AccountResponse.From(updated.Document)
            });
        });
    }

    /// <summary>
    /// Deletes the account: personal data (name, e-mail, password) is erased, API keys are revoked and the remaining
    /// balance is forfeited. Company data and transaction metadata are kept for legal and tax obligations.
    /// </summary>
    [Function("DeleteAccount")]
    public Task<IActionResult> DeleteAccount([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/account/delete")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            DeleteAccountRequest body = await RequestReader.ReadJsonAsync<DeleteAccountRequest>(req);

            if (!PasswordHasher.Verify(body.Password, account.Document.PasswordHash))
            {
                throw new ApiException(400, "invalid_password", "Senha incorreta.", new Dictionary<string, string> { { "password", "Senha incorreta." } });
            }

            string accountId = account.Document.Id;
            string email = account.Document.Email;

            // First the account (so billing stops immediately), guarded by ETag so a concurrent debit is not lost.
            for (int attempt = 1; ; attempt++)
            {
                DateTime now = DateTime.UtcNow;
                try
                {
                    await _accounts.PatchAsync(accountId, new List<PatchOperation>
                    {
                        PatchOperation.Set("/status", AccountStatus.Deleted),
                        PatchOperation.Set<string>("/name", null),
                        PatchOperation.Set<string>("/email", null),
                        PatchOperation.Set<string>("/passwordHash", null),
                        PatchOperation.Set("/securityStamp", SecureTokens.NewToken(16)),
                        PatchOperation.Set("/forfeitedBalance", account.Document.Balance),
                        PatchOperation.Set("/balance", 0m),
                        PatchOperation.Set("/deletedAt", now),
                        PatchOperation.Set("/updatedAt", now)
                    }, account.ETag);
                    break;
                }
                catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.PreconditionFailed && attempt < 5)
                {
                    account = await _accounts.GetAsync(accountId);
                }
            }

            QueryDefinition query = new QueryDefinition("SELECT * FROM c WHERE c.accountId = @accountId").WithParameter("@accountId", accountId);
            using (FeedIterator<ApiKeyDocument> iterator = _db.ApiKeys.GetItemQueryIterator<ApiKeyDocument>(query))
            {
                while (iterator.HasMoreResults)
                {
                    foreach (ApiKeyDocument apiKey in await iterator.ReadNextAsync())
                    {
                        await DeleteIgnoringNotFoundAsync(_db.ApiKeys, apiKey.Id);
                    }
                }
            }

            EmailIndexDocument index = email == null ? null : await _accounts.GetEmailIndexAsync(email);
            if (index != null && index.AccountId == accountId)
            {
                await DeleteIgnoringNotFoundAsync(_db.Emails, index.Id);
            }

            _logger.LogInformation("Account {AccountId} deleted by its owner.", accountId);
            return ApiResults.Message(200, "Sua conta foi excluída.");
        });
    }

    private static async Task DeleteIgnoringNotFoundAsync(Container container, string id)
    {
        try
        {
            await container.DeleteItemAsync<object>(id, new PartitionKey(id));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
        }
    }
}
