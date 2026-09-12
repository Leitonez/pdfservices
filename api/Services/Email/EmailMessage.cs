using System.Threading.Tasks;

namespace PdfServices.API.Services.Email;

public class EmailMessage
{
    public string To { get; set; }

    public string Subject { get; set; }

    public string Text { get; set; }

    public string Html { get; set; }
}

public interface IEmailSender
{
    Task SendAsync(EmailMessage message);
}
