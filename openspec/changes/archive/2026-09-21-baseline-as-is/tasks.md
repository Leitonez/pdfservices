# Tasks

This change does not touch code. Every task checks the specs against the code, which is authoritative here (see the proposal). When they disagree, fix the spec. If the code looks wrong, do not change it: list it in the review notes (task 6.2) as a candidate for a future change.

## 1. Conversion and resource policy

- [x] 1.1 Check `specs/html-to-pdf-conversion/spec.md` against `api/Functions/Html2PdfFunction.cs`, `api/Infrastructure/RequestReader.cs`, `api/Services/Pdf/HtmlToPdfConverter.cs` and `api/Configuration/Options.cs` (`Html2PdfOptions`): every error code, status and check order matches. Verify the order of checks (format → key → capability → body → balance) line by line. Done when each requirement has been checked, or corrected in the spec.
- [x] 1.2 Confirm the "Fonts and inline resources" requirement (data: `@font-face`, Noto fallback for accents and `→`) against the project's `.csproj` font packages and converter setup. If nothing in the code guarantees the fallback, reword or drop the requirement. Done when the requirement is backed by a concrete code or package reference.
- [x] 1.3 Check `specs/external-resource-policy/spec.md` against `api/Services/Pdf/ExternalImageFetcher.cs`, `SafeImageResourceRetriever.cs` and `IpAddressPolicy.cs`: every IPv4/IPv6 range listed exists in `IsPublic`, the limits (20 fetches, 5 MB, 15 MB, 3 redirects, 10 s) match `Html2PdfOptions` and the handler, and the Content-Type allow-list matches. Done when the listed ranges and limits exactly match the code.

## 2. Billing, usage and keys

- [x] 2.1 Check `specs/billing-and-usage/spec.md` against `api/Services/BillingService.cs`, `CapabilityService.cs`, `api/Data/CosmosInitializer.cs`, `api/Functions/CapabilityFunctions.cs`, `UsageFunctions.cs` and `api/Infrastructure/BrazilTime.cs`: the batch contents, the 402/503 codes, the usage defaults and ranges, and the paging clamps. Replace the "MAY use a price up to 1 minute old" wording with normative SHALL/MUST phrasing. Done when the spec matches and no requirement uses "may".
- [x] 2.2 Verify that `BrazilTime.DateKey` really uses America/Sao_Paulo, which the "Late-night call" scenario depends on. Done when the scenario's expected date follows from the code.
- [x] 2.3 Check `specs/api-keys/spec.md` against `api/Functions/ApiKeyFunctions.cs`, `api/Services/ApiKeyAuthenticator.cs` and `api/Services/SecureTokens.cs`: the prefix length, the 20-key limit, 404 on another account's key, and the `lastUsedAt` resolution. Also check that an inactive account's key is rejected in `BillingService.EnsureCanAffordAsync`. Done when each requirement cites behavior present in the code.

## 3. Accounts and authentication

- [x] 3.1 Check `specs/account-authentication/spec.md` against `api/Functions/AuthFunctions.cs`, `UserAuthenticator.cs`, `JwtTokenService.cs`, `PasswordHasher.cs`, `OneTimeTokenStore.cs`, `Validation.cs` and `api/Services/Email/*`: token lifetimes (48 h, 60 min, 8 h), lockout (5 failures / 15 min), the non-enumeration responses and the link formats (`#token=`). Done when every number and code matches `AuthOptions` and the handlers.
- [x] 3.2 Read `api/Services/TurnstileVerifier.cs` end to end. Confirm the behavior when Cloudflare is unreachable (status and error code) and when `AllowedHostnames` is empty (checks skipped, local dev only). Add the missing error code to the "Bot protection" requirement. Done when both cases are stated precisely in the spec.
- [x] 3.3 Validate the CNPJ scenario example `12.ABC.345/01DE-35` with `api/Services/CnpjValidator.cs`, by reading the algorithm or running a quick check in the scratchpad. Confirm that `website/assets/js/cnpj.js` implements the same rule. Done when the example is confirmed valid, or replaced with one that is.
- [x] 3.4 Check `specs/account-management/spec.md` against `api/Functions/AccountFunctions.cs` and `api/Models/Responses.cs` (`AccountResponse`): the returned fields, the deletion order, the forfeited balance, what is kept and the re-signup path (the e-mail index is removed). Done when the listed fields and deletion steps match the code.

## 4. Cross-cutting

- [x] 4.1 Check `specs/privacy-and-compliance/spec.md` against `api/Infrastructure/ApiHandler.cs`, `ApiResults.cs`, `ResponseHeadersMiddleware.cs`, `ClientIp.cs`, `api/Data/Documents.cs` (access-log TTL) and `api/Functions/Ping.cs`. Confirm that no log statement in `api/` writes the HTML, the PDF or engine messages (grep for `LogInformation`, `LogWarning`, `LogError`). Done when the grep shows no content leak and the headers and error shape match.
- [x] 4.2 Confirm that the middleware headers are present on error responses too. Check this in code, or with `curl -i` against the local API (`/v1/html2pdf/xyz`) if it is running. Done when the "Headers on any response" scenario is confirmed or reworded.

## 5. Frontends

- [x] 5.1 Check `specs/customer-panel/spec.md` against `admin/assets/js/panel/app.js`, `session.js`, `ui.js`, `pages/*.js` and `panel/views/*.js`: routes, the session expiry margin, `next` sanitizing, cross-tab sync, key dialog lifecycle, the test screen (masked key, not stored, curl sample) and the account/credits views. Done when every scenario maps to code.
- [x] 5.2 Check `specs/public-website/spec.md` against `website/index.html`, `assets/js/pages/home.js`, `pages/signup.js`, `sitemap.xml`, `404.html` and `assets/js/config.js`. Confirm that `website/` and `admin/` share an identical `config.js` (compare hashes). Done when the scenarios map to code and the hashes match.

## 6. Validation and handoff

- [x] 6.1 Run `openspec validate baseline-as-is --strict`. Done when it reports the change as valid.
- [x] 6.2 Summarize for the user every spec correction made and every code-vs-intent doubt found (candidates for future changes), without changing code. Done when the user has the list and approves archiving with `/opsx:archive`.
