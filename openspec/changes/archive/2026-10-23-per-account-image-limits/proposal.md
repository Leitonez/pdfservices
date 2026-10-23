# Proposal

## Why

A CodeCycle customer prints work orders in batches: one HTML document with 86 orders and 83 distinct external images (1 logo + 82 signatures, PNG/JPEG over https). The current per-conversion limit of 20 external fetches and 15 MB of images silently drops every signature after the 20th; only `X-Blocked-Resources` reports it. Before moving to the service the customer ran iText in-process without such limits, so for them this is a regression. Raising the global limits would weaken the SSRF and resource-abuse protection for every account, so the limits need to become adjustable per account, and conversions with many images need protection against running past the HTTP request timeout.

## What Changes

- **Per-account limits**: the account document (container `accounts`) gains an optional `limits` object with `maxExternalImages`, `maxTotalImageBytes` and `maxRequestBytes`. Missing (or non-positive) values fall back to the `Html2PdfOptions` defaults (20 / 15 MB / 1 MB), so accounts without an override see no change. The administrator sets them by editing the document in Cosmos DB, as is done today with `balance`. The API never writes `limits`, and all account updates keep using PATCH, so the field is never overwritten.
- **Unchanged for everyone**: https only on port 443, IP validation in `ConnectCallback`, PNG/JPEG only by magic bytes, 5 MB per image, 3 redirects, 10 s per fetch. These stay global and are not overridable per account.
- **Total fetch time budget per conversion**: a new global setting `Html2Pdf__MaxTotalFetchSeconds` (default 60 s). After the budget is spent, in-flight fetches are cancelled, no new fetch starts, the remaining images are refused and counted in `X-Blocked-Resources`, and the PDF is still returned and charged as usual.
- **Each URL counts once per conversion**: the resource retriever memoizes the outcome of every URL, including failures and refusals. A repeated URL is never fetched again, never consumes the limits twice and is counted at most once in `X-Blocked-Resources`. `X-Blocked-Resources` therefore becomes the number of **distinct** refused resources (today a repeated refused URL can be counted several times).
- **Concurrent prefetch of `<img src>`**: before layout, the distinct absolute `https` URLs of `<img src>` are fetched in document order with bounded concurrency (new global setting `Html2Pdf__PrefetchConcurrency`, default 4; 0 turns it off), within the same count, size and time limits. Resources iText asks for later (CSS backgrounds, images the prefetch did not see) keep being fetched on demand.
- **Request size per account**: the conversion endpoint reads the account before the body so `limits.maxRequestBytes` can apply. The order of checks seen by clients does not change.
- Documentation: panel docs (`admin/assets/js/panel/views/docs.js`) state the limits as defaults that can be raised on request; README lists the new `Html2Pdf__*` settings and the `limits` object.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `external-resource-policy`: "Per-conversion fetch limits" becomes per account with defaults, adds the total fetch time budget and counts each distinct URL once; new requirement for the prefetch of document images.
- `html-to-pdf-conversion`: "Request size limit" becomes per account with a 1 MB default; "Successful response headers" defines `X-Blocked-Resources` as distinct refused resources.

## Impact

- API: `Configuration/Options.cs` (`Html2PdfOptions`), `Data/Documents.cs` (`AccountDocument.Limits`), `Services/BillingService.cs` (account loaded once and reused for the balance check), `Functions/Html2PdfFunction.cs`, `Services/Pdf/HtmlToPdfConverter.cs`, `SafeImageResourceRetriever.cs`, `ExternalImageFetcher.cs` (deadline-aware fetch), plus a new limits resolver and image prefetcher in `Services/Pdf`.
- Data: optional `limits` field on account documents; no migration, no new container.
- Operations: two new optional App Settings (`Html2Pdf__MaxTotalFetchSeconds`, `Html2Pdf__PrefetchConcurrency`). The administrator edits `limits` by hand for the accounts that need it (first one: the CodeCycle account, `maxExternalImages` ≥ 83).
- Docs: `admin/assets/js/panel/views/docs.js`, `README.md`.
- Privacy is unchanged: the HTML, the image bytes and the PDF stay in memory and are never logged; logs gain only counters.
