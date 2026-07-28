"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import {
  buildLeadOperatingSnapshot,
  resolveLeadDashboardAccess,
} from "@/lib/dashboard";
import type { LaunchQualificationStatus } from "@/lib/launch-qualification";

const LAUNCH_STATUSES: LaunchQualificationStatus[] = [
  "Qualified",
  "Possible",
  "Research required",
  "Disqualified",
  "Compliance or specialist review",
];

export function DashboardWorkspace() {
  const {
    data,
    hydrated,
    storageStatus,
    storageMessage,
    writesSupported,
  } = useLocalData();
  const evaluationDate = useMemo(() => new Date(), []);
  const access = resolveLeadDashboardAccess({
    hydrated,
    storageStatus,
    writesSupported,
  });
  const snapshot = useMemo(
    () =>
      access.snapshotAvailable
        ? buildLeadOperatingSnapshot(data, evaluationDate)
        : null,
    [access.snapshotAvailable, data, evaluationDate],
  );
  const dashboardHeader = (
    <>
      <WorkspaceHeader
        eyebrow="Milestone 1 · Lead engine"
        title="Current operating snapshot"
        description="A present-state view of authorized records, qualification, research priorities, and hard blocks in this browser."
        action={
          <Link className="button button-primary" href="/pipeline">
            Open lead engine
          </Link>
        }
      />
      <LocalDataNotice />
    </>
  );

  if (access.state === "loading") {
    return (
      <>
        {dashboardHeader}
        <DashboardAvailability
          state="loading"
          storageMessage={null}
        />
      </>
    );
  }

  if (
    access.state === "corrupt"
    || access.state === "unavailable"
    || snapshot === null
  ) {
    return (
      <>
        {dashboardHeader}
        <DashboardAvailability
          state={
            access.state === "corrupt" ? "corrupt" : "unavailable"
          }
          storageMessage={storageMessage}
        />
      </>
    );
  }

  const configuredMarkets = data.buyBox.states.map((state) => {
    const markets = data.buyBox.marketsByState[state];
    return `${state}: ${markets.length > 0 ? markets.join(", ") : "No county selected"}`;
  });

  return (
    <>
      {dashboardHeader}
      <aside className="snapshot-boundary">
        <strong>
          Current snapshot, evaluated at page load—not an activity-history
          report.
        </strong>
        <p>
          Reload this page to refresh date-sensitive freshness and research
          priority. The local schema does not retain historical audit events;
          full event-by-event reporting remains deferred.
        </p>
      </aside>

      <section className="panel" aria-labelledby="configuration-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">What is configured?</span>
            <h2 id="configuration-title">Active buy box</h2>
          </div>
          <StatusPill tone={snapshot.buyBox.configured ? "good" : "blocked"}>
            {snapshot.buyBox.configured
              ? `Active · version ${snapshot.buyBox.version}`
              : "Configuration required"}
          </StatusPill>
        </div>
        <div className="configuration-summary-grid">
          <div>
            <span>Launch markets</span>
            <strong>
              {configuredMarkets.length > 0
                ? configuredMarkets.join(" · ")
                : "Not configured"}
            </strong>
          </div>
          <div>
            <span>Property types</span>
            <strong>
              {data.buyBox.propertyTypes.length > 0
                ? data.buyBox.propertyTypes.join(", ")
                : "Not configured"}
            </strong>
          </div>
          <div>
            <span>Source evidence gate</span>
            <strong>
              {data.buyBox.minimumConfidence} confidence ·{" "}
              {data.buyBox.maxVerificationAgeDays} days maximum age
            </strong>
          </div>
        </div>
        <Link className="text-link" href="/pipeline#buy-box-title">
          Review or create a buy-box version →
        </Link>
      </section>

      <section aria-labelledby="qualification-counts-title">
        <div className="section-heading-row">
          <div>
            <span className="mini-label">Current property records</span>
            <h2 id="qualification-counts-title">
              Qualification by launch status
            </h2>
          </div>
          <p>
            {snapshot.importedPropertyCount} imported of{" "}
            {snapshot.propertyRecordCount} total property records
          </p>
        </div>
        <dl className="qualification-count-grid">
          {LAUNCH_STATUSES.map((status) => (
            <div key={status}>
              <dt>{status}</dt>
              <dd>{snapshot.qualificationCounts[status]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="dashboard-columns">
        <section className="panel" aria-labelledby="data-gaps-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Evidence health</span>
              <h2 id="data-gaps-title">Missing or unknown facts</h2>
            </div>
          </div>
          <dl className="compact-count-list">
            <div>
              <dt>Missing provenance</dt>
              <dd>{snapshot.dataGaps.missingProvenanceRecords}</dd>
            </div>
            <div>
              <dt>Unknown source confidence</dt>
              <dd>{snapshot.dataGaps.unknownConfidenceRecords}</dd>
            </div>
            <div>
              <dt>Missing verification date</dt>
              <dd>{snapshot.dataGaps.missingVerificationRecords}</dd>
            </div>
          </dl>
          <p className="muted-copy">
            Unknown evidence remains unknown. It is never converted to zero or
            treated as verified.
          </p>
        </section>

        <section className="panel" aria-labelledby="blocked-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">What is blocked?</span>
              <h2 id="blocked-title">Blocked and remediation</h2>
            </div>
          </div>
          <dl className="compact-count-list">
            <div>
              <dt>Contact blocked</dt>
              <dd>{snapshot.blocked.contactBlockedRecords}</dd>
            </div>
            <div>
              <dt>Compliance or specialist review</dt>
              <dd>{snapshot.blocked.complianceReviewRecords}</dd>
            </div>
            <div>
              <dt>Unresolved fact conflicts</dt>
              <dd>{snapshot.integrity.unresolvedConflicts}</dd>
            </div>
            <div>
              <dt>Active restrictions</dt>
              <dd>{snapshot.integrity.activeRestrictions}</dd>
            </div>
            <div>
              <dt>Records needing research or remediation</dt>
              <dd>{snapshot.integrity.recordsNeedingRemediation}</dd>
            </div>
          </dl>
          <p className="muted-copy">
            Every imported record remains blocked from contact in this
            milestone. A score never authorizes outreach or transaction action.
          </p>
        </section>
      </div>

      <section className="panel" aria-labelledby="research-queue-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">
              Which records deserve research attention?
            </span>
            <h2 id="research-queue-title">Prioritized research queue</h2>
          </div>
          <span className="queue-count">
            {snapshot.researchItems.length > 0
              ? `${snapshot.researchItems.length} highest-priority records`
              : "Not enough data"}
          </span>
        </div>

        {snapshot.researchItems.length > 0 ? (
          <ol className="research-queue-list">
            {snapshot.researchItems.map((item) => (
              <li key={item.dealId}>
                <div className="research-priority">
                  <strong>{item.priorityScore}</strong>
                  <span>{item.priorityLabel}</span>
                </div>
                <div className="research-record">
                  <span className="mini-label">{item.qualificationStatus}</span>
                  <h3>
                    <Link href={item.href}>{item.address}</Link>
                  </h3>
                  <p>{item.location}</p>
                  <strong>{item.taskType}</strong>
                  <p>{item.reason}</p>
                  <small>
                    {item.qualificationScoreLabel}:{" "}
                    {item.qualificationScore ?? "Not enough data"} · Research
                    priority is not predicted transaction value.
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-workflow">
            <span className="mini-label">Shortest real workflow</span>
            <h3>No authorized property records are available to rank.</h3>
            <p>
              Strongest supported preliminary priority: Not enough data. Start
              with one real source and keep every review local.
            </p>
            <ol>
              <li>
                <Link href="/pipeline#buy-box-title">
                  Configure the launch buy box
                </Link>
                .
              </li>
              <li>
                <Link href="/pipeline#csv-import-title">
                  Download the blank property CSV template
                </Link>
                .
              </li>
              <li>Select one authorized source file.</li>
              <li>Review the local preview and every hold or conflict.</li>
              <li>Apply safe records only after the preview is correct.</li>
            </ol>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="system-health-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">Can the local system operate?</span>
            <h2 id="system-health-title">System and local storage</h2>
          </div>
          <StatusPill tone={storageTone(storageStatus)}>
            {storageLabel(storageStatus)}
          </StatusPill>
        </div>
        <dl className="system-health-grid">
          <div>
            <dt>Browser snapshot</dt>
            <dd>
              {hydrated
                ? "Current browser storage inspected"
                : "Loading the current browser snapshot"}
            </dd>
          </div>
          <div>
            <dt>Safe local writes</dt>
            <dd>
              {access.safeWritesAvailable
                ? "Serialized writes available"
                : "Unavailable · read and export only"}
            </dd>
          </div>
          <div>
            <dt>Release health</dt>
            <dd>
              Local-first · outreach disabled ·{" "}
              <Link href="/healthz">open health endpoint</Link>
            </dd>
          </div>
        </dl>
        {storageMessage && <p className="muted-copy">{storageMessage}</p>}
      </section>

      <aside className="action-boundary">
        <strong>What should happen next?</strong>
        <p>
          Work the first research item, update only evidence you can source,
          then review the recalculated result in Pipeline. First contact,
          offers, contracts, public marketing, sensitive sharing, buyer
          selection, money, and closing instructions remain manual or
          human-gated.
        </p>
      </aside>
    </>
  );
}

function DashboardAvailability({
  state,
  storageMessage,
}: {
  state: "loading" | "corrupt" | "unavailable";
  storageMessage: string | null;
}) {
  const loading = state === "loading";
  const corrupt = state === "corrupt";
  return (
    <section
      className="panel dashboard-availability"
      aria-labelledby="dashboard-system-health-title"
      aria-busy={loading}
    >
      <div className="panel-heading">
        <div>
          <span className="mini-label">Can the local system operate?</span>
          <h2 id="dashboard-system-health-title">
            System and local storage
          </h2>
        </div>
        <StatusPill tone={loading ? "neutral" : "blocked"}>
          {loading
            ? "Inspection pending"
            : corrupt
              ? "Corrupt workspace"
              : "Workspace unavailable"}
        </StatusPill>
      </div>
      <div
        role={loading ? "status" : "alert"}
        aria-live={loading ? "polite" : "assertive"}
      >
        <h3>
          {loading
            ? "Inspecting browser workspace"
            : corrupt
              ? "Workspace data could not be validated"
              : "Workspace storage unavailable"}
        </h3>
        <p>
          {loading
            ? "Buy-box configuration, property counts, research priorities, and write capability are Not enough data until browser storage is successfully inspected."
            : "Buy-box configuration, property counts, and research priorities are Not enough data because the browser workspace is not trusted."}
        </p>
        {storageMessage && <p className="muted-copy">{storageMessage}</p>}
      </div>
      <dl className="system-health-grid">
        <div>
          <dt>Browser snapshot</dt>
          <dd>
            {loading
              ? "Inspection in progress"
              : corrupt
                ? "Corrupt"
                : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Safe local writes</dt>
          <dd>{loading ? "Not evaluated" : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd>
            {loading ? (
              "Wait for the local inspection to finish."
            ) : (
              <Link href="/pipeline">
                Open Pipeline recovery controls
              </Link>
            )}
          </dd>
        </div>
      </dl>
      {!loading && (
        <p className="muted-copy">
          Restore and clear controls remain in Pipeline; this Dashboard does
          not overwrite the unreadable workspace.
        </p>
      )}
    </section>
  );
}

function storageLabel(status: string): string {
  if (status === "current") return "Current workspace";
  if (status === "empty") return "Empty workspace";
  if (status === "legacy") return "Legacy workspace";
  if (status === "recovered-legacy") return "Legacy recovery";
  if (status === "unsupported-lock") return "Read/export only";
  return "Attention required";
}

function storageTone(
  status: string,
): "good" | "warning" | "blocked" | "neutral" {
  if (status === "current" || status === "empty") return "good";
  if (status === "legacy" || status === "recovered-legacy") return "warning";
  if (
    status === "corrupt"
    || status === "invalid"
    || status === "too-large"
    || status === "quota"
    || status === "unavailable"
  ) {
    return "blocked";
  }
  return "neutral";
}
