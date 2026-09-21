# Spec Delta

## Purpose

The customer panel (my.pdfservices.sistema.site) is where a logged-in company tracks consumption, manages API keys, reads the docs, tries the API and manages its account.

## ADDED Requirements

### Requirement: Panel sections
The logged-in panel SHALL offer the sections Consumo (`#/consumo`, default), Chaves de API (`#/chaves`), Documentação (`#/documentacao`), Executar Teste (`#/teste`), Minha conta (`#/conta`) and Comprar créditos (`#/creditos`), and SHALL always show the current balance, highlighting a zero balance. An unknown route SHALL open the default section.

#### Scenario: Unknown route
- **WHEN** a logged-in customer opens `#/nao-existe`
- **THEN** the panel shows Consumo

### Requirement: Session handling in the browser
The panel SHALL keep the session (token, expiry and account) in the browser's local storage and SHALL treat it as ended shortly before the token expires. Opening the panel without a valid session SHALL redirect to the login page, preserving the requested section as a `next` parameter that only accepts panel routes. Any 401 from the API SHALL end the session and return to login. Logging out or switching accounts in one tab SHALL be followed by the other open tabs.

#### Scenario: Expired session
- **WHEN** the stored token has expired and the customer opens `#/chaves`
- **THEN** the panel redirects to login and returns to `#/chaves` after signing in

#### Scenario: Unsafe next parameter
- **WHEN** the login page receives `next=https://evil.example`
- **THEN** after login the customer is sent to the default section

### Requirement: E-mail link pages
The verify-e-mail and reset-password pages SHALL read the token from the URL fragment and remove it from the address bar right away. Without a token, a logged-in customer SHALL be sent to the panel. The login page SHALL let a customer with an unverified e-mail request a new verification link.

#### Scenario: Token removed from the address bar
- **WHEN** a customer opens a verification link
- **THEN** the `#token=...` fragment disappears from the address bar before the request is made

### Requirement: Consumption view
The Consumo section SHALL show, for a selectable period (default: last 30 days), total calls, total amount, a per-day chart with an accessible table alternative, totals per capability and the transaction statement with incremental loading.

#### Scenario: Load more transactions
- **WHEN** the customer asks for more transactions
- **THEN** the next page is appended using the continuation token

### Requirement: API key view
The Chaves de API section SHALL list keys by name and prefix, SHALL show the full key only in the creation dialog and discard it from memory when the dialog closes, SHALL ask for confirmation before deleting, and SHALL prevent creating more than 20 keys.

#### Scenario: Key visible only at creation
- **WHEN** the customer closes the creation dialog
- **THEN** the full key can no longer be seen in the panel

### Requirement: Test screen
The Executar Teste section SHALL let the customer paste an API key (masked by default, never stored) and run a capability with editable parameters, calling the real API, which is charged like any call. For `html2pdf` it SHALL offer an HTML field with a sample document, and on success SHALL show the charged amount, new balance, transaction id and blocked resources, with preview and download of the PDF. It SHALL also show the equivalent `curl` command without the real key.

#### Scenario: Successful test
- **WHEN** the customer runs the test with a valid key
- **THEN** the PDF can be previewed and downloaded and the displayed balance is updated

#### Scenario: Key typed without prefix
- **WHEN** the customer enters a key that does not start with `pdfs_`
- **THEN** the screen shows a field error without calling the API

### Requirement: Account view
The Minha conta section SHALL show the account data, allow changing the password (requiring a confirmation that matches and a new password different from the current one) and allow deleting the account after the password and an explicit acknowledgement of the consequences.

#### Scenario: Deletion requires acknowledgement
- **WHEN** the customer has not ticked the acknowledgement
- **THEN** the deletion cannot be confirmed

### Requirement: Credits purchase placeholder
The Comprar créditos section SHALL be marked "Em breve" and SHALL NOT process payments; it SHALL direct the customer to the commercial contact.

#### Scenario: Credits page
- **WHEN** the customer opens `#/creditos`
- **THEN** no payment form is shown and the contact is offered
