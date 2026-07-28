# Authorized Property CSV Import

The import is local-first: selecting a file does not send its contents,
addresses, identifiers, notes, or qualification results to Tradewind.

## Downloaded launch template

The application downloads one header-only file:

```csv
source,source_record_id,retrieved_date,usage_rights,property_address,city,state,zip,verification_date,market,confidence,property_type,asking_price,rehab_level,owner_contact_status,next_action,notes
```

It contains no sample property row.

### Required columns

- `source`
- `source_record_id`
- `retrieved_date`
- `usage_rights`
- `property_address`
- `city`
- `state`
- `zip`

All other downloaded columns are optional. Blank optional fields remain
unknown; do not write `N/A`, `Unknown`, `TBD`, or `0` unless zero is the
verified fact.

### Accepted header aliases

The strict canonical headers remain accepted:

| Downloaded header | Canonical alias |
| --- | --- |
| `retrieved_date` | `retrieved_at` |
| `usage_rights` | `usage_classification` |
| `property_address` | `address` |
| `verification_date` | `last_verified_at` |

Headers are Unicode-normalized, trimmed, lowercased, and convert spaces or
hyphens to underscores. Aliases that resolve to the same field are duplicate
headers and are rejected. Unknown columns are rejected rather than silently
discarded.

## File limits

- UTF-8 only; one leading UTF-8 BOM is accepted, more than one is rejected
- 1 MiB maximum encoded file size
- 500 data rows
- 30 columns
- 10,000 decoded characters per field
- 1,000,000 decoded characters in aggregate

Malformed quoting, unclosed quotes, inconsistent row widths, invalid UTF-8,
and limit violations fail before apply.

## Field values

| Field | Accepted launch value |
| --- | --- |
| Dates | `YYYY-MM-DD`, or an ISO date-time with an explicit timezone; future dates are rejected |
| State | `MA` or `RI` |
| Usage rights | `Public record`, `Licensed provider`, `Direct submission`, `Authorized CRM`, `Operator research`, or `Restricted — research only` |
| Confidence | blank, `Low`, `Medium`, or `High` |
| Rehab level | blank, `Light`, `Moderate`, or `Heavy` |
| Asking price | blank or a nonnegative decimal with no symbol/comma and no more than two decimal places |
| Source record ID | text; leading zeroes are preserved |

Examples accepted for asking price: `250000`, `250000.00`. Examples rejected:
`$250,000`, `250k`, `approximately 250000`.

`estimated_value` is not silently treated as `asking_price`. It is an unknown
header in this fast-track format and is rejected.

## Prohibited columns

The launch import isolates property qualification from personal contact data.
It rejects owner, seller, or contact name, phone, and email columns.

It also rejects columns describing or inferring protected or highly sensitive
characteristics, including race, ethnicity, religion, sex, gender, sexual
orientation, disability, age/date of birth, marital or familial status,
national origin, citizenship or immigration status, and neighborhood
protected-class composition.

Do not rename a prohibited field to bypass validation.

## Preview decisions

Every valid candidate is planned into one visible category:

- safe new record;
- changed source snapshot;
- exact unchanged reimport;
- same-file duplicate;
- possible property match;
- held/rejected row; or
- confirmed attachment after operator review.

Validation errors are shown separately. The preview also counts potential fact
conflicts and restricted-source rows.

### Identity and duplicate rules

The current launch planner uses:

- normalized `source + source_record_id` for source identity; and
- exact normalized `state + city + property_address` for possible property
  identity.

Normalization preserves unit and number tokens and removes only periods and
commas for address comparison. It does not merge on owner name, mailing
address, phone, email, similar spelling, or value. Parcel-ID and registry-ID
identity are deferred because those fields are not in the current launch
schema.

An unchanged source fingerprint produces no new record or snapshot. A changed
fingerprint appends a source snapshot. Nonblank facts that contradict the
canonical property become visible conflicts; a blank new value remains
unknown and does not erase or contradict a known canonical fact.

Possible matches never attach automatically. Choose one listed existing
property only with reliable identity evidence, or hold the row outside
production.

## Atomic apply

The preview records the workspace revision and a full workspace fingerprint.
Apply rechecks both. A stale or tampered plan fails without writing.

All reviewed safe rows are applied in one named Web Lock and one local-storage
mutation. New properties enter `Research`. Held, invalid, exact-reimport, and
same-file-duplicate rows remain non-writing. Source restrictions remain
active. There is no partially committed batch.

The current default behavior applies valid nonconflicting rows while holding
review/error rows outside production. A “reject the entire batch on any row
error” mode is not implemented.

## Current reporting boundary

The preview is the import report for that selection. Source snapshots,
conflicts, restrictions, and the resulting property records persist in the
workspace, but an immutable import-batch audit record and historical import
summary do not. Export the JSON workspace after a material import.
