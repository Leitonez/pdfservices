# Design

## Context

See proposal.md for the motivation. Relevant current state (observed in the code):

- `Html2PdfFunction` checks format → API key → capability → body (`RequestReader.ReadBodyAsync(req, _options.MaxRequestBytes, …)`) → balance (`BillingService.EnsureCanAffordAsync`, which reads the account) and then runs `HtmlToPdfConverter.Convert` inside `Task.Run`. The account document is only read at the balance step, after the body.
- `HtmlToPdfConverter.Convert` creates one `SafeImageResourceRetriever` per conversion with the global `Html2PdfOptions`. pdfHTML calls the retriever **synchronously, one resource at a time, during layout**; the retriever bridges to `ExternalImageFetcher.FetchAsync` with `.GetAwaiter().GetResult()`.
- The retriever counts a slot (`_requests`) per call, not per URL, and increments `BlockedCount` per call. pdfHTML keeps a small cache of decoded images, but it does not remember failures, so a refused URL repeated in the document is requested (and counted) again every time.
- `ExternalImageFetcher` owns the SSRF protections (`IsAllowedUrl`, `ConnectCallback` + `IpAddressPolicy`, 3 redirects, Content-Type allow-list) and applies its own 10 s timeout per fetch; it has no notion of a conversion-wide deadline.
- Cosmos documents are serialized in camelCase; the account is only ever changed with PATCH, so an extra field written by the administrator survives every API update. There is no automated test project; verification is done end to end with curl against the local Functions host.

## Goals / Non-Goals

**Goals:**
- Resolve the effective limits once per request from the account document, with the global options as defaults.
- One place (the retriever) that decides, per distinct URL, whether it is fetched, and remembers the outcome for the rest of the conversion.
- A conversion-wide deadline that bounds fetch time, with cancellation of in-flight fetches.
- Fetch `<img src>` images concurrently before layout so documents with many images finish well inside the budget.

**Non-Goals:**
- Endpoints or panel screens to view or edit the limits (administrator edits the document by hand).
- Per-account overrides of the time budget, prefetch concurrency, per-image size, redirects, per-fetch timeout or any SSRF rule.
- Caching images across conversions or accounts.
- Prefetching anything other than `<img src>` (CSS `background-image`, `srcset`, `<object>`): those keep the on-demand path.
- Adding a unit-test project; verification stays end to end, as in the rest of the project.

## Decisions

### 1. Limits live in an optional `limits` object on the account document

`AccountDocument` gains `public AccountLimits Limits { get; set; }`, where `AccountLimits` has `int? MaxExternalImages`, `int? MaxTotalImageBytes` and `int? MaxRequestBytes` (value-type nullables, consistent with the existing `DateTime?`/`decimal?` fields; reference nullability stays disabled). Stored as:

```json
"limits": { "maxExternalImages": 100, "maxTotalImageBytes": 52428800, "maxRequestBytes": 5242880 }
```

A small resolver (`Html2PdfLimits.Resolve(Html2PdfOptions, AccountLimits)`) returns the effective values: an override is used only when it has a value greater than zero, otherwise the option default. The resolved object is what the function, the converter and the retriever receive, instead of reading `Html2PdfOptions` directly for these three values.

- *Why on the account document*: the request already reads it (balance check), so overrides cost no extra RU, and the administrator already edits this document for `balance`. The API never writes `/limits`, and all account writes are PATCH operations on other paths, so the field is preserved by construction.
- *Alternatives*: a `settings` document per account (extra read per conversion, second place to look); plan/tier objects (no product need yet); App Settings keyed by account id (requires redeploy-level changes and leaks account ids into configuration).
- No hard upper ceiling is enforced in code: the administrator is trusted, and the README documents sane ranges. Lower-than-default values are allowed (useful to restrict an abusive account).

### 2. Account is loaded right after the API key and reused for the balance check

