# public-website Specification

## Purpose

The public website (pdfservices.sistema.site) presents the service and its price, publishes the legal texts and integration guides, and lets companies sign up.

## Requirements

### Requirement: Content works without the API
The home page SHALL present the service, its price per conversion, the privacy promise, the open-source license and an FAQ, with all essential content present in the HTML itself. The price SHALL be refreshed from `GET /v1/capabilities` when available and SHALL fall back to the static value when the API cannot be reached.

#### Scenario: API offline
- **WHEN** the API is unreachable while a visitor opens the home page
- **THEN** the page still shows the price, navigation and signup link

### Requirement: Signup page
The `/cadastro` page SHALL collect name, company name, CNPJ (with input mask), e-mail, password with confirmation and acceptance of the Terms and Privacy Policy, SHALL validate them in the browser with the same rules as the API, SHALL require the bot check, and on acceptance SHALL show a "check your e-mail" state. Field errors returned by the API SHALL be shown on the matching fields.

#### Scenario: Invalid CNPJ in the browser
- **WHEN** a visitor types a CNPJ with wrong check digits and submits
- **THEN** the page shows a CNPJ error without calling the API

#### Scenario: Successful signup
- **WHEN** the API accepts the signup
- **THEN** the page shows the "Confira seu e-mail" confirmation

### Requirement: Public pages
The website SHALL publish the Terms of Use (`/termos`), the Privacy Policy (`/privacidade`) and integration guides for C#, Node.js and Python (`/gerar-pdf-a-partir-de-html-em-{csharp,nodejs,python}`). Every public page SHALL be listed in `sitemap.xml`, and unknown paths SHALL show a 404 page.

#### Scenario: New public page
- **WHEN** a public page is added to the website
- **THEN** it is also added to the sitemap

### Requirement: Environment detection
The website and the panel SHALL use the local API and Turnstile test key when served from `localhost` or `127.0.0.1`, and the production API and site key otherwise. No secret SHALL be present in frontend code.

#### Scenario: Local development
- **WHEN** the site is served from `http://localhost:5501`
- **THEN** API calls go to `http://localhost:7215`
