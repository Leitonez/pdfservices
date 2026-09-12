using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;
using PdfServices.API.Data;

namespace PdfServices.API.Services.Email;

/// <summary>Account related e-mails. Delivery failures are logged but never break the calling flow.</summary>
public class AccountMailer
{
    private readonly OneTimeTokenStore _tokens;
    private readonly IEmailSender _sender;
    private readonly EmailTemplates _templates;
    private readonly AuthOptions _auth;
    private readonly ILogger<AccountMailer> _logger;

    public AccountMailer(OneTimeTokenStore tokens, IEmailSender sender, EmailTemplates templates, IOptions<AuthOptions> auth, ILogger<AccountMailer> logger)
    {
        _tokens = tokens;
        _sender = sender;
        _templates = templates;
        _auth = auth.Value;
        _logger = logger;
    }

    public async Task SendEmailVerificationAsync(AccountDocument account)
    {
        int hours = _auth.EmailVerificationTokenHours;
        string token = await _tokens.CreateAsync(TokenPurposes.EmailVerification, account.Id, TimeSpan.FromHours(hours));
        await TrySendAsync(_templates.EmailVerification(account.Email, account.Name, token, hours));
    }

    public async Task SendPasswordResetAsync(AccountDocument account)
    {
        int minutes = _auth.PasswordResetTokenMinutes;
        string token = await _tokens.CreateAsync(TokenPurposes.PasswordReset, account.Id, TimeSpan.FromMinutes(minutes));
        await TrySendAsync(_templates.PasswordReset(account.Email, account.Name, token, minutes));
    }

    public Task SendPasswordChangedAsync(AccountDocument account)
    {
        return TrySendAsync(_templates.PasswordChanged(account.Email, account.Name));
    }

    public Task SendSignupWithExistingEmailAsync(string email)
    {
        return TrySendAsync(_templates.SignupWithExistingEmail(email));
    }

    private async Task TrySendAsync(EmailMessage message)
    {
        try
        {
            await _sender.SendAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to send e-mail \"{Subject}\": {ExceptionType}", message.Subject, ex.GetType().Name);
        }
    }
}
