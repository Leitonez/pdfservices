using System.Net;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Services.Email;

/// <summary>Transactional e-mails (pt-BR). Tokens travel in the URL fragment so they never reach server logs.</summary>
public class EmailTemplates
{
    private readonly AppUrlsOptions _urls;

    public EmailTemplates(IOptions<AppUrlsOptions> urls)
    {
        _urls = urls.Value;
    }

    public EmailMessage EmailVerification(string to, string name, string token, int validHours)
    {
        string link = _urls.AdminUrl.TrimEnd('/') + "/verificar-email/#token=" + token;
        string greeting = Greeting(name);
        return new EmailMessage
        {
            To = to,
            Subject = "Confirme seu e-mail - PDF Services",
            Text = greeting + "\n\nConfirme seu e-mail para ativar sua conta no PDF Services:\n" + link +
                   "\n\nO link é válido por " + validHours + " horas e pode ser usado uma única vez." +
                   "\nSe você não criou esta conta, ignore esta mensagem.",
            Html = Layout(
                "Confirme seu e-mail",
                "<p>" + Encode(greeting) + "</p>" +
                "<p>Falta pouco! Confirme seu e-mail para ativar sua conta no PDF Services.</p>" +
                Button(link, "Confirmar e-mail") +
                "<p style=\"color:#64748b;font-size:13px\">O link é válido por " + validHours + " horas e pode ser usado uma única vez. " +
                "Se você não criou esta conta, ignore esta mensagem.</p>")
        };
    }

    public EmailMessage PasswordReset(string to, string name, string token, int validMinutes)
    {
        string link = _urls.AdminUrl.TrimEnd('/') + "/redefinir-senha/#token=" + token;
        string greeting = Greeting(name);
        return new EmailMessage
        {
            To = to,
            Subject = "Redefinição de senha - PDF Services",
            Text = greeting + "\n\nRecebemos um pedido para redefinir a senha da sua conta no PDF Services:\n" + link +
                   "\n\nO link é válido por " + validMinutes + " minutos e pode ser usado uma única vez." +
                   "\nSe você não fez este pedido, ignore esta mensagem: sua senha continua a mesma.",
            Html = Layout(
                "Redefinição de senha",
                "<p>" + Encode(greeting) + "</p>" +
                "<p>Recebemos um pedido para redefinir a senha da sua conta no PDF Services.</p>" +
                Button(link, "Redefinir senha") +
                "<p style=\"color:#64748b;font-size:13px\">O link é válido por " + validMinutes + " minutos e pode ser usado uma única vez. " +
                "Se você não fez este pedido, ignore esta mensagem: sua senha continua a mesma.</p>")
        };
    }

    public EmailMessage PasswordChanged(string to, string name)
    {
        string link = _urls.AdminUrl.TrimEnd('/') + "/esqueci-senha/";
        string greeting = Greeting(name);
        return new EmailMessage
        {
            To = to,
            Subject = "Sua senha foi alterada - PDF Services",
            Text = greeting + "\n\nA senha da sua conta no PDF Services foi alterada e as sessões abertas foram encerradas." +
                   "\nSe não foi você, redefina sua senha imediatamente: " + link,
            Html = Layout(
                "Sua senha foi alterada",
                "<p>" + Encode(greeting) + "</p>" +
                "<p>A senha da sua conta no PDF Services foi alterada e as sessões abertas foram encerradas.</p>" +
                "<p>Se não foi você, redefina sua senha imediatamente.</p>" +
                Button(link, "Redefinir senha"))
        };
    }

    public EmailMessage SignupWithExistingEmail(string to)
    {
        string login = _urls.AdminUrl.TrimEnd('/') + "/login/";
        string forgot = _urls.AdminUrl.TrimEnd('/') + "/esqueci-senha/";
        return new EmailMessage
        {
            To = to,
            Subject = "Tentativa de cadastro - PDF Services",
            Text = "Olá,\n\nAlguém tentou criar uma conta no PDF Services com este e-mail, mas ele já está cadastrado." +
                   "\nSe foi você, acesse sua conta: " + login + "\nEsqueceu a senha? " + forgot +
                   "\nSe não foi você, ignore esta mensagem.",
            Html = Layout(
                "Este e-mail já tem uma conta",
                "<p>Olá,</p>" +
                "<p>Alguém tentou criar uma conta no PDF Services com este e-mail, mas ele já está cadastrado.</p>" +
                Button(login, "Acessar minha conta") +
                "<p style=\"color:#64748b;font-size:13px\">Esqueceu a senha? <a href=\"" + forgot + "\" style=\"color:#7c3aed\">Redefina aqui</a>. " +
                "Se não foi você, ignore esta mensagem.</p>")
        };
    }

    private static string Greeting(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Olá,";
        }

        return "Olá, " + name.Trim().Split(' ')[0] + "!";
    }

    private static string Encode(string value)
    {
        return WebUtility.HtmlEncode(value);
    }

    private static string Button(string href, string label)
    {
        return "<p style=\"margin:28px 0\"><a href=\"" + href + "\" style=\"background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block\">" +
               Encode(label) + "</a></p>" +
               "<p style=\"color:#64748b;font-size:12px;word-break:break-all\">Se o botão não funcionar, copie e cole no navegador:<br>" + Encode(href) + "</p>";
    }

    private string Layout(string title, string content)
    {
        return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>" + Encode(title) + "</title></head>" +
               "<body style=\"margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a\">" +
               "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f1f5f9;padding:32px 12px\"><tr><td align=\"center\">" +
               "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden\">" +
               "<tr><td style=\"background:#0f172a;padding:20px 28px;color:#f1f5f9;font-size:18px;font-weight:700\">PDF Services <span style=\"color:#a78bfa;font-weight:500\">by CODECYCLE</span></td></tr>" +
               "<tr><td style=\"padding:28px;font-size:15px;line-height:1.6\"><h1 style=\"font-size:20px;margin:0 0 16px\">" + Encode(title) + "</h1>" + content + "</td></tr>" +
               "<tr><td style=\"padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5\">" +
               "Mensagem automática, não responda. PDF Services é software livre (AGPL v3): " +
               "<a href=\"" + _urls.SourceCodeUrl + "\" style=\"color:#7c3aed\">" + Encode(_urls.SourceCodeUrl) + "</a></td></tr>" +
               "</table></td></tr></table></body></html>";
    }
}
