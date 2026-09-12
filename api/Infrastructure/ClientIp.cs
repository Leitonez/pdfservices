using System.Net;
using Microsoft.AspNetCore.Http;

namespace PdfServices.API.Infrastructure;

public static class ClientIp
{
    /// <summary>Client IP as seen by the Azure Functions front end (X-Forwarded-For), without the port.</summary>
    public static string Get(HttpRequest request)
    {
        string forwarded = request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            string first = forwarded.Split(',')[0].Trim();
            if (IPEndPoint.TryParse(first, out IPEndPoint endPoint))
            {
                return endPoint.Address.ToString();
            }

            if (IPAddress.TryParse(first, out IPAddress address))
            {
                return address.ToString();
            }
        }

        IPAddress remote = request.HttpContext.Connection.RemoteIpAddress;
        return remote == null ? null : remote.ToString();
    }
}
