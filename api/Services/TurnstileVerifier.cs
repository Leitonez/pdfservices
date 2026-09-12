using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;
using PdfServices.API.Infrastructure;

namespace PdfServices.API.Services;

/// <summary>Server side validation of Cloudflare Turnstile tokens.</summary>
public class TurnstileVerifier
{
    public const string SignupAction = "signup";
    public const string LoginAction = "login";
    public const string ResendAction = "resend";
    public const string ForgotAction = "forgot";

    private readonly HttpClient _http;
    private readonly TurnstileOptions _options;
    private readonly ILogger<TurnstileVerifier> _logger;
    private readonly string[] _allowedHostnames;

    public TurnstileVerifier(HttpClient http, IOptions<TurnstileOptions> options, ILogger<TurnstileVerifier> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
        _allowedHostnames = (_options.AllowedHostnames ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    public async Task VerifyAsync(string token, string expectedAction, HttpRequest request)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048)
        {
            throw Failed();
        }

        if (string.IsNullOrWhiteSpace(_options.SecretKey))
        {
            _logger.LogError("Turnstile:SecretKey is not configured.");
            throw Unavailable();
        }

        Dictionary<string, string> form = new Dictionary<string, string>
        {
            { "secret", _options.SecretKey },
            { "response", token }
        };

        string ip = ClientIp.Get(request);
        if (ip != null)
        {
            form["remoteip"] = ip;
        }

        SiteVerifyResponse result;
        try
        {
            using (HttpResponseMessage response = await _http.PostAsync(_options.VerifyUrl, new FormUrlEncodedContent(form), request.HttpContext.RequestAborted))
            {
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Turnstile siteverify returned HTTP {StatusCode}.", (int)response.StatusCode);
                    throw Unavailable();
                }

                result = await response.Content.ReadFromJsonAsync<SiteVerifyResponse>();
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning("Turnstile siteverify request failed: {Message}", ex.Message);
            throw Unavailable();
        }

        if (result == null || !result.Success)
        {
            _logger.LogInformation("Turnstile rejected a token: {Codes}", result == null || result.ErrorCodes == null ? "-" : string.Join(",", result.ErrorCodes));
            throw Failed();
        }

        if (_allowedHostnames.Length > 0)
        {
            if (!_allowedHostnames.Contains(result.Hostname, StringComparer.OrdinalIgnoreCase) || !string.Equals(result.Action, expectedAction, StringComparison.Ordinal))
            {
                _logger.LogWarning("Turnstile token for hostname {Hostname} and action {Action} was rejected.", result.Hostname, result.Action);
                throw Failed();
            }
        }
    }

    private static ApiException Failed()
    {
        return new ApiException(400, "bot_check_failed", "Não foi possível confirmar que você não é um robô. Recarregue a página e tente novamente.");
    }

    private static ApiException Unavailable()
    {
        return new ApiException(503, "bot_check_unavailable", "A verificação anti-robô está indisponível no momento. Tente novamente em instantes.");
    }

    private class SiteVerifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("error-codes")]
        public string[] ErrorCodes { get; set; }

        [JsonPropertyName("hostname")]
        public string Hostname { get; set; }

        [JsonPropertyName("action")]
        public string Action { get; set; }
    }
}
