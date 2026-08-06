"use client";

import { useEffect, useState } from "react";
import { WorkspaceHeader, StatusPill } from "../WorkspaceShell";

type Approval = {
  requestId: string;
  actionId: string;
  actionType: string;
  targetEntityId: string;
  envelopeHash: string;
  requirement: { role: string; minimumApprovals: number; separationOfDutiesRequired?: boolean };
  requestedAt: string;
  expiresAt: string | null;
  status: string;
  decisions: Array<{ decision: string; approverRole: string; decidedAt: string }>;
};

export function ApprovalQueueWorkspace() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [message, setMessage] = useState("Loading approval queue…");

  async function refresh() {
    const response = await fetch("/api/control-plane/approvals", { cache: "no-store" });
    if (!response.ok) throw new Error("Approval queue is unavailable until authenticated D1 access is configured.");
    const body = await response.json() as { approvals: Approval[] };
    setApprovals(body.approvals);
    setMessage(body.approvals.length === 0 ? "No approval requests are pending." : "Review each exact envelope before deciding.");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Approval queue unavailable."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(approval: Approval, decision: "APPROVED" | "REJECTED") {
    setMessage("Recording decision…");
    const response = await fetch(`/api/control-plane/approvals/${encodeURIComponent(approval.requestId)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, envelopeHash: approval.envelopeHash, role: approval.requirement.role }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new Error(body.error || "Approval decision failed.");
    await refresh();
  }

  return (
    <>
      <WorkspaceHeader
        eyebrow="Hash-bound human review"
        title="Approval Queue"
        description="Review exact action envelopes, authority scope, expiry, and separation-of-duties requirements before any provider adapter can execute."
      />
      <aside className="snapshot-boundary">
        <strong>Execution remains fail-closed.</strong>
        <p>A decision never changes the envelope. Any material mutation creates a new hash and requires a new approval.</p>
      </aside>
      <p className="persistent-message" role="status" aria-live="polite">{message}</p>
      <section className="sources-grid" aria-label="Approval requests">
        {approvals.map((approval) => (
          <article className="panel" key={approval.requestId}>
            <div className="panel-heading">
              <div><span className="mini-label">{approval.actionType}</span><h2>{approval.targetEntityId}</h2></div>
              <StatusPill tone={approval.status === "APPROVED" ? "good" : approval.status === "REJECTED" ? "blocked" : "warning"}>{approval.status}</StatusPill>
            </div>
            <p><strong>Envelope:</strong> <code>{approval.envelopeHash}</code></p>
            <p><strong>Required:</strong> {approval.requirement.minimumApprovals} × {approval.requirement.role}{approval.requirement.separationOfDutiesRequired ? " · separation of duties" : ""}</p>
            <p><strong>Requested:</strong> {new Date(approval.requestedAt).toLocaleString()} {approval.expiresAt ? `· expires ${new Date(approval.expiresAt).toLocaleString()}` : "· no expiry recorded"}</p>
            {approval.status === "PENDING" && (
              <div className="button-row">
                <button className="button button-primary" type="button" onClick={() => void decide(approval, "APPROVED").catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Approval failed."))}>Approve exact envelope</button>
                <button className="button button-quiet" type="button" onClick={() => void decide(approval, "REJECTED").catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Rejection failed."))}>Reject</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