`BillingService` gets `GetActiveAccountAsync(accountId)` (throws `InvalidKey()` when missing or not active, as today) and a synchronous `EnsureCanAfford(AccountDocument, decimal price)`. `Html2PdfFunction` loads the account right after authenticating the key, resolves the limits, checks the capability, reads the body with `limits.MaxRequestBytes`, then calls `EnsureCanAfford` with the same snapshot. `ChargeAsync` keeps re-reading the account with ETag, so concurrency safety is unchanged.

- The only visible difference is that an inactive account's key is rejected before the body is read (captured in the modified "Order of checks" requirement). Reads per request stay at one.
- `RequestReader.PayloadTooLarge` already formats the limit in the message, so a raised limit is reported correctly.

### 3. The retriever memoizes outcomes per URL and computes the counters from them

The retriever keeps a `ConcurrentDictionary<string, Lazy<Task<byte[]>>>` keyed by `Uri.AbsoluteUri`. Every request, from pdfHTML or from the prefetcher, goes through one `GetOrFetchAsync(Uri)`:

1. If the key exists, return its task (success or `null` for refused).
2. Otherwise add an entry whose work is: refuse when `!IsAllowedUrl`, when the deadline has passed, or when the slot counter has reached `MaxExternalImages`; otherwise take a slot, fetch with `maxBytes = min(MaxImageBytes, MaxTotalImageBytes − acceptedBytes)`, check the magic bytes, and under a lock accept the image only if `acceptedBytes + length ≤ MaxTotalImageBytes`.

The slot is taken synchronously when the entry is created, so the order in which slots are consumed is the order in which URLs are first requested. `FetchedCount` and `BlockedCount` are derived at the end from the completed entries (non-null / null), which gives "each distinct URL counted once" for both the limits and `X-Blocked-Resources`. Disallowed URLs (http, other ports, `file:`) are memoized as refused and do not take a slot, as today.

- *Why not rely on pdfHTML's image cache*: it does not cache failures and is bounded in size, so it cannot give the "counts once" guarantee; the memo makes the behavior independent of iText internals.
- *Why check total bytes after the download*: with concurrent fetches, reserving bytes up front would serialize the last fetches; checking on completion keeps the total within the limit and at worst wastes one concurrent download near the cap.
- The `IResourceRetriever` methods stay synchronous and block on `GetOrFetchAsync`, as today; they run on the thread-pool thread started by the converter.

### 4. Conversion-wide deadline via a cancellation token

`Html2PdfOptions` gains `MaxTotalFetchSeconds` (default 60) and `PrefetchConcurrency` (default 4). The retriever owns a `CancellationTokenSource` created with the budget when the conversion starts. `ExternalImageFetcher.FetchAsync` gains a `CancellationToken` parameter and links it with its own per-fetch timeout, so a fetch ends at whichever comes first (10 s or the deadline) and in-flight fetches are cancelled when the budget runs out. After the deadline, new URLs are memoized as refused without any network access.

- *Measured from the conversion start, not summed per fetch*: with concurrent fetches a sum is meaningless, and what must be bounded is wall-clock time against the HTTP front-end limit (about 230 s on Azure). 60 s leaves ample room for layout and billing; it is an App Setting so it can be tuned without code.
- *Global, not per account*: it protects the platform, not the customer's quota.
- Running out of budget is not an error: the converter returns the PDF and the function charges as usual. The log line gains a `budgetExhausted` flag (no URLs).

### 5. Prefetch of `<img src>` with bounded concurrency (recommended and included)

Before calling `HtmlConverter.ConvertToPdf`, the converter parses the HTML with the jsoup port that ships with iText's StyledXmlParser (`iText.StyledXmlParser.Jsoup.Jsoup.Parse`, no new dependency), collects `img[src]` values, keeps those that parse as absolute URIs passing `IsAllowedUrl`, de-duplicates by `AbsoluteUri` preserving document order, and runs `GetOrFetchAsync` on them with a `SemaphoreSlim(PrefetchConcurrency)`. Entries are created in document order (decision 3), so when there are more URLs than slots the first ones in the document win. The converter becomes `ConvertAsync(string html, Html2PdfLimits limits)`: `await` prefetch, then `Task.Run` the synchronous pdfHTML call (moved from the function into the converter). When layout later asks for the same URLs they are served from the memo; anything else falls back to on-demand fetching.

