"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import { StatusPill, WorkspaceHeader } from "@/components/WorkspaceShell";
import {
  approveSourcePolicy,
  getSourcePolicy,
  getSourceRecords,
  getSourceRuns,
} from "@/lib/ingestion/client";
import type { IngestionRun, StagedSourceRecord } from "@/lib/ingestion/contracts";
import { applyStoredPolicyToDraft, MASSGIS_ENDPOINT, MASSGIS_FIELDS, syncInitialPolicyFromHydration, validatePolicy, type SourcePolicy } from "@/lib/ingestion/policy";
import type { ApprovedPolicy } from "@/server/ingestion-store";

function initialPolicy(maximumAssessedValue: number): SourcePolicy {
  return {
    adapter: "massgis-parcels-v1",
    endpoint: MASSGIS_ENDPOINT,
    townIds: [95, 201],
    outFields: [...MASSGIS_FIELDS],
    useCodes: ["101", "104", "105", "111"],
    unitCounts: [1, 2, 3, 4],
    maximumAssessedValue: maximumAssessedValue > 0 ? maximumAssessedValue : 750_000,
    maximumYearBuilt: 1990,
    minimumLastSaleAgeYears: null,
    pageSize: 500,
    maxRecordsPerRun: 5_000,
    scheduleEnabled: true,
    scheduleTimeZone: "America/New_York",
    scheduleHour: 2,
    scheduleMinute: 0,
  };
}

function displayValue(value: unknown): string {
  if (value === null) return "none";
  if (Array.isArray(value)) return value.join(", ") || "none";
  return String(value);
}

function policyApprovalDiff(active: ApprovedPolicy | null, draft: SourcePolicy): string {
  if (!active) return "First approval: authorize the displayed bounded scope.";
  const before = active.policy;
  const changes: Array<[string, unknown, unknown]> = [
    ["Town IDs", before.townIds, draft.townIds],
    ["Use codes", before.useCodes, draft.useCodes],
    ["Units", before.unitCounts, draft.unitCounts],
    ["Assessed cap", before.maximumAssessedValue, draft.maximumAssessedValue],
    ["Year-built cap", before.maximumYearBuilt, draft.maximumYearBuilt],
    ["Last-sale age", before.minimumLastSaleAgeYears, draft.minimumLastSaleAgeYears],
    ["Run cap", before.maxRecordsPerRun, draft.maxRecordsPerRun],
    [
      "Schedule",
      `${before.scheduleEnabled ? "on" : "off"} ${before.scheduleHour}:${before.scheduleMinute}`,
      `${draft.scheduleEnabled ? "on" : "off"} ${draft.scheduleHour}:${draft.scheduleMinute}`,
    ],
  ];
  const changed = changes.filter(([, left, right]) => JSON.stringify(left) !== JSON.stringify(right));
  return changed.length === 0
    ? `No changes from approved version ${active.version}.`
    : changed.map(([label, left, right]) => `${label}: ${displayValue(left)} → ${displayValue(right)}`).join(" · ");
}

