namespace PdfServices.API.Data;

public static class ContainerNames
{
    /// <summary>Partition key /accountId. Holds the account document, daily usage aggregates, transactions and access logs.</summary>
    public const string Accounts = "accounts";

    /// <summary>Partition key /id (SHA-256 of the normalized e-mail). Guarantees e-mail uniqueness.</summary>
    public const string Emails = "emails";

    /// <summary>Partition key /id (SHA-256 of the API key). Allows a 1 RU lookup on every API call.</summary>
    public const string ApiKeys = "apikeys";

    /// <summary>Partition key /id (SHA-256 of the token). One-time e-mail tokens, expired by TTL.</summary>
    public const string Tokens = "tokens";

    /// <summary>Partition key /id. Configuration documents such as capability prices.</summary>
    public const string Settings = "settings";
}

public static class DocumentTypes
{
    public const string Account = "account";
    public const string Usage = "usage";
    public const string Transaction = "transaction";
    public const string Access = "access";
    public const string Capability = "capability";
}

public static class AccessEvents
{
    public const string Login = "login";
    public const string Api = "api";
}

public static class AccountStatus
{
    public const string Active = "active";
    public const string Deleted = "deleted";
}

public static class TokenPurposes
{
    public const string EmailVerification = "email-verification";
    public const string PasswordReset = "password-reset";
}

public static class Capabilities
{
    public const string Html2Pdf = "html2pdf";
}
