using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Infrastructure;

/// <summary>
/// AGPL v3 section 13: users interacting with the service over a network must be offered the source code.
/// Every HTTP response points to the public repository.
/// </summary>
public class SourceCodeHeaderMiddleware : IFunctionsWorkerMiddleware
{
    private readonly string _sourceCodeUrl;

    public SourceCodeHeaderMiddleware(IOptions<AppUrlsOptions> urls)
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
        }

        await next(context);
    }
}
