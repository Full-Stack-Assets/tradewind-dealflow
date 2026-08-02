"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSourcePolicy, getSourceRecords, getSourceRuns } from "@/lib/ingestion/client";
import type { IngestionRun } from "@/lib/ingestion/contracts";
import type { ApprovedPolicy } from "@/server/ingestion-store";

export function SourceHealthStrip({ surface }: { surface: "pipeline" | "dashboard" }) {
  const [latest, setLatest] = useState<IngestionRun | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [exceptions, setExceptions] = useState<number | null>(null);
  const [policy, setPolicy] = useState<ApprovedPolicy | null>(null);

  useEffect(() => {
    let current = true;
    void Promise.all([getSourcePolicy(), getSourceRuns(1), getSourceRecords()])
      .then(([storedPolicy, runs, records]) => {
        if (!current) return;
        setPolicy(storedPolicy);
        setLatest(runs[0] ?? null);
        setPending(records.filter((record) => record.classification === "safe" && record.importedAt === null).length);
        setExceptions(records.filter((record) => record.classification === "exception").length);
      })
      .catch(() => {
        if (!current) return;
        setLatest(null);
        setPending(null);
        setExceptions(null);
        setPolicy(null);
      });
    return () => { current = false; };
  }, []);

  return (
    <aside className="source-health-strip" aria-label="MassGIS source health">
      <div>
        <span className="mini-label">Controlled source staging</span>
        <strong>
          {latest
            ? `Last run ${latest.status} · ${latest.retrievedCount} retrieved`
            : "Source status becomes available after the control plane responds"}
        </strong>
        {surface === "pipeline" ? (
          <small>
            {pending === null
              ? "Safe pending count unavailable. Latest import result unavailable."
              : `${pending} safe pending import · Latest import result: ${latest
                ? `${latest.importedCount} acknowledged`
                : "unavailable"}`}
          </small>
        ) : (
          <small>
            {exceptions === null
              ? "Exception count unavailable. Next scheduled run unavailable."
              : `${exceptions} exceptions · Next scheduled run: ${policy?.nextRunAt
                ? new Date(policy.nextRunAt).toLocaleString()
                : policy?.policy.scheduleEnabled
                  ? `daily ${String(policy.policy.scheduleHour).padStart(2, "0")}:${String(policy.policy.scheduleMinute).padStart(2, "0")} ${policy.policy.scheduleTimeZone}`
                  : "disabled"}`}
          </small>
        )}
      </div>
      <Link className="button button-quiet button-small" href="/sources">
        {surface === "pipeline" ? "Import staged records" : "Open Sources"}
      </Link>
    </aside>
  );
}
