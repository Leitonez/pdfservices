using System;
using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Services;
using PdfServices.API.Services.Pdf;

namespace PdfServices.API.Functions;

/// <summary>
/// POST v1/html2pdf/{format}, authenticated by X-Api-Key.
/// format "json": body {"html": "..."}; format "html": the HTML document itself is the body.
/// The HTML and the PDF only live in memory during the request: they are never stored or logged.
/// </summary>
public class Html2PdfFunction
{
    private readonly ApiKeyAuthenticator _apiKeys;
    private readonly CapabilityService _capabilities;
    private readonly BillingService _billing;
    private readonly HtmlToPdfConverter _converter;
    private readonly Html2PdfOptions _options;
    private readonly ILogger<Html2PdfFunction> _logger;

    public Html2PdfFunction(
        ApiKeyAuthenticator apiKeys,
        CapabilityService capabilities,
        BillingService billing,
        HtmlToPdfConverter converter,
        IOptions<Html2PdfOptions> options,
        ILogger<Html2PdfFunction> logger)
    {
        _apiKeys = apiKeys;
        _capabilities = capabilities;
        _billing = billing;
        _converter = converter;
        _options = options.Value;
        _logger = logger;
    }

    [Function("Html2Pdf")]
    public Task<IActionResult> Run([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/html2pdf/{format}")] HttpRequest req, string format)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            string normalizedFormat = (format ?? string.Empty).ToLowerInvariant();
            if (normalizedFormat != "json" && normalizedFormat != "html")
            {
                throw new ApiException(400, "invalid_format", "Formato inválido. Use /v1/html2pdf/json ou /v1/html2pdf/html.");
            }

            ApiKeyDocument apiKey = await _apiKeys.AuthenticateAsync(req);

            CapabilityDocument capability = await _capabilities.GetAsync(Capabilities.Html2Pdf);
            if (capability == null || !capability.Enabled)
            {
                throw new ApiException(503, "capability_unavailable", "Serviço temporariamente indisponível.");
            }

            byte[] body = await RequestReader.ReadBodyAsync(req, _options.MaxRequestBytes, req.HttpContext.RequestAborted);
            string html = normalizedFormat == "json" ? ReadHtmlFromJson(body) : DecodeHtml(body, req.ContentType);
            if (string.IsNullOrWhiteSpace(html))
            {
                throw new ApiException(400, "empty_html", "O HTML está vazio.");
            }

            await _billing.EnsureCanAffordAsync(apiKey.AccountId, capability.Price);

            Stopwatch stopwatch = Stopwatch.StartNew();
            HtmlToPdfConverter.ConversionResult result;
            try
            {
                result = await Task.Run(() => _converter.Convert(html));
            }
            catch (Exception ex) when (!(ex is ApiException) && !(ex is OperationCanceledException))
            {
                _logger.LogWarning("html2pdf conversion failed with {ExceptionType}.", ex.GetType().FullName);
                throw new ApiException(422, "conversion_failed", "Não foi possível converter o HTML em PDF. Verifique se o documento é válido. Nada foi cobrado.");
            }

            stopwatch.Stop();

            BillingService.ChargeResult charge = await _billing.ChargeAsync(new BillingService.ChargeRequest
            {
                ApiKey = apiKey,
                Capability = capability,
                ClientIp = ClientIp.Get(req),
                InputBytes = body.Length,
                OutputBytes = result.Pdf.Length,
                DurationMs = stopwatch.ElapsedMilliseconds
            });

            IHeaderDictionary headers = req.HttpContext.Response.Headers;
            headers["X-Transaction-Id"] = charge.TransactionId;
            headers["X-Charged-Amount"] = charge.Amount.ToString(CultureInfo.InvariantCulture);
            headers["X-Balance"] = charge.BalanceAfter.ToString(CultureInfo.InvariantCulture);
            headers["X-Blocked-Resources"] = result.BlockedResources.ToString(CultureInfo.InvariantCulture);
            headers["Content-Disposition"] = "inline; filename=\"document.pdf\"";

            _logger.LogInformation(
                "html2pdf account {AccountId}: {InputBytes} B in, {OutputBytes} B out, {DurationMs} ms, {ExternalImages} external images, {BlockedResources} blocked.",
                apiKey.AccountId, body.Length, result.Pdf.Length, stopwatch.ElapsedMilliseconds, result.ExternalImages, result.BlockedResources);

            return new FileContentResult(result.Pdf, "application/pdf");
        });
    }

    private static string ReadHtmlFromJson(byte[] body)
    {
        try
        {
            using (JsonDocument document = JsonDocument.Parse(body))
            {
                if (document.RootElement.ValueKind != JsonValueKind.Object
                    || !document.RootElement.TryGetProperty("html", out JsonElement html)
                    || html.ValueKind != JsonValueKind.String)
                {
                    throw new ApiException(400, "invalid_body", "Envie um JSON no formato {\"html\": \"...\"}.");
                }

                return html.GetString();
            }
        }
        catch (JsonException)
        {
            throw new ApiException(400, "invalid_json", "O corpo da requisição não é um JSON válido.");
        }
    }

    private static string DecodeHtml(byte[] body, string contentType)
    {
        Encoding encoding = Encoding.UTF8;
        if (MediaTypeHeaderValue.TryParse(contentType, out MediaTypeHeaderValue mediaType) && !string.IsNullOrEmpty(mediaType.CharSet))
        {
            try
            {
                encoding = Encoding.GetEncoding(mediaType.CharSet.Trim('"'));
            }
            catch (ArgumentException)
            {
                throw new ApiException(415, "unsupported_charset", "Charset não suportado. Envie o HTML em UTF-8.");
            }
        }

        return encoding.GetString(body).TrimStart('\uFEFF');
    }
}
