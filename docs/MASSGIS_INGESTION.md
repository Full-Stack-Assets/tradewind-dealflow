# MassGIS Ingestion Operations

Release: `massgis-ingestion`

## What the integration does

Tradewind queries the official MassGIS Property Tax Parcels service, item
`73d4c766167848b795f1048cad3919c7`, layer `0`. One approved, versioned policy
controls the towns, property-use codes, unit counts, assessed-value ceiling,
year-built ceiling, last-sale age, page size, run cap, and daily schedule.
Manual and scheduled runs call the same runner and produce the same
classifications.

The Worker requests only the explicit parcel/property allowlist. It sets
`returnGeometry=false`, orders by `OBJECTID`, pages sequentially, bounds every
run, retries only transient failures, and rejects schema changes or malformed
records. It never requests or retains owner names, owner mailing addresses,
phone numbers, or email addresses.

## Approve and run

1. Open **Sources**.
2. Review town IDs, use codes, unit counts, value/year filters, run cap, and
   the `America/New_York` schedule.
3. Select **Approve policy**. Material changes create a new version and hash;
   the prior active version is superseded.
4. Select **Run now**, or leave the daily schedule enabled. An hourly Worker
   trigger evaluates the daily schedule and creates at most one due run.
5. Review safe, duplicate, changed, and exception totals. Exceptions are
   grouped by reason and do not block safe records from staging.

Standing approval covers the exact policy, not arbitrary endpoints, fields, or
future material changes. It does not approve contact, an offer, a contract,
marketing, payment, or an AI decision.

## Import staged records

Select **Import all safe records** once. The browser converts every unimported
safe record to the existing authorized lead shape and applies the entire batch
through one Web-Locked local mutation. New properties enter `Research`.
Changed source facts preserve source assertions and conflicts. Possible local
property matches are held outside production. Server-classified exceptions are
excluded.

After the local write, the browser acknowledges imported D1 record IDs. If the
acknowledgement is lost, the page shows a retry notice. Repeating the import is
safe because the local source identity and fingerprint rules produce exact
reimports rather than duplicate deals.

## Audit and incident controls

**Download audit** exports the append-only D1 event chain. Each event hash is
`SHA256(previousHash + canonicalEvent)`, and each state change and audit append
share one D1 batch. Actor IDs are SHA-256 hashes of the normalized
Sites-authenticated email; the plaintext email is not stored.

To stop new retrieval, approve a policy with scheduling disabled. In an
incident, preserve the audit export and relevant D1 backup, stop runs, and
follow the security incident procedure. Never paste owner/contact data into
policy fields or local notes.

## Backup and rollback boundaries

D1 stores policies, run status/counts, owner-free staged records, and audit
events. Browser storage remains the system of record for the working Pipeline.
A browser JSON backup does not contain D1 history; a D1 backup does not contain
the local Pipeline. Protect and test both independently.

Rolling back Sites restores code only. Before rollback, disable scheduling when
the current release can still be operated. Deploy the prior saved version,
verify health and private access, and retain D1 for investigation. A code
rollback does not reverse already imported browser records or delete D1 rows.
