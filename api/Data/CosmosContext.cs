using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using PdfServices.API.Configuration;

namespace PdfServices.API.Data;

public class CosmosContext
{
    public CosmosContext(CosmosClient client, IOptions<CosmosOptions> options)
    {
        Client = client;
        Database = client.GetDatabase(options.Value.DatabaseName);
        Accounts = Database.GetContainer(ContainerNames.Accounts);
        Emails = Database.GetContainer(ContainerNames.Emails);
        ApiKeys = Database.GetContainer(ContainerNames.ApiKeys);
        Tokens = Database.GetContainer(ContainerNames.Tokens);
        Settings = Database.GetContainer(ContainerNames.Settings);
    }

    public CosmosClient Client { get; }

    public Database Database { get; }

    public Container Accounts { get; }

    public Container Emails { get; }

    public Container ApiKeys { get; }

    public Container Tokens { get; }

    public Container Settings { get; }
}
