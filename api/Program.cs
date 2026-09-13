using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Azure.Monitor.OpenTelemetry.Exporter;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Azure.Functions.Worker.OpenTelemetry;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using PdfServices.API.Configuration;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Services;
using PdfServices.API.Services.Email;
using PdfServices.API.Services.Pdf;

namespace PdfServices.API;

public class Program
{
    public static async Task Main(string[] args)
    {
        FunctionsApplicationBuilder builder = FunctionsApplication.CreateBuilder(args);

        builder.ConfigureFunctionsWebApplication();
        builder.UseMiddleware<ResponseHeadersMiddleware>();

        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
        {
            builder.Services.AddOpenTelemetry()
                .UseFunctionsWorkerDefaults()
                .UseAzureMonitorExporter();
        }

        ConfigureServices(builder.Services, builder.Configuration);

        IHost host = builder.Build();

        CosmosOptions cosmosOptions = host.Services.GetRequiredService<IOptions<CosmosOptions>>().Value;
        if (cosmosOptions.InitializeOnStartup)
        {
            try
            {
                await host.Services.GetRequiredService<CosmosInitializer>().InitializeAsync();
            }
            catch (Exception ex)
            {
                // Never keep the worker from starting (e.g. a transient Cosmos DB error on a cold start).
                host.Services.GetRequiredService<ILogger<Program>>().LogError(ex, "Cosmos DB initialization failed.");
            }
        }

        await host.RunAsync();
    }

    private static void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<CosmosOptions>(configuration.GetSection(CosmosOptions.SectionName));
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        services.Configure<TurnstileOptions>(configuration.GetSection(TurnstileOptions.SectionName));
        services.Configure<MailgunOptions>(configuration.GetSection(MailgunOptions.SectionName));
        services.Configure<AppUrlsOptions>(configuration.GetSection(AppUrlsOptions.SectionName));
        services.Configure<Html2PdfOptions>(configuration.GetSection(Html2PdfOptions.SectionName));

        services.AddSingleton(provider =>
        {
            CosmosOptions options = provider.GetRequiredService<IOptions<CosmosOptions>>().Value;
            if (string.IsNullOrWhiteSpace(options.ConnectionString))
            {
                throw new InvalidOperationException("Cosmos:ConnectionString is not configured.");
            }

            return new CosmosClient(options.ConnectionString, new CosmosClientOptions
            {
                ApplicationName = "PdfServices.API",
                UseSystemTextJsonSerializerWithOptions = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                }
            });
        });

        services.AddSingleton<CosmosContext>();
        services.AddSingleton<CosmosInitializer>();
        services.AddSingleton<AccountStore>();
        services.AddSingleton<OneTimeTokenStore>();
        services.AddSingleton<CapabilityService>();
        services.AddSingleton<BillingService>();
        services.AddSingleton<JwtTokenService>();
        services.AddSingleton<UserAuthenticator>();
        services.AddSingleton<ApiKeyAuthenticator>();
        services.AddSingleton<EmailTemplates>();
        services.AddSingleton<ExternalImageFetcher>();
        services.AddSingleton<HtmlToPdfConverter>();

        services.AddHttpClient<TurnstileVerifier>(client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddHttpClient<IEmailSender, MailgunEmailSender>(client => client.Timeout = TimeSpan.FromSeconds(15));
        services.AddTransient<AccountMailer>();
    }
}
