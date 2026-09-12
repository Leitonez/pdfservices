using System;
using System.Buffers.Text;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using PdfServices.API.Data;
using PdfServices.API.Infrastructure;
using PdfServices.API.Models;
using PdfServices.API.Services;

namespace PdfServices.API.Functions;

/// <summary>Consumption report: daily aggregates per capability and the transaction statement.</summary>
public class UsageFunctions
{
    private const int MaxRangeDays = 366;

    private readonly CosmosContext _db;
    private readonly UserAuthenticator _users;
    private readonly CapabilityService _capabilities;
    private readonly ILogger<UsageFunctions> _logger;

    public UsageFunctions(CosmosContext db, UserAuthenticator users, CapabilityService capabilities, ILogger<UsageFunctions> logger)
    {
        _db = db;
        _users = users;
        _capabilities = capabilities;
        _logger = logger;
    }

    /// <summary>GET v1/account/usage?from=yyyy-MM-dd&amp;to=yyyy-MM-dd (Brasília dates, default: last 30 days).</summary>
    [Function("GetUsage")]
    public Task<IActionResult> GetUsage([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/account/usage")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);
            DateTime to = ParseDate(req.Query["to"], "to") ?? BrazilTime.Today();
            DateTime from = ParseDate(req.Query["from"], "from") ?? to.AddDays(-29);
            if (from > to || (to - from).TotalDays >= MaxRangeDays)
            {
                throw new ApiException(400, "invalid_range", "Período inválido. Informe datas em ordem, com no máximo " + MaxRangeDays + " dias.");
            }

            UsageResponse response = new UsageResponse
            {
                From = from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                To = to.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            };

            QueryDefinition query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type AND c.date >= @from AND c.date <= @to")
                .WithParameter("@type", DocumentTypes.Usage)
                .WithParameter("@from", response.From)
                .WithParameter("@to", response.To);

            List<UsageDocument> usage = new List<UsageDocument>();
            QueryRequestOptions options = new QueryRequestOptions { PartitionKey = new PartitionKey(account.Document.Id) };
            using (FeedIterator<UsageDocument> iterator = _db.Accounts.GetItemQueryIterator<UsageDocument>(query, null, options))
            {
                while (iterator.HasMoreResults)
                {
                    usage.AddRange(await iterator.ReadNextAsync());
                }
            }

            foreach (IGrouping<string, UsageDocument> group in usage.GroupBy(u => u.Capability).OrderBy(g => g.Key))
            {
                CapabilityDocument capability = await _capabilities.GetAsync(group.Key);
                response.Capabilities.Add(new UsageResponse.UsageTotal
                {
                    Capability = group.Key,
                    DisplayName = capability == null ? group.Key : capability.DisplayName,
                    Count = group.Sum(u => u.Count),
                    Amount = group.Sum(u => u.Amount)
                });
            }

            response.Days = usage
                .OrderBy(u => u.Date, StringComparer.Ordinal)
                .ThenBy(u => u.Capability, StringComparer.Ordinal)
                .Select(u => new UsageResponse.UsageDay { Date = u.Date, Capability = u.Capability, Count = u.Count, Amount = u.Amount })
                .ToList();
            response.TotalCount = response.Capabilities.Sum(c => c.Count);
            response.TotalAmount = response.Capabilities.Sum(c => c.Amount);
            return ApiResults.Ok(response);
        });
    }

    /// <summary>GET v1/account/transactions?limit=25&amp;continuation=... (newest first).</summary>
    [Function("ListTransactions")]
    public Task<IActionResult> ListTransactions([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "v1/account/transactions")] HttpRequest req)
    {
        return ApiHandler.RunAsync(_logger, async () =>
        {
            Versioned<AccountDocument> account = await _users.AuthenticateAsync(req);

            int limit = 25;
            if (int.TryParse(req.Query["limit"], NumberStyles.None, CultureInfo.InvariantCulture, out int requested))
            {
                limit = Math.Clamp(requested, 1, 100);
            }

            string continuation = null;
            string encoded = req.Query["continuation"];
            if (!string.IsNullOrEmpty(encoded))
            {
                try
                {
                    continuation = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(encoded));
                }
                catch (FormatException)
                {
                    throw new ApiException(400, "invalid_continuation", "Parâmetro de paginação inválido.");
                }
            }

            QueryDefinition query = new QueryDefinition("SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC")
                .WithParameter("@type", DocumentTypes.Transaction);
            QueryRequestOptions options = new QueryRequestOptions { PartitionKey = new PartitionKey(account.Document.Id), MaxItemCount = limit };

            TransactionPageResponse response = new TransactionPageResponse();
            try
            {
                using (FeedIterator<TransactionDocument> iterator = _db.Accounts.GetItemQueryIterator<TransactionDocument>(query, continuation, options))
                {
                    if (iterator.HasMoreResults)
                    {
                        FeedResponse<TransactionDocument> page = await iterator.ReadNextAsync();
                        response.Items = page.Select(TransactionResponse.From).ToList();
                        if (!string.IsNullOrEmpty(page.ContinuationToken))
                        {
                            response.Continuation = Base64Url.EncodeToString(Encoding.UTF8.GetBytes(page.ContinuationToken));
                        }
                    }
                }
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.BadRequest && continuation != null)
            {
                throw new ApiException(400, "invalid_continuation", "Parâmetro de paginação inválido.");
            }

            return ApiResults.Ok(response);
        });
    }

    private static DateTime? ParseDate(string value, string field)
    {
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        if (!DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime date))
        {
            throw new ApiException(400, "invalid_date", "Data inválida em \"" + field + "\". Use o formato AAAA-MM-DD.");
        }

        return date;
    }
}
