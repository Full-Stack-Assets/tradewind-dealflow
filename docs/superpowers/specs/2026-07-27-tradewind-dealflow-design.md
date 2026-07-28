# Tradewind DealFlow — Phase 1 Product Design

Date: July 27, 2026  
Status: Approved product direction  
Owner: Nic / Tradewind Automations

## Product definition

Tradewind DealFlow is a phased education, operations, and deal-support product for beginning and early-stage real estate wholesalers in Massachusetts and Rhode Island. Phase 1 combines a free readiness kit, an affordable membership offer, a structured 90-day accelerator, a compliant deal-submission desk, and a local-first operating workspace.

The public promise is a “90-Day First-Deal Execution System.” It describes a structured execution plan and is never presented as a guarantee that a user will contract or close a transaction within 90 days.

The first production deployment uses only real information entered or imported by the user. It contains no fabricated properties, buyers, testimonials, revenue claims, performance claims, activity, or production metrics. Official research links lead to real sources and carry a July 27, 2026 review date.

## Phase boundary

Phase 1 is a static-capable React application hosted on Sites. Seller, property, buyer, curriculum, and compliance state is versioned and stored only in the user’s browser. Users can export and re-import their records. The interface warns that clearing browser storage can erase data.

Phase 1 does not:

- send calls, texts, emails, social messages, or direct mail;
- transmit seller, buyer, address, analysis, or notes to an application backend;
- authenticate users or synchronize devices;
- process payments;
- ingest paid or automated property data;
- distribute executable contracts;
- contact buyers;
- represent a form as attorney-approved;
- collect deal submissions on a server; or
- collect analytics containing addresses, contacts, deal notes, or buyer data.

These capabilities remain documented Phase 2 work and require separate legal, privacy, provider, and security review.

## Product and commercial model

The public site presents four transparent offers:

- Free Deal Readiness Kit: state/readiness assessment, seven-day starter plan, basic MAO calculator, compliance checklist, and buyer-verification checklist.
- DealFlow Membership: $79/month for the full curriculum, resource vault, 90-day tracker, analysis, local pipeline/buyer tools, group support, and Deal Desk access.
- 90-Day Accelerator: $1,497 for a structured cohort, weekly milestones, reviews, buyer-list development, and closing-process guidance.
- Founding Cohort: $497 limited validation cohort before the standard accelerator price.

No purchase flow is present in Phase 1. Calls to action open the free workspace or explain the offering; they do not imply enrollment, availability, acceptance, funding, or closing.

The Deal Desk can prepare an exportable review packet. It states that a future review may lead to a lawful principal acquisition, funding, attorney-drafted joint venture, assignment, purchase, or licensed brokerage route. Preparing or sharing a packet does not create representation, agency, financing, acceptance, a compensation promise, or a closing commitment.

## Routes

The deployment includes:

- `/`: public home and transparent product positioning;
- `/dashboard`: state selection, readiness, progress, user-derived totals, and next actions;
- `/deal-lab`: transparent MAO calculator, heuristic comparison, exit views, risks, readiness, print/export;
- `/pipeline`: user-created deals, specified stages, import/export, filters, notes, and guarded deletion;
- `/buyers`: user-created buyers, verification metadata, and explainable selected-deal matching;
- `/academy`: twelve modules, action checklists, worksheets, knowledge checks, completion conditions, and a thirteen-week plan;
- `/compliance`: separate Massachusetts and Rhode Island lanes, outreach checklist, marketing-interest gate, and Rhode Island cancellation tracker;
- `/resources`: dated official sources, property research starting points, interview checklists, and educational specimens;
- `/deal-desk`: qualification, local submission preparation, review consent, disclaimers, print, and JSON export.

Every authenticated-looking workspace remains anonymous and device-local. No UI claims that the user has an account.

## Local data model

The local envelope is versioned:

```ts
type DealFlowData = {
  schemaVersion: 1;
  updatedAt: string;
  preferences: {
    selectedState: "MA" | "RI" | null;
    participationPath: "principal" | "licensed" | null;
  };
  deals: DealRecord[];
  buyers: BuyerRecord[];
  analyses: DealAnalysis[];
  curriculum: Record<string, boolean>;
  weekProgress: Record<string, boolean>;
  readinessChecks: Record<string, boolean>;
  compliance: ComplianceState;
  dealDeskDraft: DealDeskDraft;
};
```

New users receive an empty envelope containing configuration and completion state only. Production code never inserts a lead, buyer, address, comparable, testimonial, outreach result, or deal outcome.

Imports are parsed into a new candidate envelope, schema-validated, and normalized before replacing current state. Invalid imports leave the valid existing envelope untouched. Export filenames include the schema version and date. Pipeline CSV export uses proper escaping.

## Deal Lab

The primary deterministic formula is:

`MAO = ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee`

The UI shows each entered term and resulting subtraction. A secondary percentage-rule estimate is available with a user-visible percentage and is labelled a heuristic, not a valuation, appraisal, or universal acquisition rule.

Inputs are blank by default. Calculations reject negative, non-finite, or incomplete values. Results do not appear until required user inputs are valid. The tool provides risk notes and simple exit comparisons derived only from the same entered values; it never invents comparables, repairs, buyer interest, or offers.

