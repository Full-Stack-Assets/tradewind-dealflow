"use client";

import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLocalData } from "@/components/LocalDataProvider";
import { formatProvenanceDate } from "@/lib/display-date";
import { StatusPill } from "@/components/WorkspaceShell";
import {
  resolveFactConflict,
  resolveResearchRestriction,
} from "@/lib/lead-ingestion";
import { adaptQualificationForLaunch } from "@/lib/launch-qualification";
import { qualifyDeal } from "@/lib/qualification";
import type {
  DealRecord,
  FactConflict,
  ResearchRestriction,
} from "@/lib/types";

type ConflictDecision = {
  conflictId: string;
  selectedSide: "Canonical" | "Asserted";
  basis: string;
};

type RestrictionDecision = {
  restrictionId: string;
  note: string;
};

export function QualificationPanel({ deal }: { deal: DealRecord }) {
  const { data, updateData, writesSupported } = useLocalData();
  const qualification = useMemo(
    () => qualifyDeal(deal, data.buyBox, new Date()),
    [data.buyBox, deal],
  );
  const launch = useMemo(
    () => adaptQualificationForLaunch(qualification),
    [qualification],
  );
  const [conflictDecision, setConflictDecision] =
    useState<ConflictDecision | null>(null);
  const [restrictionDecision, setRestrictionDecision] =
    useState<RestrictionDecision | null>(null);
  const [confirmConflict, setConfirmConflict] = useState(false);
  const [confirmRestriction, setConfirmRestriction] = useState(false);
  const [message, setMessage] = useState("");

  const resolveConflict = async () => {
    if (!conflictDecision) return;
    let domainError = "";
    const result = await updateData((current) => {
      try {
        return resolveFactConflict(
          current,
          deal.id,
          conflictDecision.conflictId,
          conflictDecision.selectedSide,
          conflictDecision.basis,
          new Date(),
        );
      } catch (error) {
        domainError = safeError(error);
        throw error;
      }
    });
    if (!result.ok) {
      setMessage(domainError || result.message);
      return;
    }
    setConfirmConflict(false);
    setConflictDecision(null);
    setMessage("The fact conflict was resolved; source history was preserved.");
  };

  const resolveRestriction = async () => {
    if (!restrictionDecision) return;
    let domainError = "";
    const result = await updateData((current) => {
      try {
        return resolveResearchRestriction(
          current,
          deal.id,
          restrictionDecision.restrictionId,
          restrictionDecision.note,
          new Date(),
        );
      } catch (error) {
        domainError = safeError(error);
        throw error;
      }
    });
    if (!result.ok) {
      setMessage(domainError || result.message);
      return;
    }
    setConfirmRestriction(false);
    setRestrictionDecision(null);
    setMessage("The restriction history was updated with the dated reason.");
  };

  return (
    <article className="qualification-card">
      <header className="qualification-heading">
        <div>
          <span className="mini-label">
            {deal.stage} · Buy box v{qualification.buyBoxVersion}
          </span>
          <h3>{deal.address}</h3>
          <p>
            {deal.city}, {deal.state} {deal.zip || "ZIP not recorded"}
          </p>
        </div>
        <div className="qualification-summary">
          <StatusPill tone={statusTone(launch.status)}>
            {launch.status}
          </StatusPill>
          <strong>
            {launch.scoreLabel}: {launch.score ?? "Unavailable"}
          </strong>
          <small>{launch.scoreExplanation}</small>
        </div>
      </header>

      <div className="contact-gate blocked">
        <strong>Contact blocked · {launch.contact.state}</strong>
        <p>{launch.contact.reason}</p>
      </div>

      <dl className="evidence-status-grid">
        <div>
          <dt>Data freshness</dt>
          <dd>
            {launch.freshness.status}
            {launch.freshness.ageDays === null
              ? " · verification date unknown"
              : ` · ${launch.freshness.ageDays} days old`}
          </dd>
        </div>
        <div>
          <dt>Source confidence</dt>
          <dd>{launch.sourceConfidence ?? "Unknown / unassessed"}</dd>
        </div>
      </dl>

      <dl className="launch-category-grid">
        {launch.categories.map((category) => (
          <div key={category.key}>
            <dt>{category.label}</dt>
            <dd>
              <strong>{category.assessment}</strong>
              <span>{category.explanation}</span>
              {category.evidence.length > 0 && (
                <small>Evidence: {category.evidence.join("; ")}</small>
              )}
              {category.missingInformation.length > 0 && (
                <small>
                  Unknown: {category.missingInformation.join(", ")}
                </small>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="qualification-columns">
        <EvidenceList
          title="Why it may fit"
          items={launch.positiveReasons}
          empty="No positive evidence is assessed yet."
        />
        <EvidenceList
          title="Why it may not fit"
          items={launch.negativeReasons}
          empty="No negative fit evidence is recorded."
        />
        <EvidenceList
          title="Missing or unknown"
          items={launch.missingInformation}
          empty="No missing qualification facts are recorded."
        />
        <EvidenceList
          title="Restrictions and disqualifiers"
          items={[
            ...launch.restrictions.map(
              ({ code, reason }) => `${code}: ${reason}`,
            ),
            ...launch.disqualifiers,
          ]}
          empty="No active restriction or disqualifier is recorded."
        />
      </div>

      <div className="next-research-task">
        <span className="mini-label">Highest-priority next research task</span>
        <strong>
          {launch.nextResearchTask?.taskType ?? "No derived task available"}
        </strong>
        <p>
          {launch.nextResearchTask?.reason ?? launch.recommendedAction}
        </p>
        <small>
          Research priority: {qualification.researchPriority.label}{" "}
          ({qualification.researchPriority.score}/100). This is not predicted
          transaction value.
        </small>
      </div>

      <details className="integrity-details">
        <summary>Provenance and source rights</summary>
        {deal.sourceAssertions.length === 0 ? (
          <p className="muted-copy">
            No source assertion is recorded. Provenance is unverified.
          </p>
        ) : (
          <div className="source-history">
            {deal.sourceAssertions.map((assertion) => (
              <article key={assertion.id}>
                <strong>{assertion.source}</strong>
                <span className="source-identifier">
                  Source record: {assertion.sourceRecordId}
                </span>
                <dl>
                  <div>
                    <dt>Rights</dt>
                    <dd>{assertion.usageClassification}</dd>
                  </div>
                  <div>
                    <dt>Retrieved</dt>
                    <dd>{formatProvenanceDate(assertion.retrievedAt)}</dd>
                  </div>
                  <div>
                    <dt>Verified</dt>
                    <dd>{formatProvenanceDate(assertion.lastVerifiedAt)}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{assertion.confidence ?? "Unknown / unassessed"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </details>

      <details className="integrity-details">
        <summary>
          Fact conflicts ({deal.factConflicts.filter(({ status }) => status === "Unresolved").length} unresolved)
        </summary>
        {deal.factConflicts.length === 0 ? (
          <p className="muted-copy">No source fact conflicts are recorded.</p>
        ) : (
          <div className="conflict-list">
            {deal.factConflicts.map((conflict) => (
              <ConflictItem
                key={conflict.id}
                conflict={conflict}
                decision={
                  conflictDecision?.conflictId === conflict.id
                    ? conflictDecision
                    : null
                }
                writesSupported={writesSupported}
                onChange={setConflictDecision}
                onConfirm={() => setConfirmConflict(true)}
                onCancel={() => setConflictDecision(null)}
              />
            ))}
          </div>
        )}
      </details>

      <details className="integrity-details">
        <summary>
          Restriction history ({deal.researchRestrictions.filter(({ resolvedAt }) => resolvedAt === null).length} active)
        </summary>
        {deal.researchRestrictions.length === 0 ? (
          <p className="muted-copy">No structured restriction is recorded.</p>
        ) : (
          <div className="restriction-list">
            {deal.researchRestrictions.map((restriction) => (
              <RestrictionItem
                key={restriction.id}
                restriction={restriction}
                decision={
                  restrictionDecision?.restrictionId === restriction.id
                    ? restrictionDecision
                    : null
                }
                writesSupported={writesSupported}
                onChange={setRestrictionDecision}
                onConfirm={() => setConfirmRestriction(true)}
                onCancel={() => setRestrictionDecision(null)}
              />
            ))}
          </div>
        )}
      </details>

      <aside className="action-boundary">
        <strong>A score never authorizes contact.</strong>
        <p>
          It also never authorizes an offer, public marketing, a contract,
          sensitive disclosure, final buyer selection, money, or closing
          instructions. Those actions remain outside this milestone and
          human-gated.
        </p>
      </aside>

      <p className="form-message persistent-message" role="status" aria-live="polite">
        {message || "No integrity decision is pending."}
      </p>

      <ConfirmDialog
        open={confirmConflict}
        title="Confirm fact-conflict resolution?"
        description="This records the selected canonical decision and dated basis. The source assertion remains in history."
        confirmLabel="Confirm resolution"
        cancelLabel="Continue review"
        onCancel={() => setConfirmConflict(false)}
        onConfirm={resolveConflict}
      />
      <ConfirmDialog
        open={confirmRestriction}
        title="Confirm restriction resolution?"
        description="This preserves the restriction and records the dated resolution reason. Source-derived restrictions cannot be resolved here."
        confirmLabel="Confirm resolution"
        cancelLabel="Continue review"
        onCancel={() => setConfirmRestriction(false)}
        onConfirm={resolveRestriction}
      />
    </article>
  );
}

function EvidenceList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function ConflictItem({
  conflict,
  decision,
  writesSupported,
  onChange,
  onConfirm,
  onCancel,
}: {
  conflict: FactConflict;
  decision: ConflictDecision | null;
  writesSupported: boolean;
  onChange: (value: ConflictDecision) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <article>
      <div>
        <strong>{conflict.field}</strong>
        <span>{conflict.status}</span>
      </div>
      <dl>
        <div>
          <dt>Canonical</dt>
          <dd>{displayValue(conflict.canonicalValue)}</dd>
        </div>
        <div>
          <dt>Asserted</dt>
          <dd>{displayValue(conflict.assertedValue)}</dd>
        </div>
      </dl>
      {conflict.status === "Resolved" ? (
        <p className="muted-copy">
          {conflict.resolution?.selectedSide}: {conflict.resolution?.basis}
        </p>
      ) : decision ? (
        <div className="resolution-editor">
          <fieldset>
            <legend>Select the retained fact</legend>
            <label>
              <input
                type="radio"
                name={`conflict-${conflict.id}`}
                checked={decision.selectedSide === "Canonical"}
                onChange={() =>
                  onChange({ ...decision, selectedSide: "Canonical" })
                }
              />
              Keep canonical
            </label>
            <label>
              <input
                type="radio"
                name={`conflict-${conflict.id}`}
                checked={decision.selectedSide === "Asserted"}
                onChange={() =>
                  onChange({ ...decision, selectedSide: "Asserted" })
                }
              />
              Use asserted
            </label>
          </fieldset>
          <label>
            <span>Review basis</span>
            <textarea
              rows={2}
              value={decision.basis}
              onChange={(event) =>
                onChange({ ...decision, basis: event.target.value })
              }
              aria-describedby={`conflict-help-${conflict.id}`}
            />
            <small id={`conflict-help-${conflict.id}`}>
              Record the evidence used. Source history is never deleted.
            </small>
          </label>
          <div className="button-row">
            <button
              className="button button-primary button-small"
              type="button"
              disabled={!writesSupported || decision.basis.trim() === ""}
              onClick={onConfirm}
            >
              Review resolution
            </button>
            <button
              className="button button-quiet button-small"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="button button-quiet button-small"
          type="button"
          disabled={!writesSupported}
          onClick={() =>
            onChange({
              conflictId: conflict.id,
              selectedSide: "Canonical",
              basis: "",
            })
          }
        >
          Resolve with evidence
        </button>
      )}
    </article>
  );
}

function RestrictionItem({
  restriction,
  decision,
  writesSupported,
  onChange,
  onConfirm,
  onCancel,
}: {
  restriction: ResearchRestriction;
  decision: RestrictionDecision | null;
  writesSupported: boolean;
  onChange: (value: RestrictionDecision) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const canResolve =
    restriction.resolvedAt === null &&
    (restriction.source === "Operator" || restriction.source === "Migration");
  return (
    <article>
      <div>
        <strong>{restriction.code}</strong>
        <span>{restriction.resolvedAt === null ? "Active" : "Resolved"}</span>
      </div>
      <p>{restriction.reason}</p>
      <small>
        Source: {restriction.source} · Created{" "}
        {formatProvenanceDate(restriction.createdAt)}
      </small>
      {restriction.resolvedAt !== null && (
        <p className="muted-copy">
          Resolved {formatProvenanceDate(restriction.resolvedAt)}:{" "}
          {restriction.resolutionNote}
        </p>
      )}
      {restriction.source === "Source assertion" &&
        restriction.resolvedAt === null && (
          <p className="muted-copy">
            Source-derived hold. No direct resolution or delete control is
            available.
          </p>
        )}
      {canResolve && (decision ? (
        <div className="resolution-editor">
          <label>
            <span>Dated resolution reason</span>
            <textarea
              rows={2}
              value={decision.note}
              onChange={(event) =>
                onChange({ ...decision, note: event.target.value })
              }
              aria-describedby={`restriction-help-${restriction.id}`}
            />
            <small id={`restriction-help-${restriction.id}`}>
              Include the verified review date as YYYY-MM-DD.
            </small>
          </label>
          <div className="button-row">
            <button
              className="button button-primary button-small"
              type="button"
              disabled={!writesSupported || decision.note.trim() === ""}
              onClick={onConfirm}
            >
              Review resolution
            </button>
            <button
              className="button button-quiet button-small"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="button button-quiet button-small"
          type="button"
          disabled={!writesSupported}
          onClick={() =>
            onChange({ restrictionId: restriction.id, note: "" })
          }
        >
          Resolve with dated reason
        </button>
      ))}
    </article>
  );
}

function statusTone(
  status: ReturnType<typeof adaptQualificationForLaunch>["status"],
): "good" | "warning" | "blocked" | "neutral" {
  if (status === "Qualified") return "good";
  if (status === "Possible" || status === "Research required") return "warning";
  if (
    status === "Disqualified" ||
    status === "Compliance or specialist review"
  ) {
    return "blocked";
  }
  return "neutral";
}

function displayValue(value: string | number | null): string {
  return value === null || value === "" ? "Unknown / blank" : String(value);
}

function safeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The integrity decision could not be saved.";
}
