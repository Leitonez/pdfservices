# html-to-pdf-conversion Specification

## Purpose

Converts an HTML document sent by an authenticated customer into a PDF, charging the account per successful conversion. This is the paid capability the whole service exists for.

## Requirements

### Requirement: Conversion endpoint and input formats
The system SHALL expose `POST /v1/html2pdf/{format}` where `format` is `json` or `html` (case-insensitive). With `json`, the body MUST be a JSON object whose `html` property is a string holding the document. With `html`, the body itself is the HTML document. Any other format SHALL be rejected with HTTP 400 and error code `invalid_format`.

#### Scenario: JSON body
- **WHEN** a client posts `{"html": "<h1>Hi</h1>"}` to `/v1/html2pdf/json` with a valid API key and enough balance
- **THEN** the system responds 200 with `Content-Type: application/pdf` and the PDF bytes

#### Scenario: Raw HTML body
- **WHEN** a client posts the HTML document as the body to `/v1/html2pdf/html` with a valid API key and enough balance
- **THEN** the system responds 200 with the PDF

#### Scenario: Unknown format
- **WHEN** a client posts to `/v1/html2pdf/docx`
- **THEN** the system responds 400 with error `invalid_format`

#### Scenario: JSON without an html string
- **WHEN** the body of a `json` request is valid JSON but is not an object with a string `html` property
- **THEN** the system responds 400 with error `invalid_body`

#### Scenario: Malformed JSON
- **WHEN** the body of a `json` request is not valid JSON
- **THEN** the system responds 400 with error `invalid_json`

### Requirement: Character encoding of raw HTML
For the `html` format the system SHALL decode the body as UTF-8 unless the `Content-Type` header declares another charset, and SHALL strip a leading byte-order mark. An unknown charset SHALL be rejected with HTTP 415 and error `unsupported_charset`.

#### Scenario: Declared charset
- **WHEN** the request has `Content-Type: text/html; charset=iso-8859-1`
- **THEN** the body is decoded as ISO-8859-1 before conversion

#### Scenario: Unsupported charset
- **WHEN** the request declares `charset=does-not-exist`
- **THEN** the system responds 415 with error `unsupported_charset`

### Requirement: Request size limit
The system SHALL reject conversion requests whose body exceeds 1 MB (1,048,576 bytes) with HTTP 413 and error `payload_too_large`, whether the size is declared by `Content-Length` or discovered while reading.

#### Scenario: Oversized body
- **WHEN** a client sends a 2 MB HTML document
- **THEN** the system responds 413 with error `payload_too_large` and nothing is charged

### Requirement: Empty documents are rejected
The system SHALL reject a document that is empty or whitespace only with HTTP 400 and error `empty_html`, without charging.

#### Scenario: Whitespace-only HTML
- **WHEN** a client sends `{"html": "   "}`
- **THEN** the system responds 400 with error `empty_html`

### Requirement: Order of checks before converting
The system SHALL check, in this order: the format, the API key, whether the capability is enabled, the body (size, parsing, emptiness) and whether the balance covers the price. The conversion SHALL only start after all checks pass. When the capability is missing or disabled, the system SHALL respond 503 with error `capability_unavailable`.

#### Scenario: Capability disabled
- **WHEN** the `html2pdf` capability is disabled in configuration and a valid request arrives
- **THEN** the system responds 503 with error `capability_unavailable` and nothing is charged

#### Scenario: Insufficient balance detected before converting
- **WHEN** the account balance is lower than the capability price
- **THEN** the system responds 402 with error `insufficient_balance` without converting the document

### Requirement: Failed conversions are not charged
When the conversion engine fails on the document, the system SHALL respond 422 with error `conversion_failed`, SHALL state in the message that nothing was charged, and SHALL NOT debit the account or record a transaction.

#### Scenario: Engine error
- **WHEN** the conversion engine throws while processing the document
- **THEN** the system responds 422 with error `conversion_failed` and the balance is unchanged

### Requirement: Successful response headers
On success the system SHALL return the PDF with `Content-Disposition: inline; filename="document.pdf"` and the headers `X-Transaction-Id` (the recorded transaction), `X-Charged-Amount` (the price debited), `X-Balance` (the balance after the debit) and `X-Blocked-Resources` (how many external resources were refused). Numeric values SHALL use invariant formatting (dot as decimal separator).

#### Scenario: Billing headers present
- **WHEN** a conversion succeeds with price 0.001 and a previous balance of 10
- **THEN** the response carries `X-Charged-Amount: 0.001`, `X-Balance: 9.999` and a non-empty `X-Transaction-Id`

### Requirement: PDF producer metadata
Every generated PDF SHALL have its Producer property set to `CodeCycle AGPL PDF Services (https://pdfservices.sistema.site)` followed by the conversion engine's own AGPL identification.

#### Scenario: Producer in output
- **WHEN** a generated PDF's document information is inspected
- **THEN** the Producer starts with `CodeCycle AGPL PDF Services (https://pdfservices.sistema.site)` and names the iText AGPL version

### Requirement: Fonts and inline resources
The conversion SHALL resolve `data:` URIs, including `@font-face` fonts embedded as `data:` URIs, so customers can use custom fonts without external requests. The service configures no fonts of its own: glyph coverage of the standard font families is whatever the conversion engine provides.

#### Scenario: Embedded font
- **WHEN** the document declares an `@font-face` whose `src` is a `data:` URI
- **THEN** the text using that font family is rendered with the embedded font
