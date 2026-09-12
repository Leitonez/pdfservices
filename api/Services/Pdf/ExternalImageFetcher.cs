using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Pdf;

/// <summary>
/// Downloads images referenced by customer HTML. Only https on port 443 is allowed and every connection
/// (including redirects) is checked at socket level against <see cref="IpAddressPolicy"/>, which also defeats DNS rebinding.
/// </summary>
public class ExternalImageFetcher
{
    private static readonly string[] AllowedContentTypes =
    {
        "image/png", "image/jpeg", "image/jpg", "image/pjpeg", "application/octet-stream", "binary/octet-stream"
    };

    private readonly HttpClient _client;
    private readonly TimeSpan _timeout;

    public ExternalImageFetcher(IOptions<Html2PdfOptions> options)
    {
        _timeout = TimeSpan.FromSeconds(options.Value.ExternalRequestTimeoutSeconds);

        SocketsHttpHandler handler = new SocketsHttpHandler
        {
            UseProxy = false,
            UseCookies = false,
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 3,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
            ConnectTimeout = TimeSpan.FromSeconds(5),
            ConnectCallback = ConnectAsync
        };

        _client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
        _client.DefaultRequestHeaders.UserAgent.ParseAdd("PdfServices/1.0 (+https://pdfservices.sistema.site)");
        _client.DefaultRequestHeaders.Accept.ParseAdd("image/png,image/jpeg;q=0.9,*/*;q=0.1");
    }

    public static bool IsAllowedUrl(Uri url)
    {
        return url != null
            && url.IsAbsoluteUri
            && url.Scheme == Uri.UriSchemeHttps
            && url.IsDefaultPort
            && string.IsNullOrEmpty(url.UserInfo)
            && !string.IsNullOrEmpty(url.Host);
    }

    /// <summary>Returns the response bytes, or null when the URL is not allowed, fails, or exceeds <paramref name="maxBytes"/>.</summary>
    public async Task<byte[]> FetchAsync(Uri url, int maxBytes)
    {
        if (!IsAllowedUrl(url) || maxBytes <= 0)
        {
            return null;
        }

        using (CancellationTokenSource cts = new CancellationTokenSource(_timeout))
        {
            try
            {
                using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url))
                using (HttpResponseMessage response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        return null;
                    }

                    MediaTypeHeaderValue contentType = response.Content.Headers.ContentType;
                    if (contentType != null && contentType.MediaType != null && !AllowedContentTypes.Contains(contentType.MediaType.ToLowerInvariant()))
                    {
                        return null;
                    }

                    long? length = response.Content.Headers.ContentLength;
                    if (length.HasValue && length.Value > maxBytes)
                    {
                        return null;
                    }

                    using (Stream stream = await response.Content.ReadAsStreamAsync(cts.Token))
                    using (MemoryStream buffer = new MemoryStream())
                    {
                        byte[] chunk = new byte[16 * 1024];
                        int read;
                        while ((read = await stream.ReadAsync(chunk, 0, chunk.Length, cts.Token)) > 0)
                        {
                            if (buffer.Length + read > maxBytes)
                            {
                                return null;
                            }

                            buffer.Write(chunk, 0, read);
                        }

                        return buffer.ToArray();
                    }
                }
            }
            catch (HttpRequestException)
            {
                return null;
            }
            catch (OperationCanceledException)
            {
                return null;
            }
            catch (IOException)
            {
                return null;
            }
        }
    }

    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext context, CancellationToken cancellationToken)
    {
        DnsEndPoint endPoint = context.DnsEndPoint;
        if (endPoint.Port != 443)
        {
            throw new HttpRequestException("Only port 443 is allowed.");
        }

        IPAddress[] addresses = IPAddress.TryParse(endPoint.Host, out IPAddress literal)
            ? new[] { literal }
            : await Dns.GetHostAddressesAsync(endPoint.Host, cancellationToken);

        if (addresses.Length == 0 || !addresses.All(IpAddressPolicy.IsPublic))
        {
            throw new HttpRequestException("The destination address is not allowed.");
        }

        Socket socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, endPoint.Port, cancellationToken);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }
}
