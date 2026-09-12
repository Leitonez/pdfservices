using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using PdfServices.API.Data;

namespace PdfServices.API.Services;

/// <summary>Reads capability prices from the "settings" container, cached for one minute.</summary>
public class CapabilityService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    private readonly CosmosContext _db;
    private readonly ConcurrentDictionary<string, CacheEntry> _cache = new ConcurrentDictionary<string, CacheEntry>();

    public CapabilityService(CosmosContext db)
    {
        _db = db;
    }

    public async Task<CapabilityDocument> GetAsync(string name)
    {
        if (_cache.TryGetValue(name, out CacheEntry entry) && entry.ExpiresAt > DateTime.UtcNow)
        {
            return entry.Capability;
        }

        string id = CapabilityDocument.BuildId(name);
        CapabilityDocument capability;
        try
        {
            ItemResponse<CapabilityDocument> response = await _db.Settings.ReadItemAsync<CapabilityDocument>(id, new PartitionKey(id));
            capability = response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            capability = null;
        }

        _cache[name] = new CacheEntry { Capability = capability, ExpiresAt = DateTime.UtcNow.Add(CacheDuration) };
        return capability;
    }

    public async Task<List<CapabilityDocument>> ListEnabledAsync()
    {
        QueryDefinition query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type AND c.enabled = true ORDER BY c.name")
            .WithParameter("@type", DocumentTypes.Capability);

        List<CapabilityDocument> result = new List<CapabilityDocument>();
        using (FeedIterator<CapabilityDocument> iterator = _db.Settings.GetItemQueryIterator<CapabilityDocument>(query))
        {
            while (iterator.HasMoreResults)
            {
                result.AddRange(await iterator.ReadNextAsync());
            }
        }

        return result;
    }

    private class CacheEntry
    {
        public CapabilityDocument Capability { get; set; }

        public DateTime ExpiresAt { get; set; }
    }
}
