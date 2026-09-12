using System.Text;

namespace PdfServices.API.Services;

/// <summary>
/// CNPJ validation supporting both the numeric format and the alphanumeric format
/// introduced by the Receita Federal in July 2026 (IN RFB 2.229/2024): the first 12 characters
/// may be digits or letters, the last 2 are numeric check digits. Each character is worth its ASCII code minus 48.
/// </summary>
public static class CnpjValidator
{
    private static readonly int[] FirstWeights = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
    private static readonly int[] SecondWeights = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };

    /// <summary>Uppercases and removes punctuation (. / - and spaces).</summary>
    public static string Normalize(string value)
    {
        if (value == null)
        {
            return null;
        }

        StringBuilder builder = new StringBuilder(14);
        foreach (char c in value.ToUpperInvariant())
        {
            if (c == '.' || c == '/' || c == '-' || char.IsWhiteSpace(c))
            {
                continue;
            }

            builder.Append(c);
        }

        return builder.ToString();
    }

    public static bool IsValid(string normalized)
    {
        if (normalized == null || normalized.Length != 14)
        {
            return false;
        }

        for (int i = 0; i < 12; i++)
        {
            char c = normalized[i];
            if (!(c >= '0' && c <= '9') && !(c >= 'A' && c <= 'Z'))
            {
                return false;
            }
        }

        if (!char.IsAsciiDigit(normalized[12]) || !char.IsAsciiDigit(normalized[13]))
        {
            return false;
        }

        bool allEqual = true;
        for (int i = 1; i < 14; i++)
        {
            if (normalized[i] != normalized[0])
            {
                allEqual = false;
                break;
            }
        }

        if (allEqual)
        {
            return false;
        }

        int first = CheckDigit(normalized, FirstWeights);
        int second = CheckDigit(normalized, SecondWeights);
        return normalized[12] - '0' == first && normalized[13] - '0' == second;
    }

    public static string Format(string normalized)
    {
        if (normalized == null || normalized.Length != 14)
        {
            return normalized;
        }

        return normalized.Substring(0, 2) + "." + normalized.Substring(2, 3) + "." + normalized.Substring(5, 3) + "/" + normalized.Substring(8, 4) + "-" + normalized.Substring(12, 2);
    }

    private static int CheckDigit(string value, int[] weights)
    {
        int sum = 0;
        for (int i = 0; i < weights.Length; i++)
        {
            sum += (value[i] - '0') * weights[i];
        }

        int remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }
}
