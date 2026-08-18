# 05 — Security narrative

Status: must match `docs/SECURITY_AND_PRIVACY.md`  
Do not claim controls that are not shipped.

## Implemented

- Private Sites authentication; APIs require the authenticated-user header
- Actor identity stored as SHA-256 of email, not plaintext
- Same-origin checks on lead and opportunity APIs
- Organization scoping for D1 leads and promoted opportunities
- Web Locks on every local workspace mutation
- Schema validation before import/restore
- Content Security Policy, anti-framing, MIME-sniffing, referrer, opener, and permission headers
- No secrets in client source
- MassGIS requests use an explicit property-field allowlist; owner/contact denylist
- Provider secrets only from server bindings
- Append-only audit and hash-bound approvals

## Known gaps a buyer will mark

- Working Pipeline historically lived only in the browser; durable opportunities are additive, not a full tenant platform
- No application-managed role system
- CSP currently permits inline script/style because the React/RSC build emits inline bootstrap content
- 4 MiB local workspace/backup limit
- No encrypted object storage for documents (Deal Work documents are metadata-only)
- Analytics redaction is “do not send PII,” not a third-party DPA packet

## Incident and recovery

See `docs/BACKUP_AND_RECOVERY.md`. Browser JSON does not back up D1. D1 does not replace an operator export.
