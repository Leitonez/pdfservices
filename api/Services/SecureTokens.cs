using System;
using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace PdfServices.API.Services;

public static class SecureTokens
{
    public const string ApiKeyPrefix = "pdfs_";

    public static string NewId()
    {
        return Guid.NewGuid().ToString("N");
    }

    /// <summary>Cryptographically random, URL safe token.</summary>
    public static string NewToken(int bytes = 32)
    {
        return Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(bytes));
    }

    public static string NewApiKey()
    {
        return ApiKeyPrefix + NewToken(32);
    }

    /// <summary>Lowercase hex SHA-256. Used to store and look up high entropy secrets without keeping them.</summary>
    public static string Sha256Hex(string value)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }
}
