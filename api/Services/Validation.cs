using System;
using System.Net.Mail;

namespace PdfServices.API.Services;

public static class Validation
{
    public const int PasswordMinLength = 10;
    public const int PasswordMaxLength = 128;

    public static string Clean(string value)
    {
        return value == null ? null : value.Trim();
    }

    public static string NormalizeEmail(string email)
    {
        return email == null ? null : email.Trim().ToLowerInvariant();
    }

    public static bool IsValidEmail(string email)
    {
        if (string.IsNullOrEmpty(email) || email.Length > 254 || email.Contains(' '))
        {
            return false;
        }

        try
        {
            MailAddress address = new MailAddress(email);
            int at = email.LastIndexOf('@');
            return address.Address == email && at > 0 && email.IndexOf('.', at) > at + 1 && !email.EndsWith(".", StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>Returns an error message, or null when the password is acceptable.</summary>
    public static string PasswordError(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < PasswordMinLength)
        {
            return "A senha deve ter pelo menos " + PasswordMinLength + " caracteres.";
        }

        if (password.Length > PasswordMaxLength)
        {
            return "A senha deve ter no máximo " + PasswordMaxLength + " caracteres.";
        }

        return null;
    }
}
