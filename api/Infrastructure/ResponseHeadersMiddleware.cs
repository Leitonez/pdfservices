using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Infrastructure;

/// <summary>
/// Headers added to every HTTP response:
/// <list type="bullet">
/// <item>X-Source-Code / X-License: AGPL v3 section 13, users interacting with the service over a network must be offered the source code.</item>
/// <item>Access-Control-Expose-Headers: lets browser clients (such as the panel's "Executar Teste" page) read the billing headers.
/// The allowed origins themselves come from the Function App CORS settings.</item>
/// </list>
/// </summary>
public class ResponseHeadersMiddleware : IFunctionsWorkerMiddleware
{
    public const string ExposedHeaders = "X-Transaction-Id, X-Charged-Amount, X-Balance, X-Blocked-Resources, X-Source-Code, X-License";

    private readonly string _sourceCodeUrl;

    public ResponseHeadersMiddleware(IOptions<AppUrlsOptions> urls)
    {
        _sourceCodeUrl = urls.Value.SourceCodeUrl;
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        HttpContext httpContext = context.GetHttpContext();
        if (httpContext != null)
        {
            httpContext.Response.Headers["X-Source-Code"] = _sourceCodeUrl;
            httpContext.Response.Headers["X-License"] = "AGPL-3.0-or-later";
            httpContext.Response.Headers["Access-Control-Expose-Headers"] = ExposedHeaders;
        }

        await next(context);
    }
}
