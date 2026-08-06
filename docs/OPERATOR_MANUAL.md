# Tradewind DealFlow Operator Manual

Release: MassGIS ingestion lead engine

Operating baseline: July 28, 2026

## Safety boundary

The current release prepares and prioritizes research. It does not send a
telephone call, text, email, direct-mail order, offer, contract, public
marketing item, sensitive disclosure, payment, or closing instruction.

Use only real records from a lawful public source, a properly licensed source,
an authorized CRM, a direct submission, or the operator’s permitted research.
Do not enter protected characteristics or use them to prioritize people or
neighborhoods. A property indicator is not seller motivation or permission to
contact anyone.

## Shortest usable workflow

1. Open **Pipeline** and review the active launch buy box.
2. Open **Sources**, review the owner-free MassGIS policy, and approve its exact
   scope.
3. Select **Run now** or wait for the daily schedule.
4. Review safe, duplicate, changed, and grouped exception counts.
5. Select **Import all safe records** once. Every new property enters
   `Research`.
6. For a non-MassGIS authorized source, download the blank CSV template.
7. Fill it with records from one authorized source and preserve the
   source-provided identifiers.
8. Select the file. It remains in the browser.
9. Review every validation error, duplicate, changed snapshot, possible
   property match, source restriction, and potential conflict.
10. Attach a possible match only when the listed property identity is reliable;
   otherwise hold it outside production.
11. Apply safe records. Every new property enters `Research`.
12. Open **Dashboard** and work the highest-priority research item.
13. Return to **Pipeline**, review the property’s qualification and provenance,
   and record only evidence-backed conflict or restriction decisions.
14. Export a JSON backup after meaningful changes and retain D1 audit/backups
    under the separate operational process.

## Operate MassGIS retrieval

The initial editable scope uses Fall River town ID `95`, New Bedford town ID
`201`, residential use codes `101`, `104`, `105`, and `111`, unit counts one
through four, and a daily 02:00 `America/New_York` schedule. Approval covers
only the displayed policy hash. Every material edit requires a new approval.

Manual and scheduled runs use one runner. Exact reruns add no staged record.
Changed fingerprints stage a conflict. Malformed or schema-drifted records are
grouped as exceptions while safe pages remain durable. Download the audit from
Sources when release, incident, or compliance evidence is required.

## Configure the launch buy box

The launch form is deliberately narrow:

- Bristol County, Massachusetts;
- Providence County, Rhode Island;
- single-family, duplex, triplex, and four-unit residential properties.

The form may narrow the active states but cannot expand beyond those launch
counties or property types. A material save creates a new version. An
equivalent save retains the current version and timestamp.

The default financial thresholds are configuration and qualification inputs,
not an offer formula or legal approval. Review
[Scoring and underwriting](SCORING_AND_UNDERWRITING.md) before interpreting a
result.

## Review an import

Use the preview as the current import report:

- **Safe new records** create new `Research` properties.
- **Changed source snapshots** append a new source record and preserve
  contradictory facts for review.
- **Exact unchanged reimports** write nothing.
- **Same-file duplicates** write nothing.
- **Possible property matches** must be attached to one listed property or
  held outside production.
- **Held/rejected rows** never enter the workspace.
- **Restricted-source rows** preserve a source-derived contact block.

`Apply safe records` remains disabled when no safe row exists, a possible
match is unresolved, the preview is stale, storage is corrupt, or Web Locks
are unavailable. See [Data import](DATA_IMPORT.md) for the exact contract.

## Work the Dashboard

The Dashboard is a current operating snapshot. It answers:

- which buy-box version is active;
- how many real records are in each launch qualification status;
- which records lack provenance, confidence, or verification;
- which conflicts, restrictions, and contact blocks are active;
- which research tasks have the highest current Task 5 priority; and
- whether local storage can be written safely.

Until browser storage has been successfully inspected, the Dashboard shows a
loading boundary and withholds configuration, counts, priorities, and write
claims. If storage is corrupt or unavailable, those facts remain `Not enough
data`; open Pipeline to use the existing restore or clear controls.

An invalid or oversized proposed change is rejected without changing the
trusted snapshot; it does not by itself remove write capability. Missing Web
Locks, corrupt or unavailable storage, and an actual quota/write failure stay
fail-closed.

It is not a historical daily report. The local schema does not retain an event
ledger, import batches, prior score results, or “what changed” history.
Freshness and research priority use the Dashboard page-load date. Reload the
page to refresh that date-sensitive evaluation.

## Review a property

Each Pipeline property shows:

- the five launch evidence categories and resulting qualification status;
- the assessed-only preliminary score or `Unavailable`;
- exact positive and negative reasons;
- missing or unknown facts;
- source freshness and confidence;
- restrictions and disqualifiers;
- contact status and reason;
- the next derived research task;
- source snapshots and usage rights; and
- conflict and restriction history.

Resolve a fact conflict only after recording the evidence basis. Choosing the
asserted value updates the canonical fact; choosing the canonical value leaves
it in place. In either case, the source snapshot remains.

Only operator- or migration-created restrictions can be resolved from the
current control. The reason must contain a valid `YYYY-MM-DD` review date.
Source-derived restrictions cannot be deleted or directly resolved there.

## Daily operating checklist

- [ ] Check Dashboard storage health and active buy-box version.
- [ ] Review contact blocks and compliance/specialist items first.
- [ ] Work the highest research-priority property.
- [ ] Verify ownership and property identity outside the app using authorized
      sources.
- [ ] Add no fact that cannot be sourced.
- [ ] Resolve no conflict without a recorded evidence basis.
- [ ] Treat unknowns as unknowns.
- [ ] Initiate no contact based on a score.
- [ ] Export a JSON backup after material changes.
- [ ] Record legal or professional questions for the appropriate reviewer.

## Control-plane approvals

The D1-backed Approval Queue is available at `/approvals` for control-plane
requests created by the application. Before deciding a request, confirm the
envelope hash, action scope, evidence, authority, expiry, and separation of
duties. A decision is valid only for the exact envelope hash shown in the
request; envelope mutation invalidates the request and requires a new review.

The queue is an approval record, not a substitute for legal or compliance
review. Seller engagement, buyer intake and matching, closing coordination,
and realized economics remain outside this milestone. Manual work outside the
app remains subject to company policy, data rights, counsel review, and the
human approval gates described in
[Compliance review](COMPLIANCE_REVIEW_CHECKLIST.md).

The existing local Deal Lab calculator is not an appraisal or the deferred
underwriting engine. The existing Buyers workspace does not replace a
documented buyer-verification process.

## Escalate instead of proceeding

Stop persuasive activity and seek specialist review when there is identity or
ownership uncertainty, an ownership change, a source restriction, an opt-out,
a complaint, attorney involvement, foreclosure, bankruptcy, probate
complexity, incapacity, disputed authority, environmental/title risk, or a
request for legal advice.

Do not use the app to sign or send legal documents, bind a party, choose a
final buyer, accept or transfer money, record a document, or issue closing
instructions.

## Backup discipline

Browser clearing, eviction, a damaged profile, device loss, or private-mode
cleanup can erase local records. Use **Pipeline → Export JSON backup** after
meaningful changes and follow
[Backup and recovery](BACKUP_AND_RECOVERY.md).
