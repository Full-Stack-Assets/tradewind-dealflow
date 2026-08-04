"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import { LocalDataNotice, StatusPill, WorkspaceHeader } from "@/components/WorkspaceShell";
import {
  acknowledgeAndRefreshImportedRecords,
  approveSourcePolicy,
  getSourcePolicy,
  getSourceRecords,
  getSourceRuns,
  startSourceRun,
} from "@/lib/ingestion/client";
import type { IngestionRun, SourceImportAcknowledgement, SourceImportOutcomeCounts, StagedSourceRecord } from "@/lib/ingestion/contracts";
import { importSafeRecords } from "@/lib/ingestion/import-safe";
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
  const { data, hydrated, updateData, writesSupported } = useLocalData();
  const [policy, setPolicy] = useState<SourcePolicy>(() =>
    initialPolicy(data.buyBox.financialThresholds.maximumEstimatedValue),
  );
  const [activePolicy, setActivePolicy] = useState<ApprovedPolicy | null>(null);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [records, setRecords] = useState<StagedSourceRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"approve" | "run" | "import" | null>(null);
  const policyFormRef = useRef<HTMLFormElement>(null);
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

  const importableRecords = useMemo(
    () => records.filter(
      (record) => (record.classification === "safe" || record.classification === "changed")
        && record.importedAt === null,
    ),
    [records],
  );
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

  function editPolicy(next: SourcePolicy) {
    policyHydrationState.current.edited = true;
    setPolicy(next);
  }

  async function approve() {
    if (!policyFormRef.current?.reportValidity()) return;
    const validated = validatePolicy(policy);
    if (!validated.ok) {
      setMessage(`Policy not approved: ${validated.error}.`);
      policyFormRef.current.querySelector<HTMLInputElement>("input")?.focus();
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

  async function runNow() {
    setBusy("run");
    setMessage("");
    try {
      const run = await startSourceRun();
      setMessage(`Run ${run.status}: ${run.safeCount} safe, ${run.exceptionCount} exceptions.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source run failed.");
    } finally {
      setBusy(null);
    }
  }

  async function importAllSafe() {
    setBusy("import");
    setMessage("");
    let acknowledgements: SourceImportAcknowledgement[] = [];
    let outcomeSummary = "";
    let outcomeCounts: SourceImportOutcomeCounts = {
      applied: 0,
      changedSource: 0,
      exactReimport: 0,
      possiblePropertyMatch: 0,
      excluded: 0,
    };
    const mutation = await updateData((current, mutationTime) => {
      const result = importSafeRecords(current, importableRecords, mutationTime);
      if (result.error) throw new Error(result.error);
      acknowledgements = importableRecords.map((record, index) => ({
        recordId: record.id,
        outcome: result.outcomes[index],
      }));
      const count = (outcome: typeof result.outcomes[number]) =>
        result.outcomes.filter((item) => item === outcome).length;
      outcomeCounts = {
        applied: count("applied"),
        changedSource: count("changed-source"),
        exactReimport: count("exact-reimport"),
        possiblePropertyMatch: count("possible-property-match"),
        excluded: count("excluded"),
      };
      outcomeSummary = `${outcomeCounts.applied} new, ${outcomeCounts.changedSource} changed, ${outcomeCounts.exactReimport} exact reimports, ${outcomeCounts.possiblePropertyMatch} held matches`;
      return result.data;
    });
    if (!mutation.ok) {
      setMessage(mutation.message);
      setBusy(null);
      return;
    }
    try {
      const completion = await acknowledgeAndRefreshImportedRecords(acknowledgements, refresh);
      setMessage(completion.refreshed
        ? `Safe import complete: ${outcomeSummary}.`
        : `Safe import complete: ${outcomeSummary}. Server acknowledgement succeeded, but source status refresh failed; reload to retry status.`);
    } catch {
      setMessage(`Local import complete: ${outcomeSummary}. Server acknowledgement failed; retry is safe.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <WorkspaceHeader
        eyebrow="Standing approval · query-only"
        title="Sources"
        description="Approve one bounded MassGIS parcel policy, run it manually or on schedule, and import every safe staged record in one local batch."
      />
      <LocalDataNotice />
      <aside className="snapshot-boundary">
        <strong>Official source: MassGIS Property Tax Parcels · item 73d4c766167848b795f1048cad3919c7 · layer 0.</strong>
        <p>Geometry, owner names, owner addresses, phone, email, outreach, offers, contracts, and AI decisions are disabled.</p>
      </aside>
      {message && <p className="persistent-message" role="status" aria-live="polite">{message}</p>}

      <section className="panel" aria-labelledby="source-policy-title">
        <div className="panel-heading">
          <div><span className="mini-label">Versioned source scope</span><h2 id="source-policy-title">MassGIS standing policy</h2></div>
          <StatusPill tone={activePolicy ? "good" : "blocked"}>
            {activePolicy ? `Approved · v${activePolicy.version}` : "Approval required"}
          </StatusPill>
        </div>
        <form
          ref={policyFormRef}
          onSubmit={(event) => {
            event.preventDefault();
            void approve();
          }}
        >
        <div className="form-grid three">
          <label>Town IDs
            <input required value={policy.townIds.join(", ")} onChange={(event) => editPolicy({ ...policy, townIds: event.target.value.split(",").map(Number).filter(Number.isInteger) })} />
          </label>
          <label>Use codes
            <input required value={policy.useCodes.join(", ")} onChange={(event) => editPolicy({ ...policy, useCodes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
          </label>
          <label>Unit counts
            <input required value={policy.unitCounts.join(", ")} onChange={(event) => editPolicy({ ...policy, unitCounts: event.target.value.split(",").map(Number).filter(Number.isInteger) })} />
          </label>
          <label>Maximum assessed value
            <input type="number" min="0" value={policy.maximumAssessedValue ?? ""} onChange={(event) => editPolicy({ ...policy, maximumAssessedValue: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>Maximum year built
            <input type="number" min="1600" max="2100" value={policy.maximumYearBuilt ?? ""} onChange={(event) => editPolicy({ ...policy, maximumYearBuilt: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>Minimum last-sale age (years)
            <input type="number" min="0" step="1" value={policy.minimumLastSaleAgeYears ?? ""} onChange={(event) => editPolicy({ ...policy, minimumLastSaleAgeYears: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>Maximum records per run
            <input required type="number" min="100" max="100000" value={policy.maxRecordsPerRun} onChange={(event) => editPolicy({ ...policy, maxRecordsPerRun: Number(event.target.value) })} />
          </label>
          <label>Schedule hour (New York)
            <input type="number" min="0" max="23" value={policy.scheduleHour} onChange={(event) => editPolicy({ ...policy, scheduleHour: Number(event.target.value) })} />
          </label>
          <label>Schedule minute
            <input type="number" min="0" max="59" value={policy.scheduleMinute} onChange={(event) => editPolicy({ ...policy, scheduleMinute: Number(event.target.value) })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={policy.scheduleEnabled} onChange={(event) => editPolicy({ ...policy, scheduleEnabled: event.target.checked })} />
            Daily schedule enabled
          </label>
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
          <button className="button button-primary" type="submit" disabled={busy !== null}>
            {busy === "approve" ? "Approving…" : "Approve policy"}
          </button>
          <button className="button button-quiet" type="button" disabled={!activePolicy || busy !== null} onClick={() => void runNow()}>
            {busy === "run" ? "Running…" : "Run now"}
          </button>
        </div>
        </form>
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
          <div className="panel-heading">
            <div><span className="mini-label">One Web-Locked batch</span><h2>Safe intake</h2></div>
            <StatusPill tone={importableRecords.length > 0 ? "good" : "neutral"}>{importableRecords.length} pending</StatusPill>
          </div>
          <p>Server-classified safe and changed-source records enter the local Pipeline batch; new properties always start at Research and changed facts stay conflicts. Exact reruns do not duplicate deals.</p>
          <button className="button button-primary" type="button" disabled={!writesSupported || importableRecords.length === 0 || busy !== null} onClick={() => void importAllSafe()}>
            {busy === "import" ? "Importing…" : "Import all safe records"}
          </button>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="mini-label">Grouped, not per-record approval</span><h2>Exceptions</h2></div></div>
          {groupedExceptions.length === 0 ? <p>No exception totals are available.</p> : (
            <ul>{groupedExceptions.map(([reason, count]) => <li key={reason}><strong>{count}</strong> · {reason}</li>)}</ul>
          )}
          <a className="button button-quiet" href="/api/sources/audit">Download audit</a>
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
