# external-resource-policy Specification

## Purpose

Limits what a customer document can make the server fetch during a conversion, so the service cannot be used to reach internal networks (SSRF) or to exhaust resources.

## Requirements

### Requirement: Only https images on the default port
A conversion SHALL only fetch external resources whose URL is absolute, uses the `https` scheme on port 443, and has a host and no user information. Every other reference (http, other ports, `file:`, relative paths, credentials in the URL) SHALL be refused and counted as a blocked resource. A refused resource SHALL NOT fail the conversion.

#### Scenario: Plain http image
- **WHEN** the document contains `<img src="http://example.com/a.png">`
- **THEN** the image is not fetched, the PDF is still produced and `X-Blocked-Resources` is at least 1

#### Scenario: Non-default port
- **WHEN** the document references `https://example.com:8443/a.png`
- **THEN** the image is not fetched and is counted as blocked

### Requirement: Only PNG and JPEG content is accepted
A fetched resource SHALL be used only if its bytes start with the PNG or JPEG signature. Stylesheets, fonts, SVG and any other external content SHALL be refused and counted as blocked. A declared `Content-Type` outside PNG, JPEG or generic binary types SHALL cause the resource to be refused.

#### Scenario: External stylesheet
- **WHEN** the document has `<link rel="stylesheet" href="https://cdn.example.com/a.css">`
- **THEN** the stylesheet is not applied and is counted as blocked

#### Scenario: SVG served as image
- **WHEN** the document references an https URL that returns an SVG image
- **THEN** the image is not rendered and is counted as blocked

### Requirement: Only public internet addresses are reachable
Every connection opened while fetching a resource, including after redirects, SHALL be checked against the resolved IP addresses, and SHALL be refused unless all of them are public. Refused ranges SHALL include at least: private networks (10/8, 172.16/12, 192.168/16), loopback, "this network" (0/8), link-local (169.254/16, which covers cloud metadata endpoints), carrier-grade NAT (100.64/10), documentation and benchmarking ranges, multicast and reserved ranges, the Azure platform address 168.63.129.16, and for IPv6 anything outside global unicast plus documentation, Teredo and 6to4 prefixes. The check SHALL happen at connection time so DNS rebinding cannot bypass it.

#### Scenario: Metadata endpoint
- **WHEN** the document references an https URL whose host resolves to 169.254.169.254
- **THEN** no connection is made and the resource is counted as blocked

#### Scenario: Redirect to a private address
- **WHEN** a public https URL redirects to a host resolving to 10.0.0.5
- **THEN** the redirect target is not contacted and the resource is counted as blocked

### Requirement: Per-conversion fetch limits
A single conversion SHALL fetch at most `maxExternalImages` distinct external resources and SHALL accept at most `maxTotalImageBytes` of images in total, where both values come from the account's limits (see "Per-account limits") and default to 20 resources and 15 MB. Regardless of the account, a conversion SHALL accept at most 5 MB per image, SHALL follow at most 3 redirects per fetch and SHALL give up on a fetch after 10 seconds. Resources beyond any limit SHALL be refused and counted as blocked, and the conversion SHALL continue without them.

#### Scenario: Too many images
- **WHEN** an account without limit overrides converts a document that references 25 distinct external images
- **THEN** 20 are fetched, the remaining 5 are refused and `X-Blocked-Resources` is 5

#### Scenario: Account with a raised image limit
- **WHEN** an account whose `maxExternalImages` is 100 converts a document that references 83 distinct, valid external images within the size limits
- **THEN** all 83 images are rendered in the PDF and `X-Blocked-Resources` is 0

#### Scenario: Oversized image
- **WHEN** an external image is larger than 5 MB, even for an account with raised limits
- **THEN** it is discarded and counted as blocked

#### Scenario: Total image size exceeded
- **WHEN** the images already accepted in a conversion add up to the account's `maxTotalImageBytes` and another external image is requested
- **THEN** that image is refused and counted as blocked

#### Scenario: Slow server
- **WHEN** an image server takes longer than 10 seconds to respond
- **THEN** the fetch is abandoned, the image is counted as blocked and the conversion continues

### Requirement: Inline data is always allowed
Resources embedded as `data:` URIs SHALL be resolved without any network access and SHALL NOT count against the fetch limits.

#### Scenario: Base64 image
- **WHEN** the document contains `<img src="data:image/png;base64,...">`
- **THEN** the image is rendered and is not counted as blocked

