using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Models;
using PdfServices.API.Services;
using PdfServices.API.Services.Email;

namespace PdfServices.API.Functions;

/// <summary>Unauthenticated account endpoints. Signup, login and e-mail requests are protected by Cloudflare Turnstile.</summary>
public class AuthFunctions
{
    private readonly CosmosContext _db;
    private readonly AccountStore _accounts;
    private readonly TurnstileVerifier _turnstile;
    private readonly JwtTokenService _jwt;
    private readonly OneTimeTokenStore _tokens;
    private readonly AccountMailer _mailer;
    private readonly AuthOptions _auth;
    private readonly ILogger<AuthFunctions> _logger;

    public AuthFunctions(
        CosmosContext db,
        AccountStore accounts,
        TurnstileVerifier turnstile,
        JwtTokenService jwt,
        OneTimeTokenStore tokens,
        AccountMailer mailer,
        IOptions<AuthOptions> auth,
        ILogger<AuthFunctions> logger)
    {
        _db = db;
        _accounts = accounts;
        _turnstile = turnstile;
        _jwt = jwt;
        _tokens = tokens;
        _mailer = mailer;
        _auth = auth.Value;
        _logger = logger;
    }

    [Function("Signup")]
    public Task<IActionResult> Signup([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/signup")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            SignupRequest body = await RequestReader.ReadJsonAsync<SignupRequest>(req);
            string name = Validation.Clean(body.Name);
            string companyName = Validation.Clean(body.CompanyName);
            string cnpj = CnpjValidator.Normalize(body.Cnpj);
            string email = Validation.NormalizeEmail(body.Email);

            Dictionary<string, string> errors = new Dictionary<string, string>();
            if (string.IsNullOrEmpty(name) || name.Length < 3 || name.Length > 120)
            {
                errors["name"] = "Informe seu nome completo.";
            }

            if (string.IsNullOrEmpty(companyName) || companyName.Length < 2 || companyName.Length > 200)
            {
                errors["companyName"] = "Informe a razão social da empresa.";
            }

            if (!CnpjValidator.IsValid(cnpj))
            {
                errors["cnpj"] = "CNPJ inválido.";
            }

            if (!Validation.IsValidEmail(email))
            {
                errors["email"] = "E-mail inválido.";
            }

            string passwordError = Validation.PasswordError(body.Password);
            if (passwordError != null)
            {
                errors["password"] = passwordError;
            }

            if (!body.AcceptTerms)
            {
                errors["acceptTerms"] = "É preciso aceitar os Termos de Uso e a Política de Privacidade.";
            }

            if (errors.Count > 0)
            {
                throw new ApiException(400, "validation_error", "Verifique os campos destacados.", errors);
            }

            await _turnstile.VerifyAsync(body.TurnstileToken, TurnstileVerifier.SignupAction, req);

            DateTime now = DateTime.UtcNow;
            string accountId = SecureTokens.NewId();
            string emailId = SecureTokens.Sha256Hex(email);
            EmailIndexDocument index = new EmailIndexDocument { Id = emailId, AccountId = accountId, CreatedAt = now };

            try
            {
                await _db.Emails.CreateItemAsync(index, new PartitionKey(emailId));
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
            {
                Versioned<AccountDocument> existing = await _accounts.FindActiveByEmailAsync(email);
                if (existing != null)
                {
                    // Same answer as a new signup, so the endpoint does not reveal registered e-mails.
                    if (existing.Document.EmailVerified)
                    {
                        await _mailer.SendSignupWithExistingEmailAsync(email);
                    }
                    else
                    {
                        await _mailer.SendEmailVerificationAsync(existing.Document);
                    }

                    return SignupAccepted();
                }

                // The index points to a deleted or missing account: the e-mail is free again.
                await _db.Emails.UpsertItemAsync(index, new PartitionKey(emailId));
            }

            AccountDocument account = new AccountDocument
            {
                Id = accountId,
                AccountId = accountId,
                Status = AccountStatus.Active,
                Name = name,
                CompanyName = companyName,
                Cnpj = cnpj,
                Email = email,
                EmailVerified = false,
                PasswordHash = PasswordHasher.Hash(body.Password),
                SecurityStamp = SecureTokens.NewToken(16),
                Balance = 0m,
                Currency = "BRL",
                CreatedAt = now,
                UpdatedAt = now
            };

            try
            {
                await _db.Accounts.CreateItemAsync(account, new PartitionKey(accountId));
            }
            catch (Exception)
            {
                await TryDeleteEmailIndexAsync(emailId);
                throw;
            }

            _logger.LogInformation("Account {AccountId} created.", accountId);
            await _mailer.SendEmailVerificationAsync(account);
            return SignupAccepted();
        });
    }

