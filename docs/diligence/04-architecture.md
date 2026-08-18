# 04 — Architecture (diligence one-pager)

Status: matches shipped code as of the 2026-08-18 increment  
Hosting: private OpenAI Sites plus Cloudflare Worker/D1

## Runtime

- Responsive React 19 / Next 16 (Vinext) UI
- Cloudflare Worker entry in `worker/index.ts`
- D1/SQLite for MassGIS control plane, automated leads, approvals/ledger, and promoted opportunities
- Browser `localStorage` key `tradewind-dealflow:v2` as the working cache and recovery copy
- Hourly cron for bounded MassGIS retrieval and optional RentCast enrichment

## Data stores

| Store | Holds | Does not hold |
| --- | --- | --- |
| D1 `source_policies`, `ingestion_runs`, `source_records`, `audit_events` | Owner-free MassGIS policy, runs, staged parcels, hash-chained audit | Seller contact, offers, money |
| D1 `automated_leads`, `lead_owner_profiles`, `lead_enrichment_attempts` | Canonical leads; RentCast owner names/mailing when activated | Phone/email invention; secrets |
| D1 control-plane tables | Hash-bound approvals, ledger, webhook receipts | Live outreach by default |
| D1 `promoted_opportunities` | Organization-scoped deal JSON and seller-workspace JSON | Executable legal documents |
| Browser `tradewind-dealflow:v2` | Working buy box, deals, Deal Work drafts, educational utilities | Multi-device sync by itself |

## Fail-closed providers

Adapters exist for MassGIS, RentCast, ElevenLabs, skip-tracing, and draft-only OpenAI field generation. Missing secrets, approvals, or kill switches fail closed. `/healthz` reports `outreach: "disabled"` unless a separately authorized configuration exists.

## Operator loop after this increment

1. Scheduled MassGIS run stages owner-free parcels.
2. Optional RentCast enrichment writes owner facts server-side.
3. Pipeline reviews D1 leads.
4. Promote copies a provenance-preserving `DealRecord` into D1 opportunities and the local workspace.
5. Deal Work records conversation, tasks, comps, and repairs against that deal id.
6. Deal Work mutations persist the seller-workspace slice back to D1.

Qualification still does not authorize contact. Formal offers, contracts, and closing remain human-gated and unimplemented as production actions.
