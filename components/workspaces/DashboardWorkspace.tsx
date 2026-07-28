"use client";

import Link from "next/link";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  EmptyState,
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import { curriculumModules, executionWeeks } from "@/lib/content";
import { statePathSummary } from "@/lib/compliance";
import type { ParticipationPath, StateCode } from "@/lib/types";

const readinessItems = [
  "State lane selected",
  "Participation role recorded",
  "Attorney interview scheduled",
  "Authorized research sources documented",
  "Written buy box complete",
  "Buyer verification process ready",
] as const;

export function DashboardWorkspace() {
  const { data, updateData } = useLocalData();
  const completedModules = curriculumModules.filter(
    (module) => data.curriculum[module.id],
  ).length;
  const completedWeeks = executionWeeks.filter(
    (_, index) => data.weekProgress[`week-${index + 1}`],
  ).length;
  const readinessDone = readinessItems.filter(
    (item) => data.readinessChecks[item],
  ).length;
  const pipelineValue = data.deals.reduce(
    (sum, deal) => sum + (deal.askingPrice ?? 0),
    0,
  );
  const nextModule = curriculumModules.find(
    (module) => !data.curriculum[module.id],
  );

  const setPreference = (
    key: "selectedState" | "participationPath",
    value: StateCode | ParticipationPath | null,
  ) => {
    updateData((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Command center"
        title="DealFlow dashboard"
        description="A truthful view of readiness, learning, and the records you have entered yourself."
        action={
          <Link className="button button-primary" href="/deal-lab">
            Open Deal Lab
          </Link>
        }
      />
      <LocalDataNotice />

      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-copy">
          <span className="section-index">01 · SELECT YOUR LANE</span>
          <h2 id="setup-title">Start with capacity, then activity.</h2>
          <p>
            This selection does not determine legal status. It makes the correct
            warnings visible while you obtain state-specific advice.
          </p>
        </div>
        <div className="lane-controls">
          <fieldset>
            <legend>Primary state</legend>
            <div className="segmented">
              {(["MA", "RI"] as const).map((state) => (
                <button
                  className={
                    data.preferences.selectedState === state ? "selected" : ""
                  }
                  type="button"
                  key={state}
                  aria-pressed={data.preferences.selectedState === state}
                  onClick={() => setPreference("selectedState", state)}
                >
                  <strong>{state}</strong>
                  <span>
                    {state === "MA" ? "Massachusetts" : "Rhode Island"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Participation path</legend>
            <div className="segmented path-segmented">
              <button
                type="button"
                className={
                  data.preferences.participationPath === "principal"
                    ? "selected"
                    : ""
                }
                aria-pressed={
                  data.preferences.participationPath === "principal"
                }
                onClick={() => setPreference("participationPath", "principal")}
              >
                <strong>Principal</strong>
                <span>Acting for yourself</span>
              </button>
              <button
                type="button"
                className={
                  data.preferences.participationPath === "licensed"
                    ? "selected"
                    : ""
                }
                aria-pressed={
                  data.preferences.participationPath === "licensed"
                }
                onClick={() => setPreference("participationPath", "licensed")}
              >
                <strong>Licensed</strong>
                <span>Supervised pathway</span>
              </button>
            </div>
          </fieldset>
        </div>
        <div className="lane-summary">
          <StatusPill
            tone={
              data.preferences.selectedState &&
              data.preferences.participationPath
                ? "warning"
                : "blocked"
            }
          >
            {data.preferences.selectedState &&
            data.preferences.participationPath
              ? "Path recorded"
              : "Setup incomplete"}
          </StatusPill>
          <p>
            {statePathSummary(
              data.preferences.selectedState,
              data.preferences.participationPath,
            )}
          </p>
          <Link href="/compliance">Open state decision guide →</Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="Workspace totals">
        <article>
          <span className="metric-icon sea" aria-hidden="true">
            ↗
          </span>
          <span>Property records</span>
          <strong>{data.deals.length}</strong>
          <small>User-entered only</small>
        </article>
        <article>
          <span className="metric-icon teal" aria-hidden="true">
            ◎
          </span>
          <span>Buyer profiles</span>
          <strong>{data.buyers.length}</strong>
          <small>Verification required</small>
        </article>
        <article>
          <span className="metric-icon sand" aria-hidden="true">
            ◇
          </span>
          <span>Saved analyses</span>
          <strong>{data.analyses.length}</strong>
          <small>Input-based estimates</small>
        </article>
        <article>
          <span className="metric-icon coral" aria-hidden="true">
            $
          </span>
          <span>Recorded asking total</span>
          <strong>
            {pipelineValue === 0
              ? "—"
              : new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                  notation: "compact",
                }).format(pipelineValue)}
          </strong>
          <small>Not pipeline value or revenue</small>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="panel progress-panel" aria-labelledby="progress-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">90-day field plan</span>
              <h2 id="progress-title">Execution progress</h2>
            </div>
            <strong className="progress-number">
              {Math.round((completedWeeks / executionWeeks.length) * 100)}%
            </strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={executionWeeks.length}
            aria-valuenow={completedWeeks}
            aria-label={`${completedWeeks} of ${executionWeeks.length} weeks complete`}
          >
            <span
              style={{
                width: `${(completedWeeks / executionWeeks.length) * 100}%`,
              }}
            />
          </div>
          <div className="progress-meta">
            <span>{completedWeeks} of 13 weeks</span>
            <span>{completedModules} of 12 modules</span>
          </div>
          <div className="next-action-card">
            <span className="next-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <small>Next recommended lesson</small>
              <strong>
                {nextModule?.title ?? "Review and document your next cycle"}
              </strong>
            </div>
          </div>
          <Link className="text-link" href="/academy">
            Continue in Academy →
          </Link>
        </section>

        <section className="panel" aria-labelledby="readiness-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Operator readiness</span>
              <h2 id="readiness-title">Before lead activity</h2>
            </div>
            <StatusPill
              tone={readinessDone === readinessItems.length ? "good" : "warning"}
            >
              {readinessDone}/{readinessItems.length}
            </StatusPill>
          </div>
          <div className="check-list">
            {readinessItems.map((item) => (
              <label className="check-row" key={item}>
                <input
                  type="checkbox"
                  checked={Boolean(data.readinessChecks[item])}
                  onChange={(event) =>
                    updateData((current) => ({
                      ...current,
                      readinessChecks: {
                        ...current.readinessChecks,
                        [item]: event.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  <strong>{item}</strong>
                  <small>
                    {item.includes("Attorney")
                      ? "Record scheduling only; this is not legal approval."
                      : "Operator-confirmed checklist item"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {data.deals.length === 0 && (
        <section className="panel">
          <EmptyState
            title="No property records yet"
            action={
              <Link className="button button-primary button-small" href="/pipeline">
                Add your first real lead
              </Link>
            }
          >
            The production workspace starts empty by design. Add only a record
            you collected lawfully or received from an authorized source.
          </EmptyState>
        </section>
      )}

      <aside className="ri-alert">
        <span className="alert-date">JAN 01 · 2027</span>
        <div>
          <strong>Rhode Island transition remains on the radar.</strong>
          <p>
            Public Law 2026, chapter 410 changes recurring equitable-interest
            wholesaling requirements. The RI workflow uses heightened controls
            now and requires Rhode Island counsel.
          </p>
        </div>
        <Link href="/compliance">Review RI lane →</Link>
      </aside>
    </>
  );
}