    [Function("Login")]
    public Task<IActionResult> Login([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/login")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            LoginRequest body = await RequestReader.ReadJsonAsync<LoginRequest>(req);
            await _turnstile.VerifyAsync(body.TurnstileToken, TurnstileVerifier.LoginAction, req);

            string email = Validation.NormalizeEmail(body.Email);
            if (!Validation.IsValidEmail(email) || string.IsNullOrEmpty(body.Password) || body.Password.Length > Validation.PasswordMaxLength)
            {
                throw InvalidCredentials();
            }

            Versioned<AccountDocument> account = await _accounts.FindActiveByEmailAsync(email);
            if (account == null)
            {
                PasswordHasher.SimulateVerify(body.Password);
                throw InvalidCredentials();
            }

            AccountDocument document = account.Document;
            DateTime now = DateTime.UtcNow;
            if (document.LockoutEndsAt.HasValue && document.LockoutEndsAt.Value > now)
            {
                throw new ApiException(429, "account_locked", "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
            }

            if (!PasswordHasher.Verify(body.Password, document.PasswordHash))
            {
                await RegisterFailedLoginAsync(document.Id, now);
                throw InvalidCredentials();
            }

            if (!document.EmailVerified)
            {
                throw new ApiException(403, "email_not_verified", "Confirme seu e-mail antes de entrar. Não recebeu o link? Solicite um novo.");
            }

            Versioned<AccountDocument> updated = await _accounts.PatchAsync(document.Id, new List<PatchOperation>
            {
                PatchOperation.Set("/failedLoginCount", 0),
                PatchOperation.Set<DateTime?>("/lockoutEndsAt", null),
                PatchOperation.Set("/lastLoginAt", now)
            });

            await _db.Accounts.CreateItemAsync(new AccessLogDocument
            {
                Id = SecureTokens.NewId(),
                AccountId = document.Id,
                Event = AccessEvents.Login,
                At = now,
                Ip = ClientIp.Get(req)
            }, new PartitionKey(document.Id));

            JwtTokenService.IssuedToken token = _jwt.Issue(updated.Document);
            return ApiResults.Ok(new SessionResponse
            {
                AccessToken = token.AccessToken,
                ExpiresAt = token.ExpiresAt,
                Account = AccountResponse.From(updated.Document)
            });
        });
    }

