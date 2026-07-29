# Backup and Recovery

## What is stored

The current workspace is stored in the browser under:

```text
tradewind-dealflow:v2
```

The application can read a valid legacy `tradewind-dealflow:v1` workspace and
migrate it in memory without inventing provenance. The next successful
version-2 write stores the current format.

Browser local storage is not encrypted object storage or a managed backup.
Clearing site data, storage eviction, private-mode cleanup, browser-profile
damage, device loss, shared-profile access, or a malicious extension can erase
or expose records.

The D1 control plane separately stores the active/superseded MassGIS policies,
run status and counts, owner/contact-free staged parcel records, and the
append-only audit chain. Browser JSON export does not back up D1, and D1 does
not back up the working local Pipeline. Follow the platform D1 backup process
and periodically download the audit export in addition to browser backups.

## Create a recovery point

1. Open **Pipeline**.
2. Select **Export JSON backup**.
3. Keep the file name’s date or add a controlled version identifier.
4. Store it in an encrypted location with limited access.
5. Do not email it casually or commit it to source control.
6. Verify recovery periodically with synthetic data in an isolated browser
   profile.

The JSON export is the full workspace recovery format. **Export property CSV**
is a convenience property export and cannot restore configuration, source
history, conflicts, restrictions, or other workspace sections.

## Restore a valid backup

1. Export the current workspace first if it may be needed.
2. Select **Restore JSON backup**.
3. Choose a Tradewind JSON backup no larger than 4 MiB.
4. Wait for schema, relation, launch-scope, source-timestamp, and size
   validation.
5. Read any rejection message; the existing workspace remains unchanged.
6. Confirm **Replace workspace** only after checking the intended file.
7. Review the active buy box, record count, at least one property’s provenance,
   restrictions, and qualification.
8. Export a new recovery point.

Restore rejects malformed JSON, unsupported fields, incompatible relationships,
invalid launch configuration, invalid/future source dates, and oversized
files. It validates before replacement and writes through the same serialized
lock used for other mutations.

## Size and write protection

- JSON backup input: 4 MiB maximum, checked before and after text decoding
- Serialized workspace: 4 MiB maximum before local write
- Failed, invalid, quota-limited, or unavailable writes preserve the prior
  value
- All mutations use the named Web Lock
  `tradewind-dealflow:workspace-write`

When Web Locks are unavailable, CSV preview, current-data review, and exports
remain available. Restore, import apply, conflict/restriction resolution,
configuration changes, and clear are disabled. Use a current browser with Web
Locks; do not bypass the lock with developer tools.

## Corrupt storage recovery

If the current version-2 value is corrupt and a valid legacy value exists, the
app loads the legacy workspace as a recovery view without overwriting the
damaged current value. Export the recovered view, inspect it, and restore a
validated backup before relying on it.

If neither current nor legacy data validates:

1. Stop making changes.
2. Preserve the suspect browser profile for investigation if required.
3. Use **Restore JSON backup** to replace it with a known-good export.
4. If no backup exists and retention/legal-hold policy permits deletion, use
   **Clear local workspace** after confirmation.
5. Reimport only from the original authorized source.

The application cannot reconstruct data that was never exported or remains
only in a damaged local value.

## Clear

**Clear local workspace** removes both the version-2 and legacy browser keys
after confirmation. It does not delete downloaded backups, emailed copies,
cloud copies, screenshots, or records in source systems. Those copies require
their own retention and deletion process.

## Application rollback versus data recovery

A Sites rollback restores application code only. It does not change or recover
browser data or D1 rows. Pause the source schedule before rollback when
possible, retain D1 for investigation, follow
[Setup and deployment](DEPLOYMENT.md) for code rollback, and use this guide
for local Pipeline records.
