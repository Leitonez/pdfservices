using System;

namespace PdfServices.API.Data;

/// <summary>Customer account. Container "accounts", id = accountId.</summary>
public class AccountDocument
{
    public string Id { get; set; }

    public string AccountId { get; set; }

    public string Type { get; set; } = DocumentTypes.Account;

    public string Status { get; set; } = AccountStatus.Active;

    public string Name { get; set; }

    public string CompanyName { get; set; }

    /// <summary>Normalized CNPJ (14 characters, no punctuation; may be alphanumeric).</summary>
    public string Cnpj { get; set; }

    public string Email { get; set; }

    public bool EmailVerified { get; set; }

    public DateTime? EmailVerifiedAt { get; set; }

    public string PasswordHash { get; set; }

    /// <summary>Changes whenever the password changes or the account is deleted, invalidating issued tokens.</summary>
    public string SecurityStamp { get; set; }

    /// <summary>Available credits in BRL. Credits are added manually by editing this field.</summary>
    public decimal Balance { get; set; }

    public string Currency { get; set; } = "BRL";

    public int FailedLoginCount { get; set; }

    public DateTime? LockoutEndsAt { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public decimal? ForfeitedBalance { get; set; }
}

/// <summary>Daily consumption aggregate per capability. Container "accounts", id = usage-{capability}-{yyyy-MM-dd}.</summary>
public class UsageDocument
{
    public string Id { get; set; }

    public string AccountId { get; set; }

    public string Type { get; set; } = DocumentTypes.Usage;

    public string Capability { get; set; }

    /// <summary>Day in Brasília time, yyyy-MM-dd.</summary>
    public string Date { get; set; }

    public long Count { get; set; }

    public decimal Amount { get; set; }

    public DateTime UpdatedAt { get; set; }

    public static string BuildId(string capability, string date)
    {
        return "usage-" + capability + "-" + date;
    }
}

/// <summary>
/// One executed capability call. Container "accounts".
/// Only metadata is stored: the HTML sent and the PDF produced are never persisted.
/// </summary>
public class TransactionDocument
{
    public string Id { get; set; }

    public string AccountId { get; set; }

    public string Type { get; set; } = DocumentTypes.Transaction;

    public string Capability { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Day in Brasília time, yyyy-MM-dd.</summary>
    public string Date { get; set; }

    public string ApiKeyId { get; set; }

    public string ApiKeyName { get; set; }

    public string ApiKeyPrefix { get; set; }

    public decimal Amount { get; set; }

    public decimal BalanceAfter { get; set; }

    public long InputBytes { get; set; }

    public long OutputBytes { get; set; }

    public long DurationMs { get; set; }
}

/// <summary>
/// Access record (IP + date/time) kept for 6 months as required by the Marco Civil da Internet (Lei 12.965/2014, art. 15).
/// Container "accounts", expired automatically by TTL.
/// </summary>
public class AccessLogDocument
{
    public const int RetentionSeconds = 183 * 24 * 60 * 60;

    public string Id { get; set; }

    public string AccountId { get; set; }

    public string Type { get; set; } = DocumentTypes.Access;

    /// <summary>login or api.</summary>
    public string Event { get; set; }

    public DateTime At { get; set; }

    public string Ip { get; set; }

    public string ApiKeyId { get; set; }

    public string TransactionId { get; set; }

    public int Ttl { get; set; } = RetentionSeconds;
}

/// <summary>E-mail uniqueness index. Container "emails", id = SHA-256 of the normalized e-mail.</summary>
public class EmailIndexDocument
{
    public string Id { get; set; }

    public string AccountId { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>API key. Container "apikeys", id = SHA-256 of the key. The key itself is never stored.</summary>
public class ApiKeyDocument
{
    public string Id { get; set; }

    /// <summary>Public identifier used by the portal to reference the key.</summary>
    public string KeyId { get; set; }

    public string AccountId { get; set; }

    public string Name { get; set; }

    /// <summary>First characters of the key, shown in the portal to help identify it.</summary>
    public string Prefix { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? LastUsedAt { get; set; }
}

/// <summary>One-time token sent by e-mail. Container "tokens", id = SHA-256 of the token.</summary>
public class TokenDocument
{
    public string Id { get; set; }

    public string Purpose { get; set; }

    public string AccountId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    /// <summary>Cosmos DB time-to-live in seconds.</summary>
    public int Ttl { get; set; }
}

/// <summary>Capability configuration and price. Container "settings", id = capability-{name}.</summary>
public class CapabilityDocument
{
    public string Id { get; set; }

    public string Type { get; set; } = DocumentTypes.Capability;

    public string Name { get; set; }

    public string DisplayName { get; set; }

    public string Description { get; set; }

    /// <summary>Price charged per successful call.</summary>
    public decimal Price { get; set; }

    public string Currency { get; set; } = "BRL";

    public bool Enabled { get; set; } = true;

    public DateTime UpdatedAt { get; set; }

    public static string BuildId(string name)
    {
        return "capability-" + name;
    }
}
