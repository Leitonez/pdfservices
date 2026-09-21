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
A single conversion SHALL attempt at most 20 external fetches, SHALL accept at most 5 MB per image and 15 MB of images in total, SHALL follow at most 3 redirects per fetch and SHALL give up on a fetch after 10 seconds. Resources beyond any limit SHALL be refused and counted as blocked.

#### Scenario: Too many images
- **WHEN** a document references 25 distinct external images
- **THEN** at most 20 are fetched and the remaining ones are counted as blocked

#### Scenario: Oversized image
- **WHEN** an external image is larger than 5 MB
- **THEN** it is discarded and counted as blocked

#### Scenario: Slow server
- **WHEN** an image server takes longer than 10 seconds to respond
- **THEN** the fetch is abandoned, the image is counted as blocked and the conversion continues

### Requirement: Inline data is always allowed
Resources embedded as `data:` URIs SHALL be resolved without any network access and SHALL NOT count against the fetch limits.

#### Scenario: Base64 image
- **WHEN** the document contains `<img src="data:image/png;base64,...">`
- **THEN** the image is rendered and is not counted as blocked
