using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;

namespace PdfServices.API.Infrastructure;

/// <summary>Runs a function body translating <see cref="ApiException"/> and unexpected failures into JSON errors.</summary>
public static class ApiHandler
{
    public static async Task<IActionResult> RunAsync(ILogger logger, Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (ApiException ex)
        {
            return ApiResults.Error(ex.StatusCode, ex.Code, ex.Message, ex.Fields);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("Request cancelled by the client.");
            return new StatusCodeResult(499);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Cosmos DB request failed: HTTP {StatusCode}/{SubStatusCode}.", (int)ex.StatusCode, ex.SubStatusCode);
            return ApiResults.Error(500, "internal_error", "Ocorreu um erro inesperado. Tente novamente em instantes.");
        }
        catch (Exception ex)
        {
            // Safe to log in full: html2pdf conversion failures (whose messages could echo customer content)
            // are caught inside Html2PdfFunction and never reach this handler.
            logger.LogError(ex, "Unhandled {ExceptionType}.", ex.GetType().FullName);
            return ApiResults.Error(500, "internal_error", "Ocorreu um erro inesperado. Tente novamente em instantes.");
        }
    }
}
