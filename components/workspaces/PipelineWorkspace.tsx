"use client";

import { useEffect, useState } from "react";

import { EmptyState, StatusPill, WorkspaceHeader } from "@/components/WorkspaceShell";
import { getAutomatedLeads, type AutomatedLeadListItem } from "@/lib/automation/client";

function money(value: number | null): string {
  return value === null
    ? "Not supplied"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function ownerLabel(lead: AutomatedLeadListItem): string {
  return lead.ownerNames.length > 0 ? lead.ownerNames.join(", ") : "Owner enrichment pending";
}

export function PipelineWorkspace() {
  const [leads, setLeads] = useState<AutomatedLeadListItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "auth" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    void getAutomatedLeads({ limit: 100 })
      .then((next) => {
        if (!mounted) return;
        setLeads(next);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState(error instanceof Error && /authenticated|owner session/i.test(error.message) ? "auth" : "error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const enriched = leads.filter((lead) => lead.enrichmentStatus === "available").length;
  const pending = leads.length - enriched;

  return (
    <>
      <WorkspaceHeader
        eyebrow="Automated lead intake"
        title="Pipeline"
        description="MassGIS runs on schedule, RentCast owner enrichment is server-side, and this screen is a review surface—not an import or typing task."
      />

      <aside className="snapshot-boundary" aria-label="Automated lead boundary">
        <strong>Five-minute workflow: open Pipeline, review the newest records, then move approved work into Deal work.</strong>
        <p>No CSV upload, manual property retyping, contact harvesting, outbound calling, texting, email, or contract execution happens here.</p>
      </aside>

      <section className="metric-grid" aria-label="Automated lead totals">
        {[
          ["New leads", leads.length, "MassGIS records in D1"],
          ["Owner matched", enriched, "RentCast facts available"],
          ["Needs enrichment", pending, "No owner facts claimed"],
          ["Source", "MassGIS", "Official parcel workflow"],
          ["Mode", "Review", "Human approval remains required"],
        ].map(([label, value, detail]) => (
          <article key={String(label)}>
            <span className="metric-icon sea" aria-hidden="true">◇</span>
            <span>{label}</span><strong>{value}</strong><small>{detail}</small>
          </article>
        ))}
      </section>

      {state === "loading" && <section className="panel" role="status"><p>Loading automated leads from D1…</p></section>}
      {state === "auth" && <section className="panel" role="alert"><EmptyState eyebrow="Owner session required" title="Sign in to view automated leads">The deployment correctly protects D1 reads. Refresh after the private Sites owner session is established.</EmptyState></section>}
      {state === "error" && <section className="panel" role="alert"><EmptyState eyebrow="Automated service unavailable" title="No lead data was invented">The server lead route could not be verified. Check the deployment and D1 migration receipt, then retry.</EmptyState></section>}
      {state === "ready" && leads.length === 0 && <section className="panel"><EmptyState eyebrow="Waiting for the next cycle" title="No automated leads yet">Approve the MassGIS source policy once. The hourly worker will retrieve the bounded parcel set and stage it here automatically.</EmptyState></section>}
      {state === "ready" && leads.length > 0 && (
        <section className="lead-engine-section qualification-list" aria-labelledby="automated-leads-title">
          <div className="section-heading">
            <div><span className="mini-label">D1 system of record</span><h2 id="automated-leads-title">Newest automated leads</h2></div>
            <StatusPill tone="good">{leads.length} records</StatusPill>
          </div>
          {leads.map((lead) => (
            <article className="panel" key={lead.id}>
              <div className="panel-heading">
                <div><span className="mini-label">{lead.provider === "rentcast" ? "MassGIS + RentCast" : "MassGIS only"}</span><h3>{lead.address}</h3></div>
                <StatusPill tone={lead.enrichmentStatus === "available" ? "good" : "warning"}>{lead.enrichmentStatus === "available" ? "Owner matched" : "Enrichment pending"}</StatusPill>
              </div>
              <div className="detail-grid">
                <div><span className="mini-label">Location</span><strong>{lead.city}, {lead.state} {lead.zip}</strong></div>
                <div><span className="mini-label">Estimated value</span><strong>{money(lead.estimatedValue)}</strong></div>
                <div><span className="mini-label">Owner data</span><strong>{ownerLabel(lead)}</strong></div>
                <div><span className="mini-label">Source record</span><strong>{lead.source.recordId}</strong></div>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
