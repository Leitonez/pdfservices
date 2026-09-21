# Proposal

## Why

PDF Services shipped its first MVP (API, customer panel and public website) without any written specification: the behavior lives only in the code and in private notes. A baseline spec of the service *as it is today* gives future changes a contract to diff against, so every later proposal can state precisely which requirements it adds, modifies or removes.

## What Changes

- Document the current, already-deployed behavior of the service as OpenSpec requirements. **No code, configuration or behavior changes.**
- Capture contract-level and security-relevant values (size limits, lockout policy, token lifetimes, key limits, retention periods) as requirements; leave pure tuning details and implementation choices out.
- Capture the frontends only at the behavior level (flows, session handling, what each screen does). Visual identity and SEO details are out of scope.
- Record deliberate, possibly surprising behaviors as they are, for example: a password reset also confirms the e-mail; deleting an account forfeits the remaining balance; price changes can take a few minutes to reach clients because of caching.

## Capabilities

### New Capabilities

- `html-to-pdf-conversion`: the `POST /v1/html2pdf/{json|html}` endpoint: input formats, charset handling, size limit, error handling without charge, PDF producer metadata and response headers.
- `external-resource-policy`: which external resources a conversion may load (https images only, PNG/JPEG), network-level SSRF protections and per-conversion limits.
- `billing-and-usage`: capability pricing, balance checks, atomic debit per successful conversion, daily usage aggregates and the paginated transaction statement.
- `api-keys`: creation, listing, revocation and authentication of API keys.
- `account-authentication`: signup, e-mail verification, login and lockout, password recovery, bot protection and portal session tokens.
- `account-management`: viewing the account, changing the password and deleting the account.
- `privacy-and-compliance`: no storage or logging of documents, access-log retention, AGPL source-code offer headers, public endpoints and the uniform error format.
- `customer-panel`: behavior of the logged-in panel (routes, session handling, test screen, credits placeholder).
- `public-website`: behavior of the public website (live pricing with static fallback, signup form, legal pages).

### Modified Capabilities

(none, there are no existing specs)

## Impact

- Adds `openspec/specs/*` after the change is archived. No effect on `api/`, `admin/` or `website/`.
- From then on, every change that alters behavior must include delta specs against this baseline.
- When the code and this baseline disagree, the code is authoritative for this change: the specs were written from the code, and a mismatch is a documentation bug unless someone decides otherwise.
