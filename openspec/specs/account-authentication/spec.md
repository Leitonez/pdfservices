# account-authentication Specification

## Purpose

Lets companies create an account, prove ownership of their e-mail, sign in to the customer panel and recover access, while resisting bots, brute force and account enumeration.

## Requirements

### Requirement: Company signup
The system SHALL expose `POST /v1/auth/signup` accepting name (3-120 characters), company name (2-200), CNPJ, e-mail, password, acceptance of the Terms and Privacy Policy and a bot-check token. Invalid fields SHALL return 400 `validation_error` with a per-field `fields` map. A valid signup SHALL create an active account with zero balance and an unverified e-mail, and SHALL send a verification e-mail. The response SHALL be 202 with a generic "check your e-mail" message.

#### Scenario: Valid signup
- **WHEN** a visitor submits valid data and a valid bot-check token
- **THEN** the system responds 202, creates the account unverified and sends a verification e-mail

#### Scenario: Terms not accepted
- **WHEN** `acceptTerms` is false
- **THEN** the system responds 400 `validation_error` with an `acceptTerms` field error

### Requirement: CNPJ validation
The CNPJ SHALL be normalized (uppercased; dots, slashes, hyphens and spaces removed) and SHALL be valid in either the numeric format or the alphanumeric format of IN RFB 2.229/2024: 14 characters, the first 12 digits or letters and the last 2 numeric check digits, each character valued at its ASCII code minus 48. A CNPJ made of a single repeated character SHALL be rejected. The website SHALL apply the same validity rule before submitting and SHALL send the CNPJ already normalized.

#### Scenario: Alphanumeric CNPJ
- **WHEN** a visitor enters a valid alphanumeric CNPJ such as `12.ABC.345/01DE-35`
- **THEN** it is accepted

#### Scenario: Wrong check digits
- **WHEN** a visitor enters a CNPJ with wrong check digits
- **THEN** the system responds 400 with a `cnpj` field error

### Requirement: No e-mail enumeration
Signup, resend-verification and forgot-password SHALL give the same response whether or not the e-mail is registered. A signup with an e-mail that is already verified SHALL send that address a notice instead of creating an account; a signup with an e-mail pending verification SHALL resend the verification. E-mail addresses SHALL be unique across active accounts, compared after trimming and lowercasing; the e-mail of a deleted account SHALL become available again.

#### Scenario: Signup with a registered e-mail
- **WHEN** someone signs up with an e-mail that already has a verified account
- **THEN** the response is the same 202 as a new signup and the owner receives an e-mail saying an account already exists

#### Scenario: Forgot password for unknown e-mail
- **WHEN** someone requests a reset for an unregistered e-mail
- **THEN** the response is the same 202 message and no e-mail is sent

### Requirement: Bot protection
Signup, login, resend-verification and forgot-password SHALL require a Cloudflare Turnstile token whose action matches the operation (`signup`, `login`, `resend`, `forgot`) and whose hostname is one of the configured allowed hostnames. A missing, oversized or rejected token SHALL return 400 `bot_check_failed`. When the verification service answers with an error, cannot be reached, or the server has no secret configured, the request SHALL be refused with 503 `bot_check_unavailable`. The hostname and action checks SHALL apply whenever allowed hostnames are configured; with no allowed hostnames (local development with Cloudflare test keys only) they are skipped.

#### Scenario: Token for another action
- **WHEN** a login request carries a token issued for the `signup` action
- **THEN** the system responds 400 `bot_check_failed`

#### Scenario: Missing token
- **WHEN** a signup request has no `turnstileToken`
- **THEN** the system responds 400 `bot_check_failed`

#### Scenario: Verification service down
- **WHEN** Cloudflare's verification endpoint returns an HTTP error
- **THEN** the system responds 503 `bot_check_unavailable`

