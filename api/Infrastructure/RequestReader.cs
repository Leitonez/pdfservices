using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace PdfServices.API.Infrastructure;

public static class RequestReader
{
    /// <summary>Default limit for the small JSON bodies sent by the portal.</summary>
    public const int DefaultJsonLimit = 16 * 1024;

    /// <summary>Reads the request body, failing with 413 as soon as it exceeds <paramref name="maxBytes"/>.</summary>
    public static async Task<byte[]> ReadBodyAsync(HttpRequest request, int maxBytes, CancellationToken cancellationToken)
    {
        if (request.ContentLength.HasValue && request.ContentLength.Value > maxBytes)
        {
            throw PayloadTooLarge(maxBytes);
        }

        using (MemoryStream buffer = new MemoryStream())
        {
            byte[] chunk = new byte[16 * 1024];
            int read;
            while ((read = await request.Body.ReadAsync(chunk, 0, chunk.Length, cancellationToken)) > 0)
            {
                if (buffer.Length + read > maxBytes)
                {
                    throw PayloadTooLarge(maxBytes);
                }

                buffer.Write(chunk, 0, read);
            }

            return buffer.ToArray();
        }
    }

    public static async Task<T> ReadJsonAsync<T>(HttpRequest request, int maxBytes = DefaultJsonLimit) where T : class
    {
        byte[] body = await ReadBodyAsync(request, maxBytes, request.HttpContext.RequestAborted);
        if (body.Length == 0)
        {
            throw new ApiException(400, "invalid_body", "O corpo da requisição está vazio.");
        }

        T value;
        try
        {
            value = JsonSerializer.Deserialize<T>(body, ApiResults.ReadOptions);
        }
        catch (JsonException)
        {
            throw new ApiException(400, "invalid_json", "O corpo da requisição não é um JSON válido.");
        }

        if (value == null)
        {
            throw new ApiException(400, "invalid_body", "O corpo da requisição está vazio.");
        }

        return value;
    }

    private static ApiException PayloadTooLarge(int maxBytes)
    {
        string limit = maxBytes >= 1024 * 1024
            ? (maxBytes / (1024 * 1024)) + " MB"
            : Math.Max(1, maxBytes / 1024) + " KB";
        return new ApiException(413, "payload_too_large", "O corpo da requisição excede o limite de " + limit + ".");
    }
}
