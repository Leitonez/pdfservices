using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Data;

/// <summary>Creates the database, containers and default settings when they do not exist. Idempotent.</summary>
public class CosmosInitializer
{
    private readonly CosmosClient _client;
    private readonly CosmosOptions _options;
    private readonly ILogger<CosmosInitializer> _logger;

    public CosmosInitializer(CosmosClient client, IOptions<CosmosOptions> options, ILogger<CosmosInitializer> logger)
    {
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        DatabaseResponse databaseResponse = await _client.CreateDatabaseIfNotExistsAsync(_options.DatabaseName);
        Database database = databaseResponse.Database;

        // TTL enabled without a default so only documents with a "ttl" field (access logs) expire.
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(ContainerNames.Accounts, "/accountId") { DefaultTimeToLive = -1 });
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(ContainerNames.Emails, "/id"));
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(ContainerNames.ApiKeys, "/id"));
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(ContainerNames.Tokens, "/id") { DefaultTimeToLive = -1 });
        await database.CreateContainerIfNotExistsAsync(new ContainerProperties(ContainerNames.Settings, "/id"));

        Container settings = database.GetContainer(ContainerNames.Settings);
        CapabilityDocument html2pdf = new CapabilityDocument
        {
            Id = CapabilityDocument.BuildId(Capabilities.Html2Pdf),
            Name = Capabilities.Html2Pdf,
            DisplayName = "HTML para PDF",
            Description = "Converte um documento HTML em PDF.",
            Price = 0.001m,
            Currency = "BRL",
            Enabled = true,
            UpdatedAt = DateTime.UtcNow
        };

        try
        {
            await settings.CreateItemAsync(html2pdf, new PartitionKey(html2pdf.Id));
            _logger.LogInformation("Seeded capability {Capability}.", html2pdf.Name);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            // Already configured: the price in the database is the source of truth.
        }

        _logger.LogInformation("Cosmos DB database {Database} is ready.", _options.DatabaseName);
    }
}