### Requirement: E-mail verification
Verification links SHALL point to the panel's `/verificar-email` page with a single-use token in the URL fragment (`#token=...`), valid for 48 hours. `POST /v1/auth/verify-email` SHALL consume the token and mark the e-mail verified; an unknown, expired, already used or wrong-purpose token SHALL return 400 `invalid_token`. `POST /v1/auth/resend-verification` SHALL send a new link when an active account with that e-mail is still unverified.

#### Scenario: Valid link
- **WHEN** the customer opens the verification link within 48 hours
- **THEN** the e-mail is marked verified and the page says they can sign in

#### Scenario: Reused link
- **WHEN** the same link is used a second time
- **THEN** the system responds 400 `invalid_token`

### Requirement: Login
`POST /v1/auth/login` SHALL accept e-mail, password and a bot-check token and, on success, return an access token, its expiry and the account. Wrong e-mail or password SHALL return 401 `invalid_credentials` with the same message and similar timing whether or not the account exists. A correct password on an unverified account SHALL return 403 `email_not_verified`. Each successful login SHALL be recorded in the access log with the client IP.

#### Scenario: Successful login
- **WHEN** a verified customer submits the correct password
- **THEN** the system returns an access token valid for 8 hours and the account data

#### Scenario: Unverified e-mail
- **WHEN** a customer with an unverified e-mail submits the correct password
- **THEN** the system responds 403 `email_not_verified`

### Requirement: Login lockout
After 5 consecutive wrong passwords the account SHALL be locked for 15 minutes; logins during the lockout SHALL return 429 `account_locked`. A successful login, password reset or lockout start SHALL reset the failure counter.

#### Scenario: Fifth failure
- **WHEN** a wrong password is submitted for the fifth consecutive time
- **THEN** further logins, even with the correct password, return 429 `account_locked` for 15 minutes

### Requirement: Password policy and storage
Passwords SHALL have 10 to 128 characters. They SHALL be stored only as salted PBKDF2-HMAC-SHA256 hashes with 600,000 iterations and compared in constant time.

#### Scenario: Short password
- **WHEN** a visitor signs up with a 9-character password
- **THEN** the system responds 400 with a `password` field error

### Requirement: Password recovery
`POST /v1/auth/forgot-password` SHALL e-mail a reset link to an active account, pointing to the panel's `/redefinir-senha` page with a single-use token in the URL fragment, valid for 60 minutes. `POST /v1/auth/reset-password` SHALL validate the new password, consume the token, set the new password, end all existing sessions, clear the lockout, mark the e-mail verified (the link proves ownership) and send a "password changed" notice. An invalid token SHALL return 400 `invalid_token`.

#### Scenario: Reset also verifies the e-mail
- **WHEN** a customer with an unverified e-mail completes a password reset
- **THEN** the password is changed and the e-mail becomes verified

#### Scenario: Expired reset link
- **WHEN** the reset link is used after 60 minutes
- **THEN** the system responds 400 `invalid_token`

### Requirement: Portal session tokens
Access tokens SHALL be signed JWTs (HMAC-SHA256) issued by `https://api.pdfservices.sistema.site` for the audience `https://my.pdfservices.sistema.site`, valid for 8 hours, carrying the account id and the account's security stamp. Portal endpoints SHALL require `Authorization: Bearer <token>` and SHALL reject with 401 `unauthorized` a token that is invalid, expired, for an inactive account, or whose security stamp no longer matches (password changed or reset, account deleted).

#### Scenario: Password changed elsewhere
- **WHEN** a customer changes the password in one browser
- **THEN** requests from other browsers with older tokens receive 401 `unauthorized`

### Requirement: E-mail tokens are stored only as hashes
Verification and reset tokens SHALL be random (32 bytes), stored only as a SHA-256 hash with their purpose and expiry, deleted when consumed, and removed automatically after expiry. E-mail delivery failures SHALL be logged without breaking the calling flow.

#### Scenario: Token not recoverable from storage
- **WHEN** the token store is read
- **THEN** it contains hashes only, never the token sent by e-mail
