using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PdfServices.API.Configuration;
using PdfServices.API.Data;

namespace PdfServices.API.Services;

/// <summary>Issues and validates the bearer tokens used by the customer portal.</summary>
public class JwtTokenService
{
    private const string SecurityStampClaim = "sst";

    private readonly AuthOptions _options;
    private readonly SymmetricSecurityKey _key;
    private readonly JsonWebTokenHandler _handler = new JsonWebTokenHandler();

    public JwtTokenService(IOptions<AuthOptions> options)
    {
        _options = options.Value;
        if (string.IsNullOrWhiteSpace(_options.JwtSigningKey))
        {
            throw new InvalidOperationException("Auth:JwtSigningKey is not configured.");
        }

        byte[] keyBytes = Convert.FromBase64String(_options.JwtSigningKey);
        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException("Auth:JwtSigningKey must have at least 32 bytes.");
        }

        _key = new SymmetricSecurityKey(keyBytes);
    }

    public IssuedToken Issue(AccountDocument account)
    {
        DateTime now = DateTime.UtcNow;
        DateTime expiresAt = now.AddMinutes(_options.TokenLifetimeMinutes);
        SecurityTokenDescriptor descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expiresAt,
            Claims = new Dictionary<string, object>
            {
                { JwtRegisteredClaimNames.Sub, account.Id },
                { SecurityStampClaim, account.SecurityStamp }
            },
            SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256)
        };

        return new IssuedToken { AccessToken = _handler.CreateToken(descriptor), ExpiresAt = expiresAt };
    }

    /// <summary>Returns the token subject and security stamp, or null when the token is invalid or expired.</summary>
    public async Task<TokenIdentity> ValidateAsync(string token)
    {
        TokenValidationParameters parameters = new TokenValidationParameters
        {
            ValidIssuer = _options.Issuer,
            ValidAudience = _options.Audience,
            IssuerSigningKey = _key,
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        TokenValidationResult result = await _handler.ValidateTokenAsync(token, parameters);
        if (!result.IsValid)
        {
            return null;
        }

        if (!result.Claims.TryGetValue(JwtRegisteredClaimNames.Sub, out object subject) || !result.Claims.TryGetValue(SecurityStampClaim, out object stamp))
        {
            return null;
        }

        return new TokenIdentity { AccountId = subject as string, SecurityStamp = stamp as string };
    }

    public class IssuedToken
    {
        public string AccessToken { get; set; }

        public DateTime ExpiresAt { get; set; }
    }

    public class TokenIdentity
    {
        public string AccountId { get; set; }

        public string SecurityStamp { get; set; }
    }
}
