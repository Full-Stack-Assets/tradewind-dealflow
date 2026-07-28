import {
  LAST_REVIEWED,
  officialSources,
  propertyResearchSources,
} from "@/lib/content";
import {
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";

const interviews = [
  {
    title: "Real-estate attorney",
    questions: [
      "Which activities can I perform as a principal in this state?",
      "What disclosures and cancellation rights apply to each structure?",
      "How should I describe an equitable interest before title transfers?",
      "Which agreement language has your office approved for this workflow?",
    ],
  },
  {
    title: "Closing professional",
    questions: [
      "Which transaction structures will your office close?",
      "What title, funds, identity, and entity evidence is required?",
      "How are assignment fees or multiple closings shown?",
      "What timeline and access issues commonly delay a closing?",
    ],
  },
  {
    title: "Contractor",
    questions: [
      "Are licensing, registration, and insurance current?",
      "What is included and excluded from the written scope?",
      "How are unknown conditions and change orders handled?",
      "What evidence supports labor, material, and schedule ranges?",
    ],
  },
  {
    title: "Cash buyer",
    questions: [
      "What exact markets, types, price ranges, and rehab levels fit?",
      "Which proof-of-funds evidence can be verified and when does it expire?",
      "Are assignments accepted and what closing speed is realistic?",
      "Which recent purchases may be verified through reliable records?",
    ],
  },
] as const;

const specimens = [
  {
    title: "Seller discovery outline",
    label: "Educational conversation specimen",
    body:
      "Ask permission to learn the owner’s desired outcome, timeline, decision-makers, condition, occupancy, access, and price expectations. Let reasons for selling be volunteered. Stop and route to specialist review when distress, confusion, incapacity, legal advice, foreclosure, bankruptcy, or probate complications appear.",
  },
  {
    title: "Role disclosure outline",
    label: "Counsel review required",
    body:
      "Describe the member’s actual role and financial interest. Do not state or imply that the member is the owner, broker, attorney, lender, government agency, or guaranteed purchaser. If marketing a contractual interest, say that legal title is not held and use only counsel-approved language.",
  },
  {
    title: "Buyer opportunity outline",
    label: "Counsel review required before use",
    body:
      "Identify the actual legal interest, verified property facts, pricing or assignment terms, repair and comparable ranges, occupancy, access process, genuine closing target, known risks, assumptions, and required disclosures. Never imply a property is owned when it is not.",
  },
] as const;

export function ResourcesWorkspace() {
  return (
    <>
      <WorkspaceHeader
        eyebrow="Operator reference"
        title="Resource center"
        description="Dated official links, research starting points, and interview tools—without executable legal forms."
        action={
          <StatusPill tone="neutral">{`Last reviewed: ${LAST_REVIEWED}`}</StatusPill>
        }
      />
      <LocalDataNotice />

      <section className="resource-hero">
        <div>
          <span className="eyebrow light">Source before certainty</span>
          <h2>Open the authority. Record the date. Ask the professional.</h2>
          <p>
            Public links are research starting points, not a substitute for
            current advice or verification in the property’s jurisdiction.
          </p>
        </div>
        <div className="resource-compass" aria-hidden="true"><span>NE</span></div>
      </section>

      <section className="resource-section" aria-labelledby="official-title">
        <div className="section-line-heading">
          <div>
            <span className="section-index">01 · LAW & REGULATORS</span>
            <h2 id="official-title">Official source baseline</h2>
          </div>
          <p>Every link opens the issuing government source.</p>
        </div>
        <div className="resource-link-grid">
          {officialSources.map((source) => (
            <a href={source.href} target="_blank" rel="noreferrer" key={source.href}>
              <span>{source.group}</span>
              <strong>{source.title}</strong>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </div>
      </section>

      <section className="resource-section" aria-labelledby="research-title">
        <div className="section-line-heading">
          <div>
            <span className="section-index">02 · PROPERTY RESEARCH</span>
            <h2 id="research-title">Public starting points</h2>
          </div>
          <p>Verify source currency, scope, use rights, and contradictions.</p>
        </div>
        <div className="research-cards">
          {propertyResearchSources.map((source) => (
            <article key={source.href}>
              <span className={`state-code ${source.state === "RI" ? "ri" : ""}`}>{source.state}</span>
              <h3>{source.title}</h3>
              <p>{source.note}</p>
              <a href={source.href} target="_blank" rel="noreferrer">Open official source ↗</a>
            </article>
          ))}
        </div>
      </section>

      <section className="resource-section" aria-labelledby="interview-title">
        <div className="section-line-heading">
          <div>
            <span className="section-index">03 · PROFESSIONAL NETWORK</span>
            <h2 id="interview-title">Interview checklists</h2>
          </div>
          <p>Document names, dates, jurisdiction, and follow-up evidence yourself.</p>
        </div>
        <div className="interview-grid">
          {interviews.map((interview, index) => (
            <article key={interview.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{interview.title}</h3>
              <ul>{interview.questions.map((question) => <li key={question}>{question}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="resource-section" aria-labelledby="specimens-title">
        <div className="section-line-heading">
          <div>
            <span className="section-index">04 · EDUCATIONAL SPECIMENS</span>
            <h2 id="specimens-title">Scripts and preparation outlines</h2>
          </div>
          <StatusPill tone="warning">Not executable forms</StatusPill>
        </div>
        <div className="specimen-list">
          {specimens.map((specimen) => (
            <article key={specimen.title}>
              <div>
                <span className="mini-label">{specimen.label}</span>
                <h3>{specimen.title}</h3>
              </div>
              <p>{specimen.body}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="counsel-callout">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Executable documents are intentionally absent.</strong>
          <p>
            No purchase agreement, assignment, novation, financing, subject-to,
            disclosure, or closing instruction is represented as attorney-approved.
            Use only documents actually approved by a licensed attorney in the
            applicable state.
          </p>
        </div>
      </aside>
    </>
  );
}
