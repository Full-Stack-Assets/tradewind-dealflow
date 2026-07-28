"use client";

import { useMemo, useState } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import {
  LAST_REVIEWED,
  marketingChecklist,
  officialSources,
  outreachChecklist,
  stateDecisionChecks,
} from "@/lib/content";
import {
  evaluateCancellationWindow,
  evaluateMarketingReadiness,
} from "@/lib/compliance";
import type { CancellationWindowRecord } from "@/lib/types";

export function ComplianceWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const [selectedDealId, setSelectedDealId] = useState("");
  const selectedDeal = data.deals.find((deal) => deal.id === selectedDealId);
  const today = new Date().toISOString().slice(0, 10);

  const sellerWindow = useMemo(
    () =>
      evaluateCancellationWindow({
        ...data.compliance.sellerWindow,
        today,
      }),
    [data.compliance.sellerWindow, today],
  );
  const assigneeWindow = useMemo(
    () =>
      evaluateCancellationWindow({
        ...data.compliance.assigneeWindow,
        today,
      }),
    [data.compliance.assigneeWindow, today],
  );
  const marketingReadiness = evaluateMarketingReadiness({
    state: selectedDeal?.state ?? data.preferences.selectedState,
    participationPath: data.preferences.participationPath,
    executedAgreement: selectedDeal?.executedAgreement ?? false,
    equitableInterestRecorded: selectedDeal?.equitableInterestRecorded ?? false,
    legalTitleDisclosureReady: selectedDeal?.legalTitleDisclosureReady ?? false,
    attorneyReviewComplete: selectedDeal?.attorneyReviewComplete ?? false,
    sellerWindowReady: sellerWindow.ready,
    assigneeWindowReady: assigneeWindow.ready,
  });
  const outreachComplete = outreachChecklist.filter(
    (item) => data.compliance.outreachChecks[item],
  ).length;

  const updateWindow = (
    key: "sellerWindow" | "assigneeWindow",
    patch: Partial<CancellationWindowRecord>,
  ) => {
    void updateData((current) => ({
      ...current,
      compliance: {
        ...current.compliance,
        [key]: { ...current.compliance[key], ...patch },
      },
    }));
  };

  const updateDealGate = (
    field:
      | "executedAgreement"
      | "equitableInterestRecorded"
      | "legalTitleDisclosureReady"
      | "attorneyReviewComplete",
    checked: boolean,
  ) => {
    if (!selectedDeal) return;
    void updateData((current) => ({
      ...current,
      deals: current.deals.map((deal) =>
        deal.id === selectedDeal.id
          ? { ...deal, [field]: checked, updatedAt: new Date().toISOString() }
          : deal,
      ),
    }));
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow={`Legal baseline · Last reviewed ${LAST_REVIEWED}`}
        title="Compliance workspace"
        description="State-separated educational controls for decisions that require licensed counsel and closing professionals."
        action={<StatusPill tone="blocked">Outreach disabled</StatusPill>}
      />
      <LocalDataNotice />

      <aside className="legal-disclaimer">
        <span aria-hidden="true">§</span>
        <p>
          Tradewind DealFlow is educational and operational software, not legal
          advice. The matrix summarizes a dated public-source baseline and
          intentionally labels uncertain interpretations for attorney review.
        </p>
      </aside>

      <section className="ri-transition" aria-labelledby="ri-transition-title">
        <div className="transition-date">
          <span>Effective</span>
          <strong>01.01</strong>
          <small>2027</small>
        </div>
        <div>
          <span className="mini-label light">Permanent Rhode Island transition alert</span>
          <h2 id="ri-transition-title">Public Law 2026, chapter 410 changes the lane.</h2>
          <p>
            Enacted June 23, 2026, the law expands the broker definition for
            recurring equitable-interest wholesaling, adds written disclosures
            and separate nonwaivable three-business-day cancellation periods,
            protects the assignee’s closing-provider choice, and adds enforcement
            provisions. The app uses heightened controls now.
          </p>
          <a href="https://webserver.rilegislature.gov/PublicLaws/law26/law26410.htm" target="_blank" rel="noreferrer">
            Read chapter 410 at the Rhode Island General Assembly ↗
          </a>
        </div>
      </section>

      <section className="state-lanes" aria-label="State compliance lanes">
        <article className="state-lane">
          <div className="state-lane-head">
            <span className="state-code">MA</span>
            <div>
              <span className="mini-label">Massachusetts lane</span>
              <h2>Principal versus broker</h2>
            </div>
          </div>
          <p>
            Sections 87PP, 87QQ, and 87RR frame the broker definition, qualifying
            exemptions, and prohibition on unlicensed brokerage. Whether a
            particular activity fits an exemption requires Massachusetts counsel.
          </p>
          <ul className="guardrail-list">
            {stateDecisionChecks.MA.map((check) => <li key={check}>{check}</li>)}
          </ul>
          <div className="source-row">
            <a href="https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87PP" target="_blank" rel="noreferrer">§ 87PP</a>
            <a href="https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87QQ" target="_blank" rel="noreferrer">§ 87QQ</a>
            <a href="https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87RR" target="_blank" rel="noreferrer">§ 87RR</a>
          </div>
        </article>

        <article className="state-lane ri-lane">
          <div className="state-lane-head">
            <span className="state-code ri">RI</span>
            <div>
              <span className="mini-label">Rhode Island lane</span>
              <h2>Licensed-path transition</h2>
            </div>
          </div>
          <p>
            The conservative workflow does not encourage reliance on a possible
            first-transaction exception. Recurring wholesaling defaults to
            licensed-path review, with counsel review before any executable
            contract is distributed.
          </p>
          <ul className="guardrail-list">
            {stateDecisionChecks.RI.map((check) => <li key={check}>{check}</li>)}
          </ul>
          <a className="source-button" href="https://webserver.rilegislature.gov/PublicLaws/law26/law26410.htm" target="_blank" rel="noreferrer">
            Public Law 2026, chapter 410 ↗
          </a>
        </article>
      </section>

      <section className="panel cancellation-panel" aria-labelledby="cancellation-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">Rhode Island control</span>
            <h2 id="cancellation-title">Three-business-day cancellation tracker</h2>
          </div>
          <StatusPill tone={sellerWindow.ready && assigneeWindow.ready ? "good" : "blocked"}>
            {sellerWindow.ready && assigneeWindow.ready ? "Both confirmed" : "Assignment blocked"}
          </StatusPill>
        </div>
        <p className="panel-intro">
          Seller and assignee windows are tracked separately. Weekends are
          excluded. Holidays are excluded only when a verified calendar is
          recorded; otherwise the system requires attorney confirmation and
          keeps readiness blocked.
        </p>
        <div className="window-grid">
          <CancellationTracker
            title="Seller window"
            record={data.compliance.sellerWindow}
            result={sellerWindow}
            disabled={!writesSupported}
            onChange={(patch) => updateWindow("sellerWindow", patch)}
          />
          <CancellationTracker
            title="Assignee window"
            record={data.compliance.assigneeWindow}
            result={assigneeWindow}
            disabled={!writesSupported}
            onChange={(patch) => updateWindow("assigneeWindow", patch)}
          />
        </div>
      </section>

      <section className="panel marketing-gate" aria-labelledby="marketing-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">Equitable-interest gate</span>
            <h2 id="marketing-title">Marketing-interest readiness</h2>
          </div>
          <StatusPill tone={marketingReadiness.ready ? "good" : "blocked"}>
            {marketingReadiness.ready ? "Recorded ready" : "Not ready"}
          </StatusPill>
        </div>
        <label className="match-selector">
          <span>Property record</span>
          <select value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)}>
            <option value="">Select a property before review</option>
            {data.deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.address}, {deal.city} · {deal.state}</option>)}
          </select>
        </label>
        <div className="gate-grid">
          {[
            ["executedAgreement", "Executed agreement recorded"],
            ["equitableInterestRecorded", "Contractual interest basis recorded"],
            ["legalTitleDisclosureReady", "Disclosure states legal title is not held"],
            ["attorneyReviewComplete", "Applicable state counsel review recorded"],
          ].map(([field, label]) => (
            <label className="check-row" key={field}>
              <input
                type="checkbox"
                disabled={!selectedDeal || !writesSupported}
                checked={Boolean(selectedDeal?.[field as keyof typeof selectedDeal])}
                onChange={(event) => updateDealGate(field as Parameters<typeof updateDealGate>[0], event.target.checked)}
              />
              <span><strong>{label}</strong><small>Operator-recorded evidence; not system verification</small></span>
            </label>
          ))}
        </div>
        {!marketingReadiness.ready && (
          <div className="missing-list">
            <strong>Current blockers</strong>
            <ul>{marketingReadiness.missing.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
      </section>

      <div className="compliance-columns">
        <section className="panel" aria-labelledby="outreach-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Planning only</span>
              <h2 id="outreach-title">Outreach readiness</h2>
            </div>
            <StatusPill tone="blocked">Sending off</StatusPill>
          </div>
          <p>
            These operator checkmarks do not activate any channel. Automated cold
            texts, prerecorded or AI voice calls, and mass dialing remain disabled.
          </p>
          <div className="check-list compact">
            {outreachChecklist.map((item) => (
              <label className="check-row" key={item}>
                <input
                  type="checkbox"
                  disabled={!writesSupported}
                  checked={Boolean(data.compliance.outreachChecks[item])}
                  onChange={(event) =>
                    void updateData((current) => ({
                      ...current,
                      compliance: {
                        ...current.compliance,
                        outreachChecks: {
                          ...current.compliance.outreachChecks,
                          [item]: event.target.checked,
                        },
                      },
                    }))
                  }
                />
                <span><strong>{item}</strong></span>
              </label>
            ))}
          </div>
          <p className="check-count">{outreachComplete}/{outreachChecklist.length} planning controls recorded</p>
        </section>

        <section className="panel" aria-labelledby="interest-checklist-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Operator reference</span>
              <h2 id="interest-checklist-title">Interest-marketing checklist</h2>
            </div>
          </div>
          <ul className="numbered-control-list">
            {marketingChecklist.map((item, index) => (
              <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="source-register panel" aria-labelledby="source-register-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">Dated source register</span>
            <h2 id="source-register-title">Official baseline links</h2>
          </div>
          <span className="review-date">Last reviewed: {LAST_REVIEWED}</span>
        </div>
        <div className="source-list">
          {officialSources.map((source) => (
            <a href={source.href} target="_blank" rel="noreferrer" key={source.href}>
              <span>{source.group}</span>
              <strong>{source.title}</strong>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

function CancellationTracker({
  title,
  record,
  result,
  disabled,
  onChange,
}: {
  title: string;
  record: CancellationWindowRecord;
  result: ReturnType<typeof evaluateCancellationWindow>;
  disabled: boolean;
  onChange: (patch: Partial<CancellationWindowRecord>) => void;
}) {
  return (
    <fieldset className="window-card" disabled={disabled}>
      <legend>{title}</legend>
      <label>
        <span>Recorded contract date</span>
        <input type="date" value={record.startDate} onChange={(event) => onChange({ startDate: event.target.value, attorneyConfirmed: false })} />
      </label>
      <label>
        <span>Verified holiday dates <small>comma separated YYYY-MM-DD</small></span>
        <input
          value={record.verifiedHolidays.join(", ")}
          onChange={(event) => onChange({ verifiedHolidays: event.target.value.split(",").map((value) => value.trim()).filter(Boolean), attorneyConfirmed: false })}
          placeholder="Leave empty unless verified"
        />
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={record.holidayCalendarVerified} onChange={(event) => onChange({ holidayCalendarVerified: event.target.checked, attorneyConfirmed: false })} />
        <span>I verified the applicable holiday calendar</span>
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={record.attorneyConfirmed} onChange={(event) => onChange({ attorneyConfirmed: event.target.checked })} />
        <span>State counsel confirmed this window</span>
      </label>
      <div className={result.ready ? "window-result ready" : "window-result blocked"}>
        <div>
          <span>Tentative end</span>
          <strong>{result.endDate ?? "Not available"}</strong>
        </div>
        <p>{result.reason}</p>
      </div>
    </fieldset>
  );
}
