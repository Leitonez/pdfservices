using System;
using System.IO;
using iText.StyledXmlParser.Resolver.Resource;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Pdf;

/// <summary>
/// iText resource retriever for one conversion. data: URIs are resolved by iText itself and never reach this class.
/// Everything else must be an https URL of a PNG or JPEG image (checked by magic bytes); CSS, fonts, local files
/// and other resources are refused. Also enforces per conversion count and size limits.
/// </summary>
// pdfHTML 6.3 ConverterProperties still takes the StyledXmlParser interface, marked obsolete in favour of iText.IO's.
#pragma warning disable CS0618
public class SafeImageResourceRetriever : IResourceRetriever
#pragma warning restore CS0618
{
    private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static readonly byte[] JpegSignature = { 0xFF, 0xD8, 0xFF };

    private readonly ExternalImageFetcher _fetcher;
    private readonly Html2PdfOptions _options;
    private int _requests;
    private long _totalBytes;

    public SafeImageResourceRetriever(ExternalImageFetcher fetcher, Html2PdfOptions options)
    {
        _fetcher = fetcher;
        _options = options;
    }

    public int FetchedCount { get; private set; }

    public int BlockedCount { get; private set; }

    public Stream GetInputStreamByUrl(Uri url)
    {
        byte[] bytes = GetByteArrayByUrl(url);
        return bytes == null ? null : new MemoryStream(bytes, false);
    }

    public byte[] GetByteArrayByUrl(Uri url)
    {
        if (!ExternalImageFetcher.IsAllowedUrl(url) || _requests >= _options.MaxExternalImages)
        {
            BlockedCount++;
            return null;
        }

        _requests++;
        long budget = Math.Min(_options.MaxImageBytes, _options.MaxTotalImageBytes - _totalBytes);
        byte[] bytes = budget <= 0 ? null : _fetcher.FetchAsync(url, (int)budget).GetAwaiter().GetResult();
        if (bytes == null || !(StartsWith(bytes, PngSignature) || StartsWith(bytes, JpegSignature)))
        {
            BlockedCount++;
            return null;
        }

        _totalBytes += bytes.Length;
        FetchedCount++;
        return bytes;
    }

    private static bool StartsWith(byte[] data, byte[] signature)
    {
        if (data.Length < signature.Length)
        {
            return false;
        }

        for (int i = 0; i < signature.Length; i++)
        {
            if (data[i] != signature[i])
            {
                return false;
            }
        }

        return true;
    }
}
