namespace PdfServices.API.Configuration;

public class CosmosOptions
{
    public const string SectionName = "Cosmos";

    public string ConnectionString { get; set; }

    public string DatabaseName { get; set; } = "Production";

    /// <summary>Creates the database, containers and seed documents on startup when they do not exist.</summary>
    public bool InitializeOnStartup { get; set; } = true;
}

public class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>Base64 encoded HMAC key (at least 32 bytes) used to sign the portal bearer tokens.</summary>
    public string JwtSigningKey { get; set; }

    public string Issuer { get; set; } = "https://api.pdfservices.sistema.site";

    public string Audience { get; set; } = "https://my.pdfservices.sistema.site";

    public int TokenLifetimeMinutes { get; set; } = 480;

    public int MaxFailedLoginAttempts { get; set; } = 5;

    public int LockoutMinutes { get; set; } = 15;

    public int EmailVerificationTokenHours { get; set; } = 48;

    public int PasswordResetTokenMinutes { get; set; } = 60;
}

public class TurnstileOptions
{
    public const string SectionName = "Turnstile";

    public string SecretKey { get; set; }

    /// <summary>
    /// Comma separated hostnames where the widget may run. When empty, hostname and action checks are skipped
    /// (only for local development with Cloudflare test keys).
    /// </summary>
    public string AllowedHostnames { get; set; }

    public string VerifyUrl { get; set; } = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
}

public class MailgunOptions
{
    public const string SectionName = "Mailgun";

    public string ApiKey { get; set; }

    public string Domain { get; set; } = "mail.pdfservices.sistema.site";

    /// <summary>https://api.mailgun.net (US) or https://api.eu.mailgun.net (EU).</summary>
    public string BaseUrl { get; set; } = "https://api.mailgun.net";

    public string FromAddress { get; set; } = "autenticacao@mail.pdfservices.sistema.site";

    public string FromName { get; set; } = "PDF Services";

    /// <summary>When true, Mailgun accepts the message but does not deliver it (o:testmode).</summary>
    public bool TestMode { get; set; }
}

public class AppUrlsOptions
{
    public const string SectionName = "App";

    public string WebsiteUrl { get; set; } = "https://pdfservices.sistema.site";

    public string AdminUrl { get; set; } = "https://my.pdfservices.sistema.site";

    public string SourceCodeUrl { get; set; } = "https://github.com/Leitonez/pdfservices";
}

public class Html2PdfOptions
{
    public const string SectionName = "Html2Pdf";

    public int MaxRequestBytes { get; set; } = 1024 * 1024;

    public int MaxExternalImages { get; set; } = 20;

    public int MaxImageBytes { get; set; } = 5 * 1024 * 1024;

    public int MaxTotalImageBytes { get; set; } = 15 * 1024 * 1024;

    public int ExternalRequestTimeoutSeconds { get; set; } = 10;

    /// <summary>Written to the PDF "Producer" property. iText (AGPL) appends its own identification to it.</summary>
    public string Producer { get; set; } = "CodeCycle AGPL PDF Services (https://pdfservices.sistema.site)";
}
