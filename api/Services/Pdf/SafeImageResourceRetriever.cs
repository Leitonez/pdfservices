using System;
using System.Collections.Concurrent;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using iText.StyledXmlParser.Resolver.Resource;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Pdf;

/// <summary>
/// iText resource retriever for one conversion. data: URIs are resolved by iText itself and never reach this class.
/// Everything else must be an https URL of a PNG or JPEG image (checked by magic bytes); CSS, fonts, local files
/// and other resources are refused. Also enforces the per conversion count, size and time limits.
/// The outcome of each distinct URL (image or refusal) is remembered, so a repeated URL is fetched at most once,
/// counts once against the limits and once as blocked.
/// </summary>
// pdfHTML 6.3 ConverterProperties still takes the StyledXmlParser interface, marked obsolete in favour of iText.IO's.
#pragma warning disable CS0618
public class SafeImageResourceRetriever : IResourceRetriever, IDisposable
#pragma warning restore CS0618
{
    private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static readonly byte[] JpegSignature = { 0xFF, 0xD8, 0xFF };
    private static readonly Task<byte[]> Refused = Task.FromResult<byte[]>(null);

    private readonly ExternalImageFetcher _fetcher;
    private readonly Html2PdfLimits _limits;
    private readonly int _maxImageBytes;
    private readonly CancellationTokenSource _budget;
    private readonly ConcurrentDictionary<string, Lazy<Task<byte[]>>> _outcomes = new ConcurrentDictionary<string, Lazy<Task<byte[]>>>();
    private readonly object _sync = new object();
    private int _slots;
    private long _acceptedBytes;
    private volatile bool _budgetExhausted;

    /// <summary>Starts the conversion's fetch time budget.</summary>
    public SafeImageResourceRetriever(ExternalImageFetcher fetcher, Html2PdfOptions options, Html2PdfLimits limits)
    {
        _fetcher = fetcher;
        _limits = limits;
        _maxImageBytes = options.MaxImageBytes;
        _budget = new CancellationTokenSource(TimeSpan.FromSeconds(options.MaxTotalFetchSeconds));
    }

    /// <summary>Distinct URLs that produced an image.</summary>
    public int FetchedCount
    {
        get { return CountOutcomes(true); }
    }

    /// <summary>Distinct URLs that were refused, failed or did not fit the limits.</summary>
    public int BlockedCount
    {
        get { return CountOutcomes(false); }
    }

    /// <summary>True when at least one resource was lost because the fetch time budget ran out.</summary>
    public bool BudgetExhausted
    {
        get { return _budgetExhausted; }
    }

    public Stream GetInputStreamByUrl(Uri url)
    {
        byte[] bytes = GetByteArrayByUrl(url);
        return bytes == null ? null : new MemoryStream(bytes, false);
    }

    public byte[] GetByteArrayByUrl(Uri url)
    {
        // iText calls this synchronously during layout, on the thread-pool thread running the conversion.
        return GetOrFetchAsync(url).GetAwaiter().GetResult();
    }

    /// <summary>
    /// Returns the image bytes of <paramref name="url"/>, or null when it is refused. The first call for a URL decides
    /// (and takes a slot of the image limit synchronously, so slots follow the order of first requests); later calls
    /// for the same URL return the same outcome.
    /// </summary>
    public Task<byte[]> GetOrFetchAsync(Uri url)
    {
        string key = url == null ? string.Empty : url.IsAbsoluteUri ? url.AbsoluteUri : url.OriginalString;
        Lazy<Task<byte[]>> outcome = _outcomes.GetOrAdd(key, _ => new Lazy<Task<byte[]>>(() => Start(url)));
        return outcome.Value;
    }

    public void Dispose()
    {
        _budget.Dispose();
    }

    private Task<byte[]> Start(Uri url)
    {
        if (!ExternalImageFetcher.IsAllowedUrl(url))
        {
            return Refused;
        }

        if (_budget.IsCancellationRequested)
        {
            _budgetExhausted = true;
            return Refused;
        }

        int maxBytes;
        lock (_sync)
        {
            long remainingBytes = _limits.MaxTotalImageBytes - _acceptedBytes;
            if (_slots >= _limits.MaxExternalImages || remainingBytes <= 0)
            {
                return Refused;
            }

            _slots++;
            maxBytes = (int)Math.Min(_maxImageBytes, remainingBytes);
        }

        return FetchAsync(url, maxBytes);
    }

    private async Task<byte[]> FetchAsync(Uri url, int maxBytes)
    {
        byte[] bytes = await _fetcher.FetchAsync(url, maxBytes, _budget.Token);
        if (bytes == null)
        {
            if (_budget.IsCancellationRequested)
            {
                _budgetExhausted = true;
            }

            return null;
        }

        if (!(StartsWith(bytes, PngSignature) || StartsWith(bytes, JpegSignature)))
        {
            return null;
        }

        // Concurrent fetches each saw the remaining total when they started; only accept what still fits.
        lock (_sync)
        {
            if (_acceptedBytes + bytes.Length > _limits.MaxTotalImageBytes)
            {
                return null;
            }

            _acceptedBytes += bytes.Length;
        }

        return bytes;
    }

    private int CountOutcomes(bool images)
    {
        int count = 0;
        foreach (Lazy<Task<byte[]>> outcome in _outcomes.Values)
        {
            if (outcome.IsValueCreated && outcome.Value.IsCompletedSuccessfully && (outcome.Value.Result != null) == images)
            {
                count++;
            }
        }

        return count;
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
