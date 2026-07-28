"use client";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import { curriculumModules, executionWeeks } from "@/lib/content";

export function AcademyWorkspace() {
  const { data, updateData } = useLocalData();
  const completeModules = curriculumModules.filter(
    (module) => data.curriculum[module.id],
  ).length;
  const completeWeeks = executionWeeks.filter(
    (_, index) => data.weekProgress[`week-${index + 1}`],
  ).length;

  return (
    <>
      <WorkspaceHeader
        eyebrow="Execution curriculum"
        title="Academy"
        description="12 learning modules and a 13-week plan that turn concepts into reviewable operating evidence."
      />
      <LocalDataNotice />

      <section className="academy-progress panel" aria-labelledby="academy-progress-title">
        <div>
          <span className="mini-label">Learning progress</span>
          <h2 id="academy-progress-title">{completeModules} of 12 modules complete</h2>
          <p>
            Mark a module complete only after its action, tool, knowledge check,
            and measurable condition have all been met.
          </p>
        </div>
        <div className="academy-gauge">
          <strong>{Math.round((completeModules / 12) * 100)}%</strong>
          <span>documented</span>
        </div>
      </section>

      <div className="academy-layout">
        <section aria-labelledby="modules-title">
          <div className="section-line-heading">
            <div>
              <span className="section-index">01 · CURRICULUM MAP</span>
              <h2 id="modules-title">Twelve operating modules</h2>
            </div>
            <StatusPill tone={completeModules === 12 ? "good" : "neutral"}>
              {completeModules}/12
            </StatusPill>
          </div>
          <div className="module-list">
            {curriculumModules.map((module) => {
              const checked = Boolean(data.curriculum[module.id]);
              return (
                <article className={checked ? "module-card complete" : "module-card"} key={module.id}>
                  <div className="module-number">{module.number}</div>
                  <div className="module-content">
                    <div className="module-title-row">
                      <div>
                        <h3>{module.title}</h3>
                        <p>{module.summary}</p>
                      </div>
                      <label className="completion-toggle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            updateData((current) => ({
                              ...current,
                              curriculum: {
                                ...current.curriculum,
                                [module.id]: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{checked ? "Complete" : "Mark complete"}</span>
                      </label>
                    </div>
                    <details>
                      <summary>Module requirements</summary>
                      <dl className="module-requirements">
                        <div><dt>Action</dt><dd>{module.action}</dd></div>
                        <div><dt>Worksheet / tool</dt><dd>{module.tool}</dd></div>
                        <div><dt>Knowledge check</dt><dd>{module.check}</dd></div>
                        <div><dt>Completion condition</dt><dd>{module.completion}</dd></div>
                      </dl>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="week-rail" aria-labelledby="weeks-title">
          <div className="week-rail-heading">
            <span className="section-index">02 · 90-DAY TRACK</span>
            <h2 id="weeks-title">13-week execution plan</h2>
            <p>{completeWeeks} weekly milestones recorded</p>
          </div>
          <ol>
            {executionWeeks.map((week, index) => {
              const key = `week-${index + 1}`;
              const checked = Boolean(data.weekProgress[key]);
              return (
                <li className={checked ? "week-complete" : ""} key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        updateData((current) => ({
                          ...current,
                          weekProgress: {
                            ...current.weekProgress,
                            [key]: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span className="week-number">W{String(index + 1).padStart(2, "0")}</span>
                    <span>{week}</span>
                  </label>
                </li>
              );
            })}
          </ol>
          <div className="week-note">
            <strong>Execution, not outcome</strong>
            <p>
              Completing the plan records disciplined activity. It does not
              guarantee a contract, assignment, funding, or closing.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
