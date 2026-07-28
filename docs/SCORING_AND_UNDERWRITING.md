# Scoring and Underwriting Boundary

## Implemented in Milestone 1: qualification

Tradewind DealFlow currently derives an explainable qualification result from
the active buy-box version, the current property record, its source
assertions, conflicts, restrictions, and the evaluation date.

Qualification is recalculated in the browser. It is not stored as an
authoritative fact, and a high result never overrides a compliance block.

## Launch buy box

The editable launch configuration is restricted to:

- Bristol County, Massachusetts;
- Providence County, Rhode Island;
- single-family homes, duplexes, triplexes, and four-unit residential;
- asking-price range $75,000–$500,000;
- `Light` and `Moderate` recorded rehab levels;
- minimum source confidence `Medium`; and
- maximum source-verification age 90 days.

The initial financial thresholds are:

- maximum estimated value: $750,000;
- minimum/preferred equity: 30% / 40%;
- minimum/preferred assignment spread: $15,000 / $25,000;
- minimum/preferred buyer profit: $25,000 / $35,000; and
- minimum wholesale gross margin: 8%.

These values are configurable policy inputs. They are not an appraisal, offer,
promise of buyer demand, or legal approval.

Material changes create a new version. An equivalent normalized save does not
invent a new version.

## Internal assessed-only calculation

The retained calculation has six weighted components:

| Component | Weight |
| --- | ---: |
| Property fit | 25 |
| Financial feasibility | 25 |
| Marketability | 15 |
| Verified buyer demand | 15 |
| Data quality | 10 |
| Seller-provided fit | 10 |

Missing, stale, low-confidence, unsupported, or non-voluntary evidence is
`Unassessed`, not zero. The displayed preliminary score is normalized over
assessed positive weights:

```text
sum(assessed component score × component weight)
÷ sum(assessed component weights)
```

If a positive-weight component is unassessed, the result is labeled
`Preliminary score`. If no positive-weight component is assessed, it is
`Unavailable`. Seller-provided fit stays unassessed until the seller
voluntarily provides permissible current information. Buyer-demand points are
not awarded without real, current verified-buyer evidence.

## Five launch presentation categories

The Pipeline presents the retained evidence through:

1. Geography fit
2. Property-type fit
3. Price and equity fit
4. Financial potential
5. Data confidence

Each category displays `Assessed`, `Partially assessed`, or `Unassessed`,
supporting facts, and missing targets. The launch categories do not invent
separate numeric scores.

The overall launch status is one of:

- `Qualified`
- `Possible`
- `Research required`
- `Disqualified`
- `Compliance or specialist review`

The property panel also shows exact positive reasons, negative reasons,
missing information, restrictions, disqualifiers, freshness, confidence,
contact state, and the next research task.

## Separate compliance gate

Compliance is not a score adjustment. The internal state can be:

- `Clear for research`
- `Clear for manual review`
- `Outreach review required`
- `Outreach blocked`
- `Offer blocked`
- `Marketing blocked`
- `Transaction specialist review`
- `Do not contact`
- `Legal hold`

In this local-first milestone, the launch view keeps contact blocked regardless
of qualification. No score authorizes contact, a formal offer, a contract,
public marketing, sensitive sharing, final buyer selection, money, or closing
instructions.

## Research priority

Research priority is separate from opportunity qualification. The current
engine combines:

- opportunity fit;
- information impact;
- time sensitivity; and
- confidence gap.

The four disclosed factors are combined geometrically and normalized to
0–100. When a factor lacks numeric evidence, the engine uses a deterministic
conservative task-class default and labels its source. It does not estimate
transaction value.

Labels are:

- 90–100: `Critical`
- 75–89: `High`
- 50–74: `Medium`
- 25–49: `Low`
- 0–24: `Deferred`

Identity, ownership, do-not-contact, and similar safety tasks receive critical
handling. Generated comparable, repair, listing, buyer-proof, title/lien, and
material-conflict research receives high task-class treatment. Exact task
reasons remain visible.

## Not implemented: underwriting case engine

Milestone 1 does not implement the requested evidence-ranged underwriting
case, manual comparable approval, repair-range approval, sensitivity table,
confidence gate, opening range, walk-away range, or formal-offer preparation.

The existing Deal Lab is a separate operator-entered educational calculator:

```text
MAO = ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee
```

Its secondary percentage result is a labeled heuristic. It is not a completed
underwriting engine, appraisal, comparable-selection system, or authority to
prepare or send an offer.

The next manual-assisted milestone must add sourced ranges for current value,
ARV, repairs, costs, buyer profit, fee, maximum purchase price, opening and
walk-away ranges, confidence, and missing facts. Offer preparation must remain
blocked below the approved confidence threshold or without a documented
authorized override.
