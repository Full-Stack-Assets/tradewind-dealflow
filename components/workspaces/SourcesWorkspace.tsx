"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import { LocalDataNotice, StatusPill, WorkspaceHeader } from "@/components/WorkspaceShell";
import {
  acknowledgeImportedRecords,
  approveSourcePolicy,
  getSourcePolicy,
  getSourceRecords,
  getSourceRuns,
  startSourceRun,
} from "@/lib/ingestion/client";
import type { IngestionRun, StagedSourceRecord } from "@/lib/ingestion/contracts";
import { importSafeRecords } from "@/lib/ingestion/import-safe";
import { MASSGIS_ENDPOINT, MASSGIS_FIELDS, type SourcePolicy } from "@/lib/ingestion/policy";
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

export function SourcesWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const [policy, setPolicy] = useState<SourcePolicy>(() =>
    initialPolicy(data.buyBox.financialThresholds.maximumEstimatedValue),
  );
  const [activePolicy, setActivePolicy] = useState<ApprovedPolicy | null>(null);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [records, setRecords] = useState<StagedSourceRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"approve" | "run" | "import" | null>(null);

  const refresh = useCallback(async () => {
    const [storedPolicy, storedRuns, storedRecords] = await Promise.all([
      getSourcePolicy(), getSourceRuns(5), getSourceRecords(),
    ]);
    setActivePolicy(storedPolicy);
    if (storedPolicy) setPolicy(storedPolicy.policy);
    setRuns(storedRuns);
    setRecords(storedRecords);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Source control plane is unavailable.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const safeRecords = useMemo(
    () => records.filter((record) => record.classification === "safe" && record.importedAt === null),
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

  async function approve() {
    setBusy("approve");
    setMessage("");
    try {
      const approved = await approveSourcePolicy(policy);
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
    let importedIds: string[] = [];
    let outcomeSummary = "";
    const mutation = await updateData((current, mutationTime) => {
      const result = importSafeRecords(current, safeRecords, mutationTime);
      if (result.error) throw new Error(result.error);
      importedIds = result.importedRecordIds;
      const count = (outcome: typeof result.outcomes[number]) =>
        result.outcomes.filter((item) => item === outcome).length;
      outcomeSummary = `${count("applied")} new, ${count("changed-source")} changed, ${count("exact-reimport")} exact reimports, ${count("possible-property-match")} held matches`;
      return result.data;
    });
    if (!mutation.ok) {
      setMessage(mutation.message);
      setBusy(null);
      return;
    }
    try {
      await acknowledgeImportedRecords(importedIds);
      setMessage(`Safe import complete: ${outcomeSummary}.`);
      await refresh();
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
        <div className="form-grid three">
          <label>Town IDs
            <input value={policy.townIds.join(", ")} onChange={(event) => setPolicy({ ...policy, townIds: event.target.value.split(",").map(Number).filter(Number.isInteger) })} />
          </label>
          <label>Use codes
            <input value={policy.useCodes.join(", ")} onChange={(event) => setPolicy({ ...policy, useCodes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
          </label>
          <label>Unit counts
            <input value={policy.unitCounts.join(", ")} onChange={(event) => setPolicy({ ...policy, unitCounts: event.target.value.split(",").map(Number).filter(Number.isInteger) })} />
          </label>
          <label>Maximum assessed value
            <input type="number" min="0" value={policy.maximumAssessedValue ?? ""} onChange={(event) => setPolicy({ ...policy, maximumAssessedValue: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>Maximum year built
            <input type="number" min="1600" max="2100" value={policy.maximumYearBuilt ?? ""} onChange={(event) => setPolicy({ ...policy, maximumYearBuilt: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>Maximum records per run
            <input type="number" min="100" max="100000" value={policy.maxRecordsPerRun} onChange={(event) => setPolicy({ ...policy, maxRecordsPerRun: Number(event.target.value) })} />
          </label>
          <label>Schedule hour (New York)
            <input type="number" min="0" max="23" value={policy.scheduleHour} onChange={(event) => setPolicy({ ...policy, scheduleHour: Number(event.target.value) })} />
          </label>
          <label>Schedule minute
            <input type="number" min="0" max="59" value={policy.scheduleMinute} onChange={(event) => setPolicy({ ...policy, scheduleMinute: Number(event.target.value) })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={policy.scheduleEnabled} onChange={(event) => setPolicy({ ...policy, scheduleEnabled: event.target.checked })} />
            Daily schedule enabled
          </label>
        </div>
        <p className="panel-intro">
          Initial scope uses Fall River (95), New Bedford (201), 1–4 family use codes, the active buy-box value ceiling when configured, and a daily 02:00 America/New_York schedule.
        </p>
        <div className="button-row">
          <button className="button button-primary" type="button" disabled={busy !== null} onClick={() => void approve()}>
            {busy === "approve" ? "Approving…" : "Approve policy"}
          </button>
          <button className="button button-quiet" type="button" disabled={!activePolicy || busy !== null} onClick={() => void runNow()}>
            {busy === "run" ? "Running…" : "Run now"}
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
          <div className="panel-heading">
            <div><span className="mini-label">One Web-Locked batch</span><h2>Safe intake</h2></div>
            <StatusPill tone={safeRecords.length > 0 ? "good" : "neutral"}>{safeRecords.length} pending</StatusPill>
          </div>
          <p>Only server-classified safe records enter the local Pipeline, always at Research. Exact reruns do not duplicate deals.</p>
          <button className="button button-primary" type="button" disabled={!writesSupported || safeRecords.length === 0 || busy !== null} onClick={() => void importAllSafe()}>
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
          <div className="record-table-scroll"><table className="record-table"><thead><tr><th>Requested</th><th>Trigger</th><th>Status</th><th>Safe</th><th>Exceptions</th></tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id}><td>{new Date(run.requestedAt).toLocaleString()}</td><td>{run.trigger}</td><td>{run.status}</td><td>{run.safeCount}</td><td>{run.exceptionCount}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
