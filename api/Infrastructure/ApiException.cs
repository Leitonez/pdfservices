using System;
using System.Collections.Generic;

namespace PdfServices.API.Infrastructure;

/// <summary>An expected error that is returned to the client as a JSON error response.</summary>
public class ApiException : Exception
{
    public ApiException(int statusCode, string code, string message)
        : this(statusCode, code, message, null)
    {
    }

    public ApiException(int statusCode, string code, string message, IDictionary<string, string> fields)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        Fields = fields;
    }

    public int StatusCode { get; }

    public string Code { get; }

    /// <summary>Validation messages per request field, when applicable.</summary>
    public IDictionary<string, string> Fields { get; }
}
