using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Models;
using PdfServices.API.Services;

namespace PdfServices.API.Functions;

public class CapabilityFunctions
{
    private readonly CapabilityService _capabilities;
    private readonly ILogger<CapabilityFunctions> _logger;

    public CapabilityFunctions(CapabilityService capabilities, ILogger<CapabilityFunctions> logger)
    {
        _capabilities = capabilities;
        _logger = logger;
    }

    /// <summary>Public price list, used by the website.</summary>
    [Function("ListCapabilities")]
    public Task<IActionResult> List([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/capabilities")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            List<CapabilityDocument> capabilities = await _capabilities.ListEnabledAsync();
            req.HttpContext.Response.Headers["Cache-Control"] = "public, max-age=300";
            return ApiResults.Ok(capabilities.ConvertAll(CapabilityResponse.From));
        });
    }
}
