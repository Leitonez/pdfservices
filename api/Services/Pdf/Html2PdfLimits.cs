using PdfServices.API.Configuration;
using PdfServices.API.Data;

namespace PdfServices.API.Services.Pdf;

/// <summary>
/// Effective limits of one conversion: the account overrides when set to a positive value, otherwise the
/// defaults from <see cref="Html2PdfOptions"/>. Per-image size, redirects, timeouts and the SSRF rules are not
/// part of it because they are the same for every account.
/// </summary>
public class Html2PdfLimits
{
    public int MaxExternalImages { get; private set; }

    public int MaxTotalImageBytes { get; private set; }

    public int MaxRequestBytes { get; private set; }

    public static Html2PdfLimits Resolve(Html2PdfOptions options, AccountLimits overrides)
    {
        return new Html2PdfLimits
        {
            MaxExternalImages = Pick(overrides == null ? null : overrides.MaxExternalImages, options.MaxExternalImages),
            MaxTotalImageBytes = Pick(overrides == null ? null : overrides.MaxTotalImageBytes, options.MaxTotalImageBytes),
            MaxRequestBytes = Pick(overrides == null ? null : overrides.MaxRequestBytes, options.MaxRequestBytes)
        };
    }

    private static int Pick(int? value, int defaultValue)
    {
        return value.HasValue && value.Value > 0 ? value.Value : defaultValue;
    }
}