### Requirement: Per-account limits
An account MAY carry overrides for `maxExternalImages`, `maxTotalImageBytes` and `maxRequestBytes`. Each override SHALL apply only to conversions of that account. A missing, zero or negative override SHALL be ignored and the default SHALL apply (20 resources, 15 MB of images, 1 MB request body). An override MAY be lower or higher than the default. Overrides SHALL be set only by the service administrator: the API SHALL NOT offer any way for a customer to read or change them, and every update the API makes to an account SHALL preserve them. The scheme and port rule, the IP address checks, the PNG/JPEG content check, the per-image size, the redirect limit and the per-fetch timeout SHALL NOT be overridable per account.

#### Scenario: Account without overrides
- **WHEN** an account has no limit overrides
- **THEN** its conversions use 20 external resources, 15 MB of images and a 1 MB request body as limits

#### Scenario: Override applies to one account only
- **WHEN** account A has `maxExternalImages` set to 100 and account B has no override, and both convert a document with 25 distinct external images
- **THEN** account A gets all 25 images and account B gets 20 images with `X-Blocked-Resources` equal to 5

#### Scenario: Invalid override value
- **WHEN** an account has `maxExternalImages` set to 0
- **THEN** its conversions use the default of 20 external resources

#### Scenario: Customer account updates keep the overrides
- **WHEN** the customer of an account with overrides changes their password or profile through the API
- **THEN** the overrides are still present and in effect afterwards

### Requirement: Each URL counts once per conversion
Within one conversion the system SHALL fetch each distinct URL at most once and SHALL reuse the outcome, success or refusal, for every further reference to the same URL. A repeated URL SHALL count once against the resource and size limits, and a refused URL SHALL be counted once in `X-Blocked-Resources` however many times the document references it. A URL refused once SHALL NOT be fetched again in the same conversion.

#### Scenario: Same logo on every page
- **WHEN** a document references the same valid external image in 86 page headers
- **THEN** the image is fetched once, appears in all 86 headers, counts as 1 resource against `maxExternalImages` and `X-Blocked-Resources` is 0

#### Scenario: Repeated failing URL
- **WHEN** a document references the same external URL 10 times and that URL returns an error
- **THEN** the URL is requested from its server only once, counts as 1 resource against `maxExternalImages` and `X-Blocked-Resources` is 1

#### Scenario: Repeated URL beyond the limit
- **WHEN** a document without overrides references 21 distinct external images and the 21st is referenced 5 times
- **THEN** the 21st URL is never fetched and `X-Blocked-Resources` is 1

### Requirement: Total fetch time budget
The system SHALL limit the total time a conversion spends fetching external resources to a budget configured for the whole service, defaulting to 60 seconds and counted from the start of the conversion. Once the budget is spent, fetches still in progress SHALL be abandoned, no new fetch SHALL start, and every resource not yet obtained SHALL be refused and counted as blocked. A single fetch SHALL never wait longer than the remaining budget. Running out of budget SHALL NOT fail the conversion: the PDF SHALL be produced with the resources obtained so far and charged as a normal successful conversion.

#### Scenario: Budget exhausted by slow servers
- **WHEN** a document references many external images on servers so slow that fetching them would exceed the budget
- **THEN** the fetches stop when the budget is spent, the images not obtained are counted in `X-Blocked-Resources`, and the response is 200 with the PDF

#### Scenario: Fast images within the budget
- **WHEN** all external images of a document are fetched before the budget is spent
- **THEN** no image is refused because of the budget

### Requirement: Document images are fetched ahead of layout
Before laying out the document, the system SHALL fetch the distinct absolute `https` URLs found in `<img src>` attributes, in document order and several at a time, applying every rule and limit of this policy. When the document has more such URLs than `maxExternalImages`, the first ones in document order SHALL be the ones fetched. Resources requested later during layout (for example CSS backgrounds) SHALL keep being fetched on demand within whatever limits and budget remain. Fetching ahead SHALL NOT change which resources are accepted or refused, apart from the order in which the limits are consumed.

#### Scenario: Many images on the same document
- **WHEN** an account with `maxExternalImages` set to 100 converts a document with 83 distinct `<img>` URLs that each take 1 second to download
- **THEN** the conversion takes noticeably less than 83 seconds of fetching and all 83 images are rendered

#### Scenario: Limit reached ahead of layout
- **WHEN** an account without overrides converts a document with 25 distinct `<img>` URLs
- **THEN** the first 20 in document order are rendered and the last 5 are counted as blocked
