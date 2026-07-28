# Tradewind DealFlow Operator Manual

Release: local-first Phase 1  
Baseline date: July 27, 2026

## 1. Know the boundary

Tradewind DealFlow is an educational and operating workspace. In this release:

- every property, seller-contact status, buyer, price, source, and note comes
  from the operator;
- records remain in the current browser’s local storage;
- no outreach, submission, contract, payment, or provider action is sent;
- checkmarks record an operator assertion; they are not third-party
  verification;
- a score, calculator result, or checklist is not legal advice, an appraisal,
  an offer, or a closing commitment.

Use the app only with real information that was directly submitted, lawfully
researched, or obtained under an authorized data license. Do not enter protected
characteristics or use them to select owners or neighborhoods.

## 2. First session

1. Open **Dashboard**.
2. Select Massachusetts or Rhode Island.
3. Record whether the working path is bona fide principal activity or a
   licensed and supervised path.
4. Read the state warning shown for that selection.
5. Open **Compliance** and review the dated sources.
6. Export a JSON backup after the first useful configuration is saved.

The state and role controls are decision aids. A Massachusetts or Rhode Island
real-estate attorney must confirm the actual activity and documents.

## 3. Add a property

In **Pipeline**, choose **Add property** and enter only a real, lawfully sourced
record. Required provenance in this release is the source description entered
by the operator. Record enough detail to re-check the source and its currency.

Pipeline stages are:

`Research → Qualified → Contact Approved → Conversation → Offer → Contract →
Disposition → Closing → Closed`

`Archived` is available for records that should leave the active workflow.
“Contact Approved” is a tracking stage; it does not activate or legally approve
contact.

Before changing a record to a contact or disposition stage, review the
Compliance workspace and applicable counsel guidance. This release cannot send
the contact.

## 4. Analyze a deal

In **Deal Lab**:

1. Link an existing property or type a real property label.
2. Select the state.
3. Enter ARV, repairs, holding/closing costs, buyer profit, and fee from
   evidence you can explain.
4. Record comparable-selection evidence and repair evidence.
5. Record uncertainties and risks.
6. Compare the primary MAO result with the percentage-rule heuristic.
7. Save the analysis locally or export a text summary.

The primary calculation is:

`MAO = ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee`

The secondary percentage result is visibly labeled as a heuristic. Neither
result is an appraisal or authority to issue an offer. Do not save an analysis
until the evidence gate is complete.

## 5. Add and match a buyer

In **Buyers**, enter a buyer only from a real submission, authorized CRM record,
or verified relationship. Record:

- state and exact markets;
- property types and price range;
- repair tolerance and strategies;
- proof-of-funds status and expiration;
- last verification date.

Do not upload or paste statements, identity documents, or account numbers. The
matching view compares a selected property with each recorded buy box and shows
both reasons and conflicts. A match is not buyer interest, an offer, funding, or
closing certainty.

## 6. Use the Academy

Each of the twelve modules has a lesson summary, action, worksheet/tool,
knowledge check, and measurable completion condition. Mark a module complete
only after all five parts are satisfied. The 13-week tracker records execution,
not an outcome guarantee.

## 7. Use the Compliance workspace

Always keep Massachusetts and Rhode Island work separate.

- **Massachusetts:** record principal or licensed participation, do not
  negotiate for another for compensation without a confirmed licensed path,
  and obtain state-counsel review before document execution or disposition.
- **Rhode Island:** treat the January 1, 2027 transition as a permanent warning,
  default recurring activity to licensed-path review, use heightened disclosure
  controls, and track seller and assignee cancellation windows separately.

The Rhode Island tracker excludes weekends. It excludes holidays only when the
operator records a verified calendar. Without that evidence it keeps readiness
blocked until attorney confirmation.

The outreach checklist is planning-only. Checking every item does not turn on
email, calls, texts, or direct mail.

## 8. Prepare a Deal Desk packet

The Deal Desk prepares a local text file; it does not submit it.

1. Select a real property record.
2. Identify the submitter and the structure requiring review.
3. Summarize verified facts, seller priorities, assumptions, and open
   questions.
4. Complete every qualification check.
5. Record consent to review.
6. Export the packet.
7. Share it manually only through an approved secure process.

Export does not create agency, representation, acceptance, financing,
compensation, or a promise to acquire, fund, assign, partner on, or close a
transaction.

## 9. Daily operating rhythm

Phase 1 is a human-run loop:

1. Review state and compliance warnings.
2. Add or update only authorized records.
3. Verify source currency and ownership outside the app.
4. Update next actions and pipeline stages.
5. Analyze qualified opportunities.
6. Review missing evidence and legal gates.
7. Re-verify buyer criteria before relying on a match.
8. Prepare review packets where appropriate.
9. Export an end-of-day JSON backup after material changes.

Automated ingestion, outreach, reply handling, and job scheduling belong to
Phase 2 and remain disabled.

## 10. Backup, restore, and deletion

### Backup

Use **Pipeline → Export JSON**. Give the file a date, store it in an encrypted
location, and follow the organization’s retention policy. CSV is a
pipeline-only convenience export and is not a full backup.

### Restore

Use **Pipeline → Import JSON**. The app rejects malformed or incompatible files
before showing the replacement confirmation. Importing a valid file replaces
the entire current browser workspace. Export the current data first.

### Delete

Individual property and buyer deletion requires confirmation. **Clear all local
workspace data** removes the complete local workspace after confirmation.
Deletion is limited to this browser; it cannot delete copies the operator
previously exported.

## 11. Escalate immediately

Stop the workflow and obtain specialist review when a seller appears confused,
incapacitated, under severe pressure, represented by counsel, in bankruptcy,
foreclosure, or probate complexity, disputes identity or ownership, or asks for
legal advice. Also stop on a complaint, opt-out, ownership change, uncertain
contact identity, or contradictory source data.

The application cannot sign contracts, bind a party, move funds, provide
closing instructions, or make legal representations.

