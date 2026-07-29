# Security and Privacy

Release: MassGIS ingestion

## Data-flow statement

The application stores working Pipeline data under the versioned browser key
`tradewind-dealflow:v2`. A D1 control plane stores MassGIS policies, run
status/counts, owner/contact-free staged parcel records, and append-only audit
events. There is no multi-device Pipeline synchronization, analytics event
collector, seller/buyer API, contact-enrichment service, or file-upload
service.

The Worker queries only the fixed official MassGIS endpoint and an explicit
property-field allowlist. Geometry and the owner/contact denylist are rejected.
The private Sites authentication layer supplies the authenticated-user header;
the API stores only its normalized SHA-256 actor hash, never plaintext email.

## Implemented controls

- No production-looking seed data
- Typed domain model and deterministic calculations
- Full schema validation before an import can replace current data
- Explicit confirmation before record deletion, full-data clearing, or import
  replacement
- React output encoding for rendered user text
- No raw HTML rendering of user-entered records
- No secrets in client source or required environment variables
- Content Security Policy, anti-framing, MIME-sniffing, referrer, opener, and
  browser-permission headers
- Minimal data fields for buyer verification; no sensitive document upload
- No network mutation for outreach, offers, agreements, payments, or Deal Desk
- Source API requires the Sites-authenticated user header, JSON bodies, a
  64 KiB body limit, and an idempotency key for manual runs
- Exact source-policy hashing, bounded pagination, transient-only retries,
  overlap rejection, and abort handling
- Append-only hash-chained audit events committed with state changes
- No owner/contact fields in MassGIS requests, D1 staged records, or local
  MassGIS import candidates
- Test fixtures remain in the test suite and are not loaded into production

The production Content Security Policy currently permits inline script and
style execution because the React/RSC build emits inline bootstrap content.
Phase 2 should adopt nonce- or hash-based CSP as part of its authenticated
server architecture.

## Operator responsibilities

- Use a trusted, patched device and browser with full-disk encryption.
- Do not use a shared browser profile for seller or buyer information.
- Export backups to encrypted storage with least-privilege access.
- Never paste passwords, API keys, identity documents, proof-of-funds files,
  account numbers, medical details, or unnecessary distress information into
  notes.
- Verify a backup before clearing browser storage or changing devices.
- Delete exported copies separately when a retention or deletion request
  requires it.
- Treat browser extensions as able to observe browser content; install only
  trusted extensions.

## Data loss and confidentiality limits

Local storage is not an encrypted database. Device compromise, a shared browser
profile, malicious extensions, browser reset, storage eviction, or clearing
site data can expose or erase records. Incognito/private sessions may discard
records automatically. The application cannot restore a backup the operator
did not create.

The D1 integration deliberately transmits only allowlisted property facts and
hashed actor IDs. It is not appropriate for owner/contact enrichment,
sensitive document custody, or regulated retention workflows.

## Data export and deletion

- Full export: Pipeline → **Export JSON**
- Pipeline convenience export: **Export CSV**
- Full restore: Pipeline → **Import JSON**, validate, then confirm replacement
- Record deletion: guarded per-record action
- Full local deletion: **Clear all local workspace data**, then confirm

Exports are outside application control after download. Maintain an inventory
and deletion process for copies in email, cloud drives, endpoints, and backups.

## Incident response

If a device, browser profile, or exported file may be compromised:

1. Stop using the affected workspace.
2. Preserve only the evidence needed for investigation without copying more
   personal data.
3. Disconnect unauthorized sync or sharing.
4. Notify the designated security/privacy lead and counsel.
5. Identify data categories, people, jurisdictions, and time range affected.
6. Rotate any unrelated credentials exposed on the device.
7. Determine legal, contractual, and insurance notice obligations.
8. Restore only from a known-good validated export.
9. Document cause, response, affected records, and preventive changes.

Do not put incident details containing personal information into a public issue.

## Controls required before broader server data or outreach

Before server-side personal data or outreach is enabled, require:

- managed passwordless authentication plus MFA where supported;
- tenant isolation and row-level authorization;
- encrypted PostgreSQL and object storage with managed keys;
- field-level protection for high-risk data;
- append-only audit and approval history;
- secrets manager and scoped provider credentials;
- webhook signatures and replay protection;
- CSRF protection for cookie-authenticated mutations;
- rate limiting, account lockout, session rotation, and short-lived sessions;
- configurable retention, legal hold, export, deletion, and backup testing;
- dependency, container, and infrastructure scanning;
- incident alerting, job monitoring, and provider kill switches;
- vendor security/privacy agreements and counsel-approved data purposes.
