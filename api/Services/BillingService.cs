using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;

namespace PdfServices.API.Services;

/// <summary>
/// Debits capability calls. The balance update, the daily usage aggregate, the transaction record and the
/// access log are written in a single transactional batch guarded by ETags, retried on concurrent updates.
/// </summary>
public class BillingService
{
    private const int MaxAttempts = 10;
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    private readonly CosmosContext _db;
    private readonly AccountStore _accounts;
    private readonly ILogger<BillingService> _logger;

    public BillingService(CosmosContext db, AccountStore accounts, ILogger<BillingService> logger)
    {
        _db = db;
        _accounts = accounts;
        _logger = logger;
    }

    /// <summary>Fails fast before doing the work when the account cannot pay for it.</summary>
    public async Task EnsureCanAffordAsync(string accountId, decimal price)
    {
        Versioned<AccountDocument> account = await _accounts.GetAsync(accountId);
        if (account == null || account.Document.Status != AccountStatus.Active)
        {
            throw ApiKeyAuthenticator.InvalidKey();
        }

        if (account.Document.Balance < price)
        {
            throw InsufficientBalance(account.Document.Balance);
        }
    }

    public async Task<ChargeResult> ChargeAsync(ChargeRequest request)
    {
        string accountId = request.ApiKey.AccountId;
        decimal price = request.Capability.Price;

        for (int attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            Versioned<AccountDocument> account = await _accounts.GetAsync(accountId);
            if (account == null || account.Document.Status != AccountStatus.Active)
            {
                throw ApiKeyAuthenticator.InvalidKey();
            }

            if (account.Document.Balance < price)
            {
                throw InsufficientBalance(account.Document.Balance);
            }

            DateTime now = DateTime.UtcNow;
            string date = BrazilTime.DateKey(now);
            string usageId = UsageDocument.BuildId(request.Capability.Name, date);
            Versioned<UsageDocument> usage = await ReadUsageAsync(accountId, usageId);
            decimal newBalance = Math.Round(account.Document.Balance - price, 6);

            TransactionDocument transaction = new TransactionDocument
            {
                Id = SecureTokens.NewId(),
                AccountId = accountId,
                Capability = request.Capability.Name,
                CreatedAt = now,
                Date = date,
                ApiKeyId = request.ApiKey.KeyId,
                ApiKeyName = request.ApiKey.Name,
                ApiKeyPrefix = request.ApiKey.Prefix,
                Amount = price,
                BalanceAfter = newBalance,
                InputBytes = request.InputBytes,
                OutputBytes = request.OutputBytes,
                DurationMs = request.DurationMs
            };

            AccessLogDocument access = new AccessLogDocument
            {
                Id = SecureTokens.NewId(),
                AccountId = accountId,
                Event = AccessEvents.Api,
                At = now,
                Ip = request.ClientIp,
                ApiKeyId = request.ApiKey.KeyId,
                TransactionId = transaction.Id
            };

            TransactionalBatch batch = _db.Accounts.CreateTransactionalBatch(new PartitionKey(accountId))
                .PatchItem(
                    accountId,
                    new List<PatchOperation> { PatchOperation.Set("/balance", newBalance), PatchOperation.Set("/updatedAt", now) },
                    new TransactionalBatchPatchItemRequestOptions { IfMatchEtag = account.ETag });

            if (usage == null)
            {
                batch.CreateItem(new UsageDocument
                {
                    Id = usageId,
                    AccountId = accountId,
                    Capability = request.Capability.Name,
                    Date = date,
                    Count = 1,
                    Amount = price,
                    UpdatedAt = now
                });
            }
            else
            {
                batch.PatchItem(
                    usageId,
                    new List<PatchOperation>
                    {
                        PatchOperation.Set("/count", usage.Document.Count + 1),
                        PatchOperation.Set("/amount", Math.Round(usage.Document.Amount + price, 6)),
                        PatchOperation.Set("/updatedAt", now)
                    },
                    new TransactionalBatchPatchItemRequestOptions { IfMatchEtag = usage.ETag });
            }

            batch.CreateItem(transaction);
            batch.CreateItem(access);

            using (TransactionalBatchResponse response = await batch.ExecuteAsync())
            {
                if (response.IsSuccessStatusCode)
                {
                    return new ChargeResult { TransactionId = transaction.Id, Amount = price, BalanceAfter = newBalance };
                }

                if (response.StatusCode != HttpStatusCode.PreconditionFailed && response.StatusCode != HttpStatusCode.Conflict)
                {
                    _logger.LogError("Billing batch failed with HTTP {StatusCode}: {Error}", (int)response.StatusCode, response.ErrorMessage);
                    throw new InvalidOperationException("Billing batch failed with HTTP " + (int)response.StatusCode + ".");
                }
            }

            // Another request updated the account or the usage aggregate first: reload and retry.
            await Task.Delay(Random.Shared.Next(5, 25) * attempt);
        }

        _logger.LogWarning("Billing gave up after {Attempts} concurrent update conflicts.", MaxAttempts);
        throw new ApiException(503, "busy", "Muitas requisições simultâneas para esta conta. Tente novamente em instantes.");
    }

    public static string FormatMoney(decimal value)
    {
        return "R$ " + value.ToString("#,0.00####", PtBr);
    }

    private static ApiException InsufficientBalance(decimal balance)
    {
        return new ApiException(402, "insufficient_balance", "Saldo insuficiente (saldo atual: " + FormatMoney(balance) + "). Adicione créditos para continuar.");
    }

    private async Task<Versioned<UsageDocument>> ReadUsageAsync(string accountId, string usageId)
    {
        try
        {
            ItemResponse<UsageDocument> response = await _db.Accounts.ReadItemAsync<UsageDocument>(usageId, new PartitionKey(accountId));
            return new Versioned<UsageDocument>(response.Resource, response.ETag);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public class ChargeRequest
    {
        public ApiKeyDocument ApiKey { get; set; }

        public CapabilityDocument Capability { get; set; }

        public string ClientIp { get; set; }

        public long InputBytes { get; set; }

        public long OutputBytes { get; set; }

        public long DurationMs { get; set; }
    }

    public class ChargeResult
    {
        public string TransactionId { get; set; }

        public decimal Amount { get; set; }

        public decimal BalanceAfter { get; set; }
    }
}
