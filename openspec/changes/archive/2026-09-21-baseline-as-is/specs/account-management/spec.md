# Spec Delta

## Purpose

Lets a logged-in customer see their account, change their password and delete their account, in line with LGPD rights while keeping the records required by law.

## ADDED Requirements

### Requirement: View account
`GET /v1/account` SHALL return the logged-in customer's account: id, name, company name, CNPJ, e-mail, e-mail verified flag, balance, currency and creation date. It SHALL NOT return the password hash, security stamp or lockout data.

#### Scenario: Account data
- **WHEN** a logged-in customer requests `/v1/account`
- **THEN** the response contains their company data and current balance

### Requirement: Change password
`POST /v1/account/change-password` SHALL require the current password and a new password meeting the password policy. A wrong current password SHALL return 400 `invalid_password` with a `currentPassword` field error. On success the system SHALL end every other session, send a "password changed" notice and return a fresh session for the current client.

#### Scenario: Change and keep this session
- **WHEN** a customer changes the password with the correct current password
- **THEN** the response contains a new access token, and tokens issued before the change stop working

#### Scenario: Wrong current password
- **WHEN** the current password is wrong
- **THEN** the system responds 400 `invalid_password`

### Requirement: Delete account
`POST /v1/account/delete` SHALL require the account password (wrong password: 400 `invalid_password`). On success the system SHALL, in this order: mark the account deleted, erase name, e-mail and password hash, move the remaining balance to a forfeited-balance field and set the balance to zero, and end every session; then revoke all API keys and free the e-mail for new signups. Company name, CNPJ, transactions and usage SHALL be kept for legal and tax obligations. Billing SHALL stop as soon as the account is marked deleted, without losing a concurrent debit.

#### Scenario: Deletion
- **WHEN** a customer confirms deletion with the correct password
- **THEN** the response is 200, their API keys stop working, they cannot log in, and the remaining balance is forfeited

#### Scenario: Re-signup after deletion
- **WHEN** someone signs up again with the deleted account's e-mail
- **THEN** a new, separate account is created
