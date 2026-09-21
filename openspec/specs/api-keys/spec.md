# api-keys Specification

## Purpose

Lets a customer create and revoke the secret keys their systems use to call paid capabilities, without the service ever storing a key in recoverable form.

## Requirements

### Requirement: Key format and storage
API keys SHALL have the form `pdfs_` followed by 32 random bytes encoded as URL-safe base64. The system SHALL store only a SHA-256 hash of the key, plus a public id, the name, a 12-character display prefix, the creation time and the last-use time. The full key SHALL be returned only once, in the creation response.

#### Scenario: Key shown once
- **WHEN** a customer creates a key
- **THEN** the creation response includes the full key, and later listings show only its prefix

### Requirement: Create a key
The system SHALL expose `POST /v1/account/api-keys` for the logged-in customer with a `name` of 1 to 60 characters (trimmed), responding 201 with the new key. A missing or too long name SHALL return 400 `validation_error` with a `name` field error. An account SHALL have at most 20 keys; creating a 21st SHALL return 400 `limit_reached`.

#### Scenario: Create
- **WHEN** a customer creates a key named "ERP produção"
- **THEN** the response is 201 with id, name, prefix, createdAt and the full key

#### Scenario: Limit reached
- **WHEN** a customer with 20 keys tries to create another
- **THEN** the system responds 400 with `limit_reached`

### Requirement: List keys
The system SHALL expose `GET /v1/account/api-keys` returning the customer's keys newest first, each with id, name, prefix, createdAt and lastUsedAt, and never the key itself.

#### Scenario: Listing
- **WHEN** a customer lists keys
- **THEN** only their own keys are returned, without secrets

### Requirement: Revoke a key
The system SHALL expose `DELETE /v1/account/api-keys/{keyId}`, deleting the key immediately and responding 204. A key that does not exist or belongs to another account SHALL return 404 `not_found`. A revoked key SHALL stop authenticating at once.

#### Scenario: Revoke
- **WHEN** a customer deletes a key and then calls a capability with it
- **THEN** the delete returns 204 and the call returns 401 `invalid_api_key`

#### Scenario: Another account's key
- **WHEN** a customer tries to delete a key id belonging to another account
- **THEN** the system responds 404 `not_found`

### Requirement: Authenticating capability calls
Paid capability calls SHALL be authenticated by the `X-Api-Key` header. A missing header SHALL return 401 `missing_api_key`; a key without the `pdfs_` prefix, longer than 128 characters, unknown, revoked, or belonging to an inactive account SHALL return 401 `invalid_api_key`. The key's last-use time SHALL be updated with a resolution of about one hour.

#### Scenario: Missing header
- **WHEN** a conversion request has no `X-Api-Key`
- **THEN** the system responds 401 `missing_api_key`

#### Scenario: Unknown key
- **WHEN** a request uses `pdfs_doesnotexist`
- **THEN** the system responds 401 `invalid_api_key`