export function SourcesWorkspace() {
  const { data, hydrated } = useLocalData();
  const [policy, setPolicy] = useState<SourcePolicy>(() =>
    initialPolicy(data.buyBox.financialThresholds.maximumEstimatedValue),
  );
  const [activePolicy, setActivePolicy] = useState<ApprovedPolicy | null>(null);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [records, setRecords] = useState<StagedSourceRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"approve" | null>(null);
  const policyHydrationState = useRef({ synced: false, edited: false, storedPolicyLoaded: false });

  const refresh = useCallback(async () => {
    const [storedPolicy, storedRuns, storedRecords] = await Promise.all([
      getSourcePolicy(), getSourceRuns(5), getSourceRecords(),
    ]);
    setActivePolicy(storedPolicy);
    if (storedPolicy) {
      policyHydrationState.current.storedPolicyLoaded = true;
      policyHydrationState.current.synced = true;
      setPolicy((current) => applyStoredPolicyToDraft(
        current,
        storedPolicy.policy,
        policyHydrationState.current.edited,
      ));
    }
    setRuns(storedRuns);
    setRecords(storedRecords);
  }, []);

  useEffect(() => {
    const result = syncInitialPolicyFromHydration(
      policy,
      data.buyBox.financialThresholds.maximumEstimatedValue,
      { hydrated, ...policyHydrationState.current },
    );
    policyHydrationState.current.synced = result.synced;
    if (result.policy !== policy) setPolicy(result.policy);
  }, [data.buyBox.financialThresholds.maximumEstimatedValue, hydrated, policy]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Source control plane is unavailable.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const groupedExceptions = useMemo(() => {
    const counts = new Map<string, number>();
    records.filter((record) => record.classification === "exception").forEach((record) => {
      const reason = record.reasonCode ?? "unknown";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    });
    return [...counts.entries()];
  }, [records]);
  const latest = runs[0] ?? null;
  const approvalDiff = useMemo(() => policyApprovalDiff(activePolicy, policy), [activePolicy, policy]);

  async function approve() {
    const validated = validatePolicy(policy);
    if (!validated.ok) {
      setMessage(`Policy not approved: ${validated.error}.`);
      return;
    }
    setBusy("approve");
    setMessage("");
    try {
      const approved = await approveSourcePolicy(validated.value);
      policyHydrationState.current.edited = false;
      setActivePolicy(approved);
      setMessage(`Policy version ${approved.version} approved. Future runs use this exact policy hash.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Policy approval failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <WorkspaceHeader
        eyebrow="Standing approval · query-only"
        title="Sources"
        description="Approve one bounded MassGIS parcel policy once. The worker retrieves and stages records automatically on the approved schedule."
      />
      <aside className="snapshot-boundary">
        <strong>Official source: MassGIS Property Tax Parcels · item 73d4c766167848b795f1048cad3919c7 · layer 0.</strong>
        <p>MassGIS supplies parcel facts only. RentCast owner names and mailing addresses are retrieved separately on the server only after provider activation; phone, email, outreach, offers, contracts, and AI decisions remain disabled.</p>
      </aside>
      {message && <p className="persistent-message" role="status" aria-live="polite">{message}</p>}

      <section className="panel" aria-labelledby="source-policy-title">
        <div className="panel-heading">
          <div><span className="mini-label">Versioned source scope</span><h2 id="source-policy-title">MassGIS standing policy</h2></div>
          <StatusPill tone={activePolicy ? "good" : "blocked"}>
            {activePolicy ? `Approved · v${activePolicy.version}` : "Approval required"}
          </StatusPill>
        </div>
        <div className="form-grid three">
          <div><span className="mini-label">Town IDs</span><output>{policy.townIds.join(", ")}</output></div>
          <div><span className="mini-label">Use codes</span><output>{policy.useCodes.join(", ")}</output></div>
          <div><span className="mini-label">Unit counts</span><output>{policy.unitCounts.join(", ")}</output></div>
          <div><span className="mini-label">Maximum assessed value</span><output>{displayValue(policy.maximumAssessedValue)}</output></div>
          <div><span className="mini-label">Maximum year built</span><output>{displayValue(policy.maximumYearBuilt)}</output></div>
          <div><span className="mini-label">Minimum last-sale age</span><output>{displayValue(policy.minimumLastSaleAgeYears)} years</output></div>
          <div><span className="mini-label">Records per run</span><output>{policy.maxRecordsPerRun}</output></div>
          <div><span className="mini-label">Schedule</span><output>{String(policy.scheduleHour).padStart(2, "0")}:{String(policy.scheduleMinute).padStart(2, "0")} {policy.scheduleTimeZone}</output></div>
          <div><span className="mini-label">Automation</span><output>{policy.scheduleEnabled ? "Enabled" : "Disabled"}</output></div>
        </div>
        <p className="panel-intro">
          Initial scope uses Fall River (95), New Bedford (201), 1–4 family use codes, the active buy-box value ceiling when configured, and a daily 02:00 America/New_York schedule.
        </p>
        <p className="panel-intro"><strong>Approval diff:</strong> {approvalDiff}</p>
        <p className="panel-intro">
          <strong>Schedule status:</strong>{" "}
          {activePolicy?.policy.scheduleEnabled
            ? activePolicy.nextRunAt
              ? `Next run ${new Date(activePolicy.nextRunAt).toLocaleString()}.`
              : `Daily at ${String(activePolicy.policy.scheduleHour).padStart(2, "0")}:${String(activePolicy.policy.scheduleMinute).padStart(2, "0")} ${activePolicy.policy.scheduleTimeZone}; next timestamp pending scheduler response.`
            : activePolicy ? "Disabled." : "Pending approval."}
        </p>
        <div className="button-row">
          <button className="button button-primary" type="button" disabled={busy !== null} onClick={() => void approve()}>
            {busy === "approve" ? "Approving…" : "Approve policy"}
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Latest source run counts">
        {[
          ["Retrieved", latest?.retrievedCount], ["Safe", latest?.safeCount],
          ["Duplicates", latest?.duplicateCount], ["Changed", latest?.changedCount],
          ["Exceptions", latest?.exceptionCount],
        ].map(([label, count]) => (
          <article key={String(label)}>
            <span className="metric-icon sea" aria-hidden="true">◇</span>
            <span>{label}</span><strong>{typeof count === "number" ? count : "—"}</strong>
            <small>{latest ? `Run status: ${latest.status}` : "No completed D1 response yet"}</small>
          </article>
        ))}
      </section>

      <section className="sources-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="mini-label">Automatic handoff</span><h2>D1 pipeline</h2></div><StatusPill tone="good">Scheduled</StatusPill></div>
          <p>Safe records are written directly to the authenticated D1 lead surface. Pipeline reads them automatically; there is no browser import step.</p>
          <a className="button button-primary" href="/pipeline">Open automated Pipeline</a>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="mini-label">Grouped, not per-record approval</span><h2>Exceptions</h2></div></div>
          {groupedExceptions.length === 0 ? <p>No exception totals are available.</p> : (
            <ul>{groupedExceptions.map(([reason, count]) => <li key={reason}><strong>{count}</strong> · {reason}</li>)}</ul>
          )}
          <p className="panel-intro">Audit events remain server-side for authorized evidence review.</p>
        </article>
      </section>

      <section className="panel" aria-labelledby="recent-runs-title">
        <div className="panel-heading"><div><span className="mini-label">Durable history</span><h2 id="recent-runs-title">Latest five runs</h2></div></div>
        {runs.length === 0 ? <p>No source runs have been recorded.</p> : (
          <div className="record-table-scroll"><table className="record-table"><thead><tr><th>Requested</th><th>Trigger</th><th>Status</th><th>Retrieved</th><th>Safe</th><th>Duplicates</th><th>Changed</th><th>Exceptions</th></tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id}><td>{new Date(run.requestedAt).toLocaleString()}</td><td>{run.trigger}</td><td>{run.status}</td><td>{run.retrievedCount}</td><td>{run.safeCount}</td><td>{run.duplicateCount}</td><td>{run.changedCount}</td><td>{run.exceptionCount}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
