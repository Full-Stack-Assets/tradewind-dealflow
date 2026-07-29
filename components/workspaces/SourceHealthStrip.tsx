"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSourceRecords, getSourceRuns } from "@/lib/ingestion/client";
import type { IngestionRun } from "@/lib/ingestion/contracts";

export function SourceHealthStrip({ surface }: { surface: "pipeline" | "dashboard" }) {
  const [latest, setLatest] = useState<IngestionRun | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [exceptions, setExceptions] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    void Promise.all([getSourceRuns(1), getSourceRecords()])
      .then(([runs, records]) => {
        if (!current) return;
        setLatest(runs[0] ?? null);
        setPending(records.filter((record) => record.classification === "safe" && record.importedAt === null).length);
        setExceptions(records.filter((record) => record.classification === "exception").length);
      })
      .catch(() => {
        if (!current) return;
        setLatest(null);
        setPending(null);
        setExceptions(null);
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
        <small>
          {pending === null || exceptions === null
            ? "No lead or exception count is inferred."
            : `${pending} safe pending import · ${exceptions} exceptions`}
        </small>
      </div>
      <Link className="button button-quiet button-small" href="/sources">
        {surface === "pipeline" ? "Import staged records" : "Open Sources"}
      </Link>
    </aside>
  );
}
