# Spec Delta

## Purpose

Prices each capability, keeps a prepaid balance per account, debits it exactly once per successful call and gives customers a consumption report and a transaction statement.

## ADDED Requirements

### Requirement: Capability price list
Each capability SHALL have a configuration record with name, display name, description, price, currency (`BRL`) and an enabled flag. On first startup the system SHALL create the `html2pdf` capability ("HTML para PDF") with price 0.001 BRL if it does not exist, and SHALL NOT overwrite an existing record: the stored price is the source of truth.

#### Scenario: First startup
- **WHEN** the service starts against an empty database
- **THEN** an enabled `html2pdf` capability priced at 0.001 BRL exists

#### Scenario: Price already configured
- **WHEN** the service starts and the `html2pdf` record already has price 0.002
- **THEN** the price remains 0.002

### Requirement: Public price list endpoint
The system SHALL expose `GET /v1/capabilities` without authentication, returning the enabled capabilities ordered by name with `name`, `displayName`, `description`, `price` and `currency`, and SHALL allow public caching for 5 minutes. The price list itself SHALL be read from configuration on every request. Charges SHALL use a capability configuration cached for at most 1 minute per API instance, so a price change reaches new charges within about 1 minute and public clients within about 5 minutes.

#### Scenario: Listing capabilities
- **WHEN** an anonymous client requests `GET /v1/capabilities`
- **THEN** the response is 200 with a JSON array containing `html2pdf` and `Cache-Control: public, max-age=300`

#### Scenario: Disabled capability hidden
- **WHEN** a capability is disabled
- **THEN** it does not appear in the list

### Requirement: Prepaid balance
Each account SHALL hold a balance in BRL with decimal precision, starting at zero. A call SHALL be refused with HTTP 402 and error `insufficient_balance` when the balance is lower than the price, with a message stating the current balance. Adding credits is not available through the product: balances are adjusted by an operator.

#### Scenario: New account
- **WHEN** an account is created
- **THEN** its balance is 0 BRL

#### Scenario: Balance below price
- **WHEN** the balance is 0.0005 and the price is 0.001
- **THEN** the call is refused with 402 and `insufficient_balance`

### Requirement: Atomic debit per successful call
For each successful paid call the system SHALL, as one atomic operation, debit the price from the balance, add one call and the amount to the daily usage aggregate of that capability, record a transaction and record an API access log entry. Concurrent calls for the same account SHALL never lose a debit; on conflicts the system SHALL retry, and after repeated conflicts SHALL respond 503 with error `busy` without charging. The balance SHALL never become negative through a debit.

#### Scenario: Concurrent calls
- **WHEN** two conversions for the same account finish at the same time with balance 1.000 and price 0.001
- **THEN** the final balance is 0.998 and two transactions exist

#### Scenario: Balance ran out mid-flight
- **WHEN** the balance is enough at the pre-check but another call consumes it before the debit
- **THEN** the call is refused with 402 and no transaction is recorded

### Requirement: Transaction record
Each transaction SHALL record its id, capability, timestamp, the API key used (id, name and prefix), amount, balance after the debit, input size in bytes, output size in bytes and processing duration in milliseconds. It SHALL NOT contain the document or the PDF.

#### Scenario: Transaction fields
- **WHEN** a conversion of a 2,000-byte document producing a 30,000-byte PDF is charged
- **THEN** the transaction shows inputBytes 2000, outputBytes 30000, the key name and prefix, and the amount charged

### Requirement: Daily usage in Brasília time
Daily usage aggregates SHALL be keyed by the calendar date in Brasília time (America/Sao_Paulo), per capability.

#### Scenario: Late-night call
- **WHEN** a call is made at 01:30 UTC on 2026-09-15
- **THEN** it counts toward 2026-09-14 in the usage report

### Requirement: Usage report endpoint
The system SHALL expose `GET /v1/account/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` for the logged-in customer, defaulting to the last 30 days ending today (Brasília). It SHALL return the period, currency, total count, total amount, totals per capability (with display name) and per-day entries ordered by date. Invalid dates SHALL return 400 `invalid_date`; a reversed range or a range of 366 days or more SHALL return 400 `invalid_range`.

#### Scenario: Default period
- **WHEN** the customer requests `/v1/account/usage` without parameters
- **THEN** the report covers the 30 days ending today

#### Scenario: Range too long
- **WHEN** the customer requests from 2025-01-01 to 2026-06-01
- **THEN** the system responds 400 with `invalid_range`

### Requirement: Transaction statement endpoint
The system SHALL expose `GET /v1/account/transactions?limit=N&continuation=TOKEN` for the logged-in customer, returning transactions newest first. `limit` SHALL default to 25 and be clamped to 1..100. When more items exist the response SHALL include an opaque URL-safe `continuation` token; an invalid token SHALL return 400 `invalid_continuation`.

#### Scenario: Paging
- **WHEN** an account has 30 transactions and the customer requests `limit=25`
- **THEN** the first page has 25 items and a continuation token, and the next page has the remaining 5 and no token
