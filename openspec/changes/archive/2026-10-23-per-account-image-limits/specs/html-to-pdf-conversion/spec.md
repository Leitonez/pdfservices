# Spec Delta

## MODIFIED Requirements

### Requirement: Request size limit
The system SHALL reject conversion requests whose body exceeds the account's `maxRequestBytes` (see the "Per-account limits" requirement of `external-resource-policy`), which defaults to 1 MB (1,048,576 bytes), with HTTP 413 and error `payload_too_large`, whether the size is declared by `Content-Length` or discovered while reading. The error message SHALL state the limit that applied.

#### Scenario: Oversized body
- **WHEN** an account without overrides sends a 2 MB HTML document
- **THEN** the system responds 413 with error `payload_too_large` and nothing is charged

#### Scenario: Account with a raised body limit
- **WHEN** an account whose `maxRequestBytes` is 5,242,880 sends a valid 2 MB HTML document with enough balance
- **THEN** the system converts it and responds 200 with the PDF

### Requirement: Order of checks before converting
The system SHALL check, in this order: the format, the API key together with the account it belongs to (which MUST exist and be active), whether the capability is enabled, the body (size against the account's limit, parsing, emptiness) and whether the balance covers the price. The conversion SHALL only start after all checks pass. When the capability is missing or disabled, the system SHALL respond 503 with error `capability_unavailable`.

#### Scenario: Capability disabled
- **WHEN** the `html2pdf` capability is disabled in configuration and a valid request arrives
- **THEN** the system responds 503 with error `capability_unavailable` and nothing is charged

#### Scenario: Insufficient balance detected before converting
- **WHEN** the account balance is lower than the capability price
- **THEN** the system responds 402 with error `insufficient_balance` without converting the document

#### Scenario: Key of an inactive account
- **WHEN** a request carries a key whose account is not active and its body is larger than 1 MB
- **THEN** the system responds 401 with error `invalid_api_key` without reading the body

### Requirement: Successful response headers
On success the system SHALL return the PDF with `Content-Disposition: inline; filename="document.pdf"` and the headers `X-Transaction-Id` (the recorded transaction), `X-Charged-Amount` (the price debited), `X-Balance` (the balance after the debit) and `X-Blocked-Resources` (how many distinct external resources were refused, each URL counted once). Numeric values SHALL use invariant formatting (dot as decimal separator).

#### Scenario: Billing headers present
- **WHEN** a conversion succeeds with price 0.001 and a previous balance of 10
- **THEN** the response carries `X-Charged-Amount: 0.001`, `X-Balance: 9.999` and a non-empty `X-Transaction-Id`

#### Scenario: Refused URL repeated in the document
- **WHEN** a document references the same `http://` image URL three times and has no other external resources
- **THEN** `X-Blocked-Resources` is 1
