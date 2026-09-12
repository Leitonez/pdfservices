using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Email;

/// <summary>Sends transactional e-mails through the Mailgun HTTP API.</summary>
public class MailgunEmailSender : IEmailSender
{
    private readonly HttpClient _http;
    private readonly MailgunOptions _options;
    private readonly ILogger<MailgunEmailSender> _logger;

    public MailgunEmailSender(HttpClient http, IOptions<MailgunOptions> options, ILogger<MailgunEmailSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.Domain))
        {
            _logger.LogError("Mailgun is not configured; e-mail \"{Subject}\" was not sent.", message.Subject);
            throw new InvalidOperationException("Mailgun is not configured.");
        }

        Dictionary<string, string> form = new Dictionary<string, string>
        {
            { "from", _options.FromName + " <" + _options.FromAddress + ">" },
            { "to", message.To },
            { "subject", message.Subject },
            { "text", message.Text },
            { "html", message.Html },
            // Links carry one-time tokens: they must not be rewritten by click tracking.
            { "o:tracking", "no" },
            { "o:tracking-clicks", "no" },
            { "o:tracking-opens", "no" }
        };

        if (_options.TestMode)
        {
            form["o:testmode"] = "yes";
        }

        string url = _options.BaseUrl.TrimEnd('/') + "/v3/" + Uri.EscapeDataString(_options.Domain) + "/messages";
        using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, url))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes("api:" + _options.ApiKey)));
            request.Content = new FormUrlEncodedContent(form);

            using (HttpResponseMessage response = await _http.SendAsync(request))
            {
                if (!response.IsSuccessStatusCode)
                {
                    string body = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Mailgun returned HTTP {StatusCode}: {Body}", (int)response.StatusCode, body);
                    throw new InvalidOperationException("Mailgun returned HTTP " + (int)response.StatusCode + ".");
                }
            }
        }

        if (_options.TestMode)
        {
            // Test mode only (never delivered): lets developers follow the links locally.
            _logger.LogWarning("Mailgun TEST MODE - e-mail accepted but not delivered. To: {To} Subject: {Subject}\n{Text}", message.To, message.Subject, message.Text);
        }
        else
        {
            _logger.LogInformation("E-mail \"{Subject}\" sent.", message.Subject);
        }
    }
}
