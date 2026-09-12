using System;
using System.Globalization;
using System.Security.Cryptography;

namespace PdfServices.API.Services;

/// <summary>PBKDF2-HMAC-SHA256 password hashing. Format: pbkdf2-sha256${iterations}${salt}${hash} (base64).</summary>
public static class PasswordHasher
{
    private const string Algorithm = "pbkdf2-sha256";
    private const int Iterations = 600000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    // Used to spend the same time when the account does not exist, avoiding user enumeration by timing.
    private static readonly string DummyHash = Hash(Guid.NewGuid().ToString());

    public static string Hash(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return string.Join("$", Algorithm, Iterations.ToString(CultureInfo.InvariantCulture), Convert.ToBase64String(salt), Convert.ToBase64String(hash));
    }

    public static bool Verify(string password, string storedHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedHash))
        {
            return false;
        }

        string[] parts = storedHash.Split('$');
        if (parts.Length != 4 || parts[0] != Algorithm || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out int iterations))
        {
            return false;
        }

        byte[] salt = Convert.FromBase64String(parts[2]);
        byte[] expected = Convert.FromBase64String(parts[3]);
        byte[] actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    public static void SimulateVerify(string password)
    {
        Verify(password ?? string.Empty, DummyHash);
    }
}