- *Evaluation*: for the motivating document (83 images on presumably one host) sequential fetching costs 83 × latency (≈ 15–25 s at 200–300 ms, up to the budget on a slow host); with 4 in parallel it is about a quarter of that, and the budget becomes a safety net rather than the expected path. The cost is a second parse of the HTML (milliseconds for 1 MB) and one extra class.
- *Concurrency 4*: polite to customer servers and bounded per conversion; `0` disables prefetch entirely (pure on-demand behavior), which is the rollback lever if the prefetch misbehaves.
- *Alternatives*: no prefetch, budget only (simpler, but large batches would routinely be slow or truncated on slow hosts); a custom async pdfHTML resource pipeline (not supported by the sync `IResourceRetriever` API); unbounded parallelism (could hammer a customer host and spike memory).
- Images the prefetch fetched but pdfHTML never uses (e.g. inside elements it skips) still count against the limits. This is accepted: they are referenced by the customer's own document.

### 6. Privacy and logging

URLs are never logged (they can carry customer tokens or personal data). The existing summary log line keeps counters only: external images fetched, distinct blocked, and whether the budget ran out. Image bytes live only in the per-conversion memo, which is dropped with the retriever.

## Risks / Trade-offs

- [URL key mismatch between prefetch and pdfHTML (entity decoding, whitespace, normalization) → the same image fetched twice and counted twice] → Both paths key by `new Uri(...).AbsoluteUri`; end-to-end check with a URL containing a query string with `&amp;` and with surrounding spaces, confirming 1 fetch.
- [Large overrides raise per-request memory (memo holds up to `maxTotalImageBytes` plus the PDF)] → Administrator-only setting; README states recommended ranges; per-image 5 MB cap stays.
- [Behavior change in `X-Blocked-Resources` (distinct instead of per occurrence)] → It can only decrease; documented in the spec and panel docs. Clients that alert on "> 0" are unaffected.
- [Concurrent prefetches against one customer host could trip their rate limiting] → Concurrency 4 per conversion, configurable, and 0 disables.
- [Budget expiry cancels a fetch mid-download] → The image is refused and counted; the PDF is still returned, as required.
- [A sync-over-async bridge in the retriever] → Unchanged from today; it runs on a thread-pool thread inside `Task.Run`, never on a request context.

## Migration Plan

1. Deploy the API (no data migration: accounts without `limits` behave exactly as before; the new App Settings are optional).
2. Optionally set `Html2Pdf__MaxTotalFetchSeconds` / `Html2Pdf__PrefetchConcurrency` in the Function App; defaults apply otherwise.
3. In the Cosmos DB Data Explorer, add `limits` to the CodeCycle account document (for the batch: `maxExternalImages` ≥ 83, e.g. 100; `maxTotalImageBytes` sized to the batch, e.g. 50 MB). Saving there is a whole-document replace by the administrator, same as editing `balance` today; do it when the account is idle or re-read before saving.
4. Validate with the customer's batch: `X-Blocked-Resources: 0`.

Rollback: redeploy the previous build. The old code ignores the unknown `limits` field and its PATCH-based updates keep it intact, so it can stay in the documents. Setting `Html2Pdf__PrefetchConcurrency=0` disables only the prefetch without a redeploy.

## Open Questions

- Exact `maxTotalImageBytes` for the CodeCycle account: depends on the real signature sizes; measure from one batch before setting it.
- Whether the Function App's plan imposes a lower `functionTimeout` than the 230 s HTTP limit; if so, lower `Html2Pdf__MaxTotalFetchSeconds` accordingly (configuration only).
