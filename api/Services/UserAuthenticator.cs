using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;

namespace PdfServices.API.Services;

/// <summary>Authenticates portal calls through the "Authorization: Bearer" header.</summary>
public class UserAuthenticator
{
    private readonly JwtTokenService _tokens;
    private readonly AccountStore _accounts;

    public UserAuthenticator(JwtTokenService tokens, AccountStore accounts)
    {
        _tokens = tokens;
        _accounts = accounts;
    }

    public async Task<Versioned<AccountDocument>> AuthenticateAsync(HttpRequest request)
    {
        string header = request.Headers["Authorization"].ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            throw Unauthorized();
        }

        string token = header.Substring("Bearer ".Length).Trim();
        if (token.Length == 0 || token.Length > 4096)
        {
            throw Unauthorized();
        }

        JwtTokenService.TokenIdentity identity = await _tokens.ValidateAsync(token);
        if (identity == null)
        {
            throw Unauthorized();
        }

        Versioned<AccountDocument> account = await _accounts.GetAsync(identity.AccountId);
        if (account == null
            || account.Document.Status != AccountStatus.Active
            || !string.Equals(account.Document.SecurityStamp, identity.SecurityStamp, StringComparison.Ordinal))
        {
            throw Unauthorized();
        }

        return account;
    }

    private static ApiException Unauthorized()
    {
        return new ApiException(401, "unauthorized", "Sua sessão expirou. Faça login novamente.");
    }
}
