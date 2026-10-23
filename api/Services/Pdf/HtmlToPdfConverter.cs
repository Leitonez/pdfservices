using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using iText.Html2pdf;
using iText.Kernel.Pdf;
using iText.StyledXmlParser.Jsoup;
using iText.StyledXmlParser.Jsoup.Nodes;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Pdf;

/// <summary>
/// HTML to PDF conversion with iText pdfHTML. Works entirely in memory: nothing is written to disk or logged.
/// iText's own logger is left unconfigured (no-op) because its messages may contain fragments of the document.
/// </summary>
public class HtmlToPdfConverter
{
    private readonly ExternalImageFetcher _fetcher;
    private readonly Html2PdfOptions _options;

    public HtmlToPdfConverter(ExternalImageFetcher fetcher, IOptions<Html2PdfOptions> options)
    {
        _fetcher = fetcher;
        _options = options.Value;
    }

    /// <summary>
    /// Fetches the document's &lt;img src&gt; images ahead of layout (pdfHTML asks for resources one at a time,
    /// synchronously), then converts. Resources pdfHTML asks for later are fetched on demand within the same limits.
    /// </summary>
    public async Task<ConversionResult> ConvertAsync(string html, Html2PdfLimits limits)
    {
        using (SafeImageResourceRetriever retriever = new SafeImageResourceRetriever(_fetcher, _options, limits))
        {
            if (_options.PrefetchConcurrency > 0)
            {
                await PrefetchImagesAsync(html, retriever);
            }

            return await Task.Run(() => Convert(html, retriever));
        }
    }

    private ConversionResult Convert(string html, SafeImageResourceRetriever retriever)
    {
        ConverterProperties properties = new ConverterProperties();
        properties.SetResourceRetriever(retriever);

        using (MemoryStream output = new MemoryStream())
        {
            PdfWriter writer = new PdfWriter(output, new WriterProperties().SetFullCompressionMode(true));
            PdfDocument pdf = new PdfDocument(writer);

            // iText AGPL appends its own identification to this value.
            pdf.GetDocumentInfo().SetProducer(_options.Producer);

            try
            {
                HtmlConverter.ConvertToPdf(html, pdf, properties);
            }
            finally
            {
                if (!pdf.IsClosed())
                {
                    try
                    {
                        pdf.Close();
                    }
                    catch (Exception)
                    {
                        // The original conversion error is the relevant one.
                    }
                }
            }

            return new ConversionResult
            {
                Pdf = output.ToArray(),
                ExternalImages = retriever.FetchedCount,
                BlockedResources = retriever.BlockedCount,
                FetchBudgetExhausted = retriever.BudgetExhausted
            };
        }
    }

    /// <summary>
    /// Requests the distinct https &lt;img src&gt; URLs in document order, a few at a time. Each request takes its
    /// slot of the image limit before the next one starts, so when there are too many images the first ones win.
    /// </summary>
    private async Task PrefetchImagesAsync(string html, SafeImageResourceRetriever retriever)
    {
        List<Uri> urls = FindImageUrls(html);
        if (urls.Count == 0)
        {
            return;
        }

        List<Task> pending = new List<Task>();
        using (SemaphoreSlim concurrency = new SemaphoreSlim(_options.PrefetchConcurrency))
        {
            foreach (Uri url in urls)
            {
                await concurrency.WaitAsync();
                pending.Add(PrefetchAsync(url, retriever, concurrency));
            }

            await Task.WhenAll(pending);
        }
    }

    private static async Task PrefetchAsync(Uri url, SafeImageResourceRetriever retriever, SemaphoreSlim concurrency)
    {
        try
        {
            await retriever.GetOrFetchAsync(url);
        }
        finally
        {
            concurrency.Release();
        }
    }

    private static List<Uri> FindImageUrls(string html)
    {
        List<Uri> urls = new List<Uri>();
        HashSet<string> seen = new HashSet<string>(StringComparer.Ordinal);
        Document document = Jsoup.Parse(html);
        foreach (Element image in document.Select("img[src]"))
        {
            // Only URLs the retriever would fetch: data: URIs, relative paths and refused schemes are left to pdfHTML.
            if (Uri.TryCreate(image.Attr("src").Trim(), UriKind.Absolute, out Uri url)
                && ExternalImageFetcher.IsAllowedUrl(url)
                && seen.Add(url.AbsoluteUri))
            {
                urls.Add(url);
            }
        }

        return urls;
    }

    public class ConversionResult
    {
        public byte[] Pdf { get; set; }

        public int ExternalImages { get; set; }

        public int BlockedResources { get; set; }

        public bool FetchBudgetExhausted { get; set; }
    }
}
