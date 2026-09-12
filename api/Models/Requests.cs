namespace PdfServices.API.Models;

public class SignupRequest
{
    public string Name { get; set; }

    public string CompanyName { get; set; }

    public string Cnpj { get; set; }

    public string Email { get; set; }

    public string Password { get; set; }

    public bool AcceptTerms { get; set; }

    public string TurnstileToken { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; }

    public string Password { get; set; }

    public string TurnstileToken { get; set; }
}

public class EmailRequest
{
    public string Email { get; set; }

    public string TurnstileToken { get; set; }
}

public class TokenRequest
{
    public string Token { get; set; }
}

public class ResetPasswordRequest
{
    public string Token { get; set; }

    public string Password { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; }

    public string NewPassword { get; set; }
}

public class DeleteAccountRequest
{
    public string Password { get; set; }
}

public class CreateApiKeyRequest
{
    public string Name { get; set; }
}
