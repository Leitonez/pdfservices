using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
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
        catch (Exception ex)
        {
            // Only the exception type is logged: messages may echo parts of customer content.
            logger.LogError("Unhandled {ExceptionType} at {StackTrace}", ex.GetType().FullName, ex.StackTrace);
            return ApiResults.Error(500, "internal_error", "Ocorreu um erro inesperado. Tente novamente em instantes.");
        }
    }
}