The deal-readiness gate explains missing work. It never authorizes contact, contract execution, legal advice, or marketing. Marketing-interest readiness requires a selected state and participation path, an executed agreement, a recorded contractual/equitable interest, accurate disclosure that legal title is not held, and attorney review. Rhode Island also requires the applicable cancellation windows to be resolved.

## Pipeline and buyers

Pipeline stages are:

1. Research
2. Qualified
3. Contact Approved
4. Conversation
5. Offer
6. Contract
7. Disposition
8. Closing
9. Closed
10. Archived

Records are user-created and include state, property address, source, owner-contact status, next action, and notes. Phase 1 does not enable outreach.

Buyer profiles contain user-entered name/company, optional local contact details, geography, property type, price range, rehab tolerance, strategy, proof-of-funds status, and last verification date. Matching checks exact state/geography, type, price, rehab, strategy, proof status, and freshness. Every score lists matched and conflicting criteria. The UI does not claim interest, capacity, or performance beyond what the user recorded.

## Curriculum

The Academy contains twelve modules:

1. Fundamentals, ethics, and realistic expectations
2. Massachusetts and Rhode Island compliance lanes
3. Entity, banking, bookkeeping, insurance, and vendor setup
4. Market and neighborhood selection
5. Ethical lead sourcing
6. Comparable sales, repairs, ARV, rental value, and exits
7. Compliant channel planning
8. Seller discovery, negotiation, and offer construction
9. Agreements, contingencies, inspections, title, and attorneys
10. Buyer verification and equitable-interest marketing
11. Assignments, double closings, novations, purchases, and partnerships
12. Closing, accounting, review, and scaling

Each module has a summary, action checklist, worksheet/tool, knowledge check, and measurable completion condition. A thirteen-week execution plan maps preparation through review without promising a deal.

## State compliance architecture

### Massachusetts

The application links Massachusetts General Laws c. 112, §§ 87PP, 87QQ, and 87RR. It conservatively:

- asks whether the member acts as a principal or through a licensed and supervised brokerage route;
- does not mark an interest ready for marketing without an executed agreement and recorded contractual/equitable-interest basis;
- requires language describing the contractual interest rather than ownership of the property;
- requires disclosure that legal title is not held;
- warns against negotiating for another party without the required license; and
- requires applicable Massachusetts counsel review before execution or disposition.

### Rhode Island

Rhode Island 2026 Public Laws chapters 410 and 411 enacted H 7840 Substitute A and S 3136 Substitute A on June 23, 2026, effective January 1, 2027. The application:

- shows a persistent January 1, 2027 transition warning;
- defaults recurring Rhode Island wholesaling to the licensed pathway;
- applies the heightened disclosure workflow as a conservative operating control before the effective date;
- tracks seller and assignee three-business-day windows separately;
- does not mark a Rhode Island assignment ready while a window remains open;
- does not encourage reliance on a possible first-transaction interpretation; and
- requires Rhode Island counsel review before distribution of an executable contract.

The business-day tracker always excludes weekends. It excludes holidays only when the user enters dates from a verified calendar and affirms verification. Without that affirmation, the result is explicitly tentative and requires attorney confirmation.

All legal content is educational operational guidance, not legal, tax, brokerage, appraisal, financial, or investment advice.

## Outreach controls

Phase 1 contains planning and logging checklists only. It has no send buttons or provider code.

The later-phase checklist covers Massachusetts/Rhode Island registration, federal/state/company suppression, channel-specific consent evidence, calling hours, caller identity/disclosures, immediate opt-out handling, campaign approval, and immutable audit history. Automated cold texts, prerecorded or AI voice calls, and mass dialing remain disabled pending campaign-specific counsel approval and required consent.

## Visual direction

The brand is Tradewind DealFlow with descriptor “New England Wholesale OS.” The visual system uses midnight navy, Atlantic teal, sea-glass green, warm sand, and restrained coral. Typography is modern, direct, and numerically clear. CSS-based navigation lines, map grids, waypoints, and coastal contours create a New England operations feel without guru-funnel imagery.

The UI is responsive from 320 pixels through desktop, keyboard usable, semantically structured, visibly focused, high-contrast, reduced-motion aware, and explicit about empty states. Destructive actions use an accessible confirmation dialog.

## Validation

Production is ready only when:

- unit tests cover MAO, heuristic labels, matching, import rejection, and Rhode Island business-day behavior;
- the production build and route rendering pass;
- all nine routes load with honest zero-data states;
- Massachusetts and Rhode Island warnings appear in their relevant contexts;
- invalid imports never overwrite valid local data;
- deletion requires confirmation;
- keyboard and focus behavior pass browser review;
- 320-pixel mobile and desktop layouts pass browser inspection;
- every legal claim links to a dated source and disclaimer;
- no form or code path sends live outreach; and
- the deployed production URL loads successfully.

## Phase 2 continuity

The earlier full acquisition-platform requirements remain a future architecture target: authenticated encrypted storage, role-based access, provenance-aware ingestion, approvals, audit logs, underwriting, seller inbox, provider integrations, durable jobs, reporting, and automated but compliant follow-up. None is implied to exist in Phase 1.