    [Function("VerifyEmail")]
    public Task<IActionResult> VerifyEmail([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/verify-email")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            TokenRequest body = await RequestReader.ReadJsonAsync<TokenRequest>(req);
            TokenDocument token = await _tokens.ConsumeAsync(body.Token, TokenPurposes.EmailVerification);
            Versioned<AccountDocument> account = token == null ? null : await _accounts.GetAsync(token.AccountId);
            if (account == null || account.Document.Status != AccountStatus.Active)
            {
                throw new ApiException(400, "invalid_token", "Link inválido ou expirado. Solicite um novo e-mail de confirmação.");
            }

            if (!account.Document.EmailVerified)
            {
                DateTime now = DateTime.UtcNow;
                await _accounts.PatchAsync(account.Document.Id, new List<PatchOperation>
                {
                    PatchOperation.Set("/emailVerified", true),
                    PatchOperation.Set("/emailVerifiedAt", now),
                    PatchOperation.Set("/updatedAt", now)
                });
            }

            return ApiResults.Message(200, "E-mail confirmado! Você já pode entrar.");
        });
    }

    [Function("ResendVerification")]
    public Task<IActionResult> ResendVerification([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/resend-verification")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            EmailRequest body = await RequestReader.ReadJsonAsync<EmailRequest>(req);
            await _turnstile.VerifyAsync(body.TurnstileToken, TurnstileVerifier.ResendAction, req);

            string email = Validation.NormalizeEmail(body.Email);
            if (Validation.IsValidEmail(email))
            {
                Versioned<AccountDocument> account = await _accounts.FindActiveByEmailAsync(email);
                if (account != null && !account.Document.EmailVerified)
                {
                    await _mailer.SendEmailVerificationAsync(account.Document);
                }
            }

            return ApiResults.Message(202, "Se houver uma conta aguardando confirmação com este e-mail, enviaremos um novo link.");
        });
    }

    [Function("ForgotPassword")]
    public Task<IActionResult> ForgotPassword([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/forgot-password")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            EmailRequest body = await RequestReader.ReadJsonAsync<EmailRequest>(req);
            await _turnstile.VerifyAsync(body.TurnstileToken, TurnstileVerifier.ForgotAction, req);

            string email = Validation.NormalizeEmail(body.Email);
            if (Validation.IsValidEmail(email))
            {
                Versioned<AccountDocument> account = await _accounts.FindActiveByEmailAsync(email);
                if (account != null)
                {
                    await _mailer.SendPasswordResetAsync(account.Document);
                }
            }

            return ApiResults.Message(202, "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.");
        });
    }

    [Function("ResetPassword")]
    public Task<IActionResult> ResetPassword([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/auth/reset-password")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            ResetPasswordRequest body = await RequestReader.ReadJsonAsync<ResetPasswordRequest>(req);
            string passwordError = Validation.PasswordError(body.Password);
            if (passwordError != null)
            {
                throw new ApiException(400, "validation_error", passwordError, new Dictionary<string, string> { { "password", passwordError } });
            }

            TokenDocument token = await _tokens.ConsumeAsync(body.Token, TokenPurposes.PasswordReset);
            Versioned<AccountDocument> account = token == null ? null : await _accounts.GetAsync(token.AccountId);
            if (account == null || account.Document.Status != AccountStatus.Active)
            {
                throw new ApiException(400, "invalid_token", "Link inválido ou expirado. Solicite uma nova redefinição de senha.");
            }

            // The reset link proves ownership of the e-mail, so it also confirms it.
            DateTime now = DateTime.UtcNow;
            Versioned<AccountDocument> updated = await _accounts.PatchAsync(account.Document.Id, new List<PatchOperation>
            {
                PatchOperation.Set("/passwordHash", PasswordHasher.Hash(body.Password)),
                PatchOperation.Set("/securityStamp", SecureTokens.NewToken(16)),
                PatchOperation.Set("/emailVerified", true),
                PatchOperation.Set("/failedLoginCount", 0),
                PatchOperation.Set<DateTime?>("/lockoutEndsAt", null),
                PatchOperation.Set("/updatedAt", now)
            });

            await _mailer.SendPasswordChangedAsync(updated.Document);
            return ApiResults.Message(200, "Senha redefinida! Você já pode entrar com a nova senha.");
        });
    }

    private static IActionResult SignupAccepted()
    {
        return ApiResults.Message(202, "Cadastro recebido! Enviamos um e-mail com os próximos passos. Confira também a caixa de spam.");
    }

    private static ApiException InvalidCredentials()
    {
        return new ApiException(401, "invalid_credentials", "E-mail ou senha inválidos.");
    }

    private async Task RegisterFailedLoginAsync(string accountId, DateTime now)
    {
        Versioned<AccountDocument> updated = await _accounts.PatchAsync(accountId, new List<PatchOperation>
        {
            PatchOperation.Increment("/failedLoginCount", 1)
        });

        if (updated.Document.FailedLoginCount >= _auth.MaxFailedLoginAttempts)
        {
            await _accounts.PatchAsync(accountId, new List<PatchOperation>
            {
                PatchOperation.Set("/failedLoginCount", 0),
                PatchOperation.Set<DateTime?>("/lockoutEndsAt", now.AddMinutes(_auth.LockoutMinutes))
            });
            _logger.LogWarning("Account {AccountId} locked after {Attempts} failed logins.", accountId, _auth.MaxFailedLoginAttempts);
        }
    }

    private async Task TryDeleteEmailIndexAsync(string emailId)
    {
        try
        {
            await _db.Emails.DeleteItemAsync<EmailIndexDocument>(emailId, new PartitionKey(emailId));
        }
        catch (CosmosException ex)
        {
            _logger.LogWarning("Could not remove e-mail index after a failed signup: HTTP {StatusCode}", (int)ex.StatusCode);
        }
    }
}
