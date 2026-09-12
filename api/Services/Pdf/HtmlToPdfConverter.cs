using System;
using System.IO;
using iText.Html2pdf;
using iText.Kernel.Pdf;
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

    public ConversionResult Convert(string html)
    {
        SafeImageResourceRetriever retriever = new SafeImageResourceRetriever(_fetcher, _options);
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
                BlockedResources = retriever.BlockedCount
            };
        }
    }

    public class ConversionResult
    {
        public byte[] Pdf { get; set; }

        public int ExternalImages { get; set; }

        public int BlockedResources { get; set; }
    }
}
