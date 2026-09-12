using System;
using System.Collections.Generic;
using PdfServices.API.Data;
using PdfServices.API.Services;

namespace PdfServices.API.Models;

public class AccountResponse
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string CompanyName { get; set; }

    public string Cnpj { get; set; }

    public string Email { get; set; }

    public bool EmailVerified { get; set; }

    public decimal Balance { get; set; }

    public string Currency { get; set; }

    public DateTime CreatedAt { get; set; }

    public static AccountResponse From(AccountDocument account)
    {
        return new AccountResponse
        {
            Id = account.Id,
            Name = account.Name,
            CompanyName = account.CompanyName,
            Cnpj = CnpjValidator.Format(account.Cnpj),
            Email = account.Email,
            EmailVerified = account.EmailVerified,
            Balance = account.Balance,
            Currency = account.Currency,
            CreatedAt = account.CreatedAt
        };
    }
}

public class SessionResponse
{
    public string AccessToken { get; set; }

    public DateTime ExpiresAt { get; set; }

    public AccountResponse Account { get; set; }
}

public class ApiKeyResponse
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Prefix { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? LastUsedAt { get; set; }

    /// <summary>Only returned once, when the key is created.</summary>
    public string Key { get; set; }

    public static ApiKeyResponse From(ApiKeyDocument apiKey)
    {
        return new ApiKeyResponse
        {
            Id = apiKey.KeyId,
            Name = apiKey.Name,
            Prefix = apiKey.Prefix,
            CreatedAt = apiKey.CreatedAt,
            LastUsedAt = apiKey.LastUsedAt
        };
    }
}

public class CapabilityResponse
{
    public string Name { get; set; }

    public string DisplayName { get; set; }

    public string Description { get; set; }

    public decimal Price { get; set; }

    public string Currency { get; set; }

    public static CapabilityResponse From(CapabilityDocument capability)
    {
        return new CapabilityResponse
        {
            Name = capability.Name,
            DisplayName = capability.DisplayName,
            Description = capability.Description,
            Price = capability.Price,
            Currency = capability.Currency
        };
    }
}

public class UsageResponse
{
    public string From { get; set; }

    public string To { get; set; }

    public string Currency { get; set; } = "BRL";

    public long TotalCount { get; set; }

    public decimal TotalAmount { get; set; }

    public List<UsageTotal> Capabilities { get; set; } = new List<UsageTotal>();

    public List<UsageDay> Days { get; set; } = new List<UsageDay>();

    public class UsageTotal
    {
        public string Capability { get; set; }

        public string DisplayName { get; set; }

        public long Count { get; set; }

        public decimal Amount { get; set; }
    }

    public class UsageDay
    {
        public string Date { get; set; }

        public string Capability { get; set; }

        public long Count { get; set; }

        public decimal Amount { get; set; }
    }
}

public class TransactionResponse
{
    public string Id { get; set; }

    public DateTime CreatedAt { get; set; }

    public string Capability { get; set; }

    public string ApiKeyName { get; set; }

    public string ApiKeyPrefix { get; set; }

    public decimal Amount { get; set; }

    public decimal BalanceAfter { get; set; }

    public long InputBytes { get; set; }

    public long OutputBytes { get; set; }

    public long DurationMs { get; set; }

    public static TransactionResponse From(TransactionDocument transaction)
    {
        return new TransactionResponse
        {
            Id = transaction.Id,
            CreatedAt = transaction.CreatedAt,
            Capability = transaction.Capability,
            ApiKeyName = transaction.ApiKeyName,
            ApiKeyPrefix = transaction.ApiKeyPrefix,
            Amount = transaction.Amount,
            BalanceAfter = transaction.BalanceAfter,
            InputBytes = transaction.InputBytes,
            OutputBytes = transaction.OutputBytes,
            DurationMs = transaction.DurationMs
        };
    }
}

public class TransactionPageResponse
{
    public List<TransactionResponse> Items { get; set; } = new List<TransactionResponse>();

    /// <summary>Opaque token for the next page, or null when there are no more items.</summary>
    public string Continuation { get; set; }
}
