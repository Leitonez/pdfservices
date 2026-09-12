using System.Collections.Generic;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace PdfServices.API.Infrastructure;

public static class ApiResults
{
    public static readonly JsonSerializerOptions WriteOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // Responses are application/json (never embedded in HTML), so accents can be written as plain UTF-8.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static readonly JsonSerializerOptions ReadOptions = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    };

    public static IActionResult Json(int statusCode, object value)
    {
        return new ContentResult
        {
            StatusCode = statusCode,
            ContentType = "application/json; charset=utf-8",
            Content = JsonSerializer.Serialize(value, WriteOptions)
        };
    }

    public static IActionResult Ok(object value)
    {
        return Json(200, value);
    }

    public static IActionResult Message(int statusCode, string message)
    {
        return Json(statusCode, new MessageResponse { Message = message });
    }

    public static IActionResult Error(int statusCode, string code, string message, IDictionary<string, string> fields = null)
    {
        return Json(statusCode, new ErrorResponse { Error = code, Message = message, Fields = fields });
    }

    public class MessageResponse
    {
        public string Message { get; set; }
    }

    public class ErrorResponse
    {
        public string Error { get; set; }

        public string Message { get; set; }

        public IDictionary<string, string> Fields { get; set; }
    }
}
