using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace PdfServices.API.Functions;

public class Ping
{
    [Function("Ping")]
    public IActionResult Run([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ping")] HttpRequest req)
    {
        return new ContentResult { StatusCode = 200, ContentType = "text/plain; charset=utf-8", Content = "pong" };
    }
}
