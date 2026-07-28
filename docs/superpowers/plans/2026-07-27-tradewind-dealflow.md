# Tradewind DealFlow Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a polished local-first Tradewind DealFlow website that teaches and supports Massachusetts/Rhode Island wholesale operations without fabricated records or live outreach.

**Architecture:** Use the Sites vinext React starter with server-rendered public/routes and shared client workspaces. Persist a validated version-1 data envelope in browser storage; keep all calculations, matching, compliance dates, exports, and readiness gates deterministic and testable.

**Tech Stack:** React 19, TypeScript 5.9, vinext, Vite, Cloudflare Workers/Sites, browser `localStorage`, Node test runner, semantic HTML, modern CSS, minimal client JavaScript.

## Global constraints

- Production contains no fake property, seller, buyer, comparable, testimonial, revenue, performance, outreach, or deal data.
- Phase 1 performs no live outreach and sends no user record to an application backend.
- Massachusetts and Rhode Island paths remain visibly separate.
- Legal content is dated educational guidance with direct sources, not advice.
- The primary MAO formula is `ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee`.
- The percentage rule is labelled a heuristic.
- Rhode Island readiness fails closed while cancellation windows or attorney confirmation remain unresolved.
- Data deletion requires explicit confirmation.
- The interface supports 320-pixel mobile through desktop and keyboard navigation.

### Task 1: Failing domain and rendered-route tests

**Files:**
- Modify: `package.json`
- Replace: `tests/rendered-html.test.mjs`
- Create: `tests/domain.test.ts`

**Produces:** Executable specifications for calculations, imports, matching, cancellation windows, source/legal copy, routes, and empty states.

- [ ] Add tests for the primary formula, configurable heuristic, invalid numbers, buyer-match reasons/conflicts, versioned-import rejection, valid-import normalization, weekend/holiday handling, and attorney-confirmation flags.
- [ ] Add rendered HTML checks for the public brand and all eight workspace routes, state warnings, disclaimers, and absence of fake/demo copy.
- [ ] Run `npm test`; confirm failures come from missing product modules and starter UI.

### Task 2: Typed local domain and safe persistence

**Files:**
- Create: `lib/types.ts`
- Create: `lib/calculations.ts`
- Create: `lib/compliance.ts`
- Create: `lib/matching.ts`
- Create: `lib/import-export.ts`
- Create: `lib/content.ts`
- Create: `components/LocalDataProvider.tsx`

**Produces:** `createEmptyData`, `validateImport`, `calculateMao`, `calculateHeuristic`, `addBusinessDays`, `evaluateCancellationWindow`, `matchBuyer`, and local data actions.

- [ ] Implement the minimum pure logic needed by the failing tests.
- [ ] Run domain tests and confirm they pass.
- [ ] Implement hydration, versioned storage, export, validated import, and storage-failure messaging without default production records.
- [ ] Run domain tests again.

### Task 3: Brand shell and public home

**Files:**
- Replace: `app/page.tsx`
- Modify: `app/layout.tsx`
- Replace: `app/globals.css`
- Create: `components/PublicHome.tsx`
- Create: `components/BrandMark.tsx`
- Create: `components/WorkspaceShell.tsx`
- Create: `components/ConfirmDialog.tsx`
- Create: `components/LocalDataNotice.tsx`

**Produces:** Tradewind brand system, public positioning, pricing/value ladder, curriculum preview, honest limitations, and responsive app navigation.

- [ ] Implement public copy from the approved commercial model with no payment or enrollment mutation.
- [ ] Implement semantic navigation, skip link, visible focus, reduced motion, responsive layout, local-data warning, and accessible dialog.
- [ ] Remove starter preview code, marker, dependency, and metadata.
- [ ] Run the rendered home test and build.

### Task 4: Dashboard and Deal Lab

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/deal-lab/page.tsx`
- Create: `components/workspaces/Dashboard.tsx`
- Create: `components/workspaces/DealLab.tsx`

**Produces:** State/path readiness, user-derived metrics, 90-day progress, next actions, MAO, heuristic, exit views, risk notes, readiness gate, print/export.

- [ ] Render honest zero states and state-specific warnings.
- [ ] Wire all calculations to blank-by-default validated fields.
- [ ] Show the exact formula and entered terms; show no result when incomplete.
- [ ] Add local analysis save and print/export without network requests.
- [ ] Run domain and route tests.

### Task 5: Pipeline and Buyers

**Files:**
- Create: `app/pipeline/page.tsx`
- Create: `app/buyers/page.tsx`
- Create: `components/workspaces/Pipeline.tsx`
- Create: `components/workspaces/Buyers.tsx`

**Produces:** User-created deal/buyer CRUD, specified stages/buy boxes, CSV/JSON export, JSON import, guarded deletion, and explainable matching.

- [ ] Add labelled forms and validation; never pre-populate records.
- [ ] Add stage/state filtering and user-derived totals.
- [ ] Add import preview/error handling that preserves valid current state.
- [ ] Add proof status/freshness and matching reasons/conflicts.
- [ ] Add accessible destructive confirmation.
- [ ] Run domain and route tests.

### Task 6: Academy, Compliance, Resources, and Deal Desk

**Files:**
- Create: `app/academy/page.tsx`
- Create: `app/compliance/page.tsx`
- Create: `app/resources/page.tsx`
- Create: `app/deal-desk/page.tsx`
- Create: `components/workspaces/Academy.tsx`
- Create: `components/workspaces/Compliance.tsx`
- Create: `components/workspaces/Resources.tsx`
- Create: `components/workspaces/DealDesk.tsx`

**Produces:** Twelve modules, thirteen-week plan, state lanes, cancellation tracker, source library, checklists, local Deal Desk packet.

- [ ] Render every module’s summary, action, worksheet, knowledge check, and completion condition.
- [ ] Track completion locally and calculate progress.
- [ ] Implement separate seller/assignee Rhode Island windows and prevent readiness until resolved.
- [ ] Link official Massachusetts, Rhode Island, FTC, FCC, and public property sources with July 27, 2026 review labels.
- [ ] Export/print the Deal Desk packet and state that no relationship or promise is created.
- [ ] Run domain and route tests.

### Task 7: Documentation and automated verification

**Files:**
- Replace: `README.md`
- Create: `docs/operator-guide.md`
- Create: `docs/legal-source-baseline.md`
- Create: `docs/domain-connection.md`
- Create: `VERIFICATION.md`

**Produces:** Local-data/operator guidance, legal source inventory, Sites/custom-domain handoff, deferred Phase 2 scope, and actual test evidence.

- [ ] Document storage limitations, export/import, calculations, state gates, and no-outreach boundary.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; fix failures and record exact output.
- [ ] Search production source for fabricated claims, fake records, secrets, outreach mutations, and starter metadata.

### Task 8: Browser QA, commit, Sites version, and deployment

**Files:**
- Modify only files needed to fix verified browser/build issues.

**Produces:** A committed exact source state and a successful production Sites URL.

- [ ] Inspect desktop and 320-pixel views, visible focus, all route navigation, calculator behavior, local CRUD, import failure, deletion confirmation, and Rhode Island warnings.
- [ ] Generate and validate one site-specific social preview card; omit it if its text is not accurate.
- [ ] Re-run the complete verification after any fix.
- [ ] Commit the exact validated source and push it using the Sites source credential.
- [ ] Package that exact commit, save one Sites version, deploy privately when access permits, and poll to success.
- [ ] Open and verify the production URL.
