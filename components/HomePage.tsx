import Link from "next/link";

import { Brand } from "./Brand";

const curriculumGroups = [
  ["01–03", "Foundation", "Ethics, state lanes, and a durable operating setup."],
  ["04–06", "Evidence", "Focused markets, lawful sources, and defensible analysis."],
  ["07–09", "Execution", "Compliant outreach planning, seller discovery, and counsel."],
  ["10–12", "Transaction", "Buyer verification, structure selection, and closeout."],
] as const;

export function HomePage() {
  return (
    <div className="public-page">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Public">
          <a href="#system">The system</a>
          <a href="#curriculum">Curriculum</a>
          <a href="#pricing">Programs</a>
          <Link className="button button-small button-outline" href="/dashboard">
            Open workspace
          </Link>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <span className="eyebrow light">New England Wholesale OS</span>
            <h1>
              Your first deal needs a system.
              <span>Not more noise.</span>
            </h1>
            <p>
              A 90-Day First-Deal Execution System for beginning and early-stage
              wholesalers operating carefully in Massachusetts and Rhode Island.
            </p>
            <div className="hero-actions">
              <Link className="button button-coral" href="/dashboard">
                Start with the free workspace <span aria-hidden="true">→</span>
              </Link>
              <a className="text-link light-link" href="#system">
                See how it works
              </a>
            </div>
            <p className="hero-fineprint">
              A structured execution plan—not a guarantee that you will contract
              or close a transaction within 90 days.
            </p>
          </div>

          <div className="hero-instrument" aria-label="Product principles">
            <div className="instrument-top">
              <span>DEAL READINESS</span>
              <span>MA · RI</span>
            </div>
            <div className="instrument-orbit" aria-hidden="true">
              <i />
              <i />
              <span>90</span>
            </div>
            <dl className="instrument-list">
              <div>
                <dt>01</dt>
                <dd>Choose a state lane</dd>
              </div>
              <div>
                <dt>02</dt>
                <dd>Analyze with evidence</dd>
              </div>
              <div>
                <dt>03</dt>
                <dd>Unlock only when ready</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="trust-strip" aria-label="Product safeguards">
          <span>Local-first data</span>
          <span>Explainable calculations</span>
          <span>State-separated workflows</span>
          <span>No automated outreach</span>
        </section>

        <section className="public-section system-section" id="system">
          <div className="section-heading">
            <span className="eyebrow">Built for disciplined action</span>
            <h2>A field system with guardrails already on.</h2>
            <p>
              Learn the work, record your own evidence, and keep sensitive
              decisions in human hands.
            </p>
          </div>
          <div className="system-grid">
            <article className="feature-card feature-card-wide">
              <span className="feature-number">01</span>
              <div>
                <h3>Learn the operating sequence</h3>
                <p>
                  Twelve modules and a 13-week plan connect legal boundaries,
                  research, underwriting, seller conversations, buyers, and
                  closing.
                </p>
              </div>
              <div className="mini-route" aria-hidden="true">
                <span>STATE</span><i /><span>EVIDENCE</span><i /><span>REVIEW</span>
              </div>
            </article>
            <article className="feature-card">
              <span className="feature-number">02</span>
              <h3>Run real numbers</h3>
              <p>
                Use your own ARV, repair, cost, profit, and fee assumptions.
                Every result exposes its formula.
              </p>
              <strong className="feature-formula">
                ARV − costs − profit − fee
              </strong>
            </article>
            <article className="feature-card dark-card">
              <span className="feature-number">03</span>
              <h3>Know what is blocked</h3>
              <p>
                State warnings and readiness gates make missing agreements,
                disclosures, buyer evidence, and counsel review visible.
              </p>
              <span className="blocked-line">Human review required</span>
            </article>
          </div>
        </section>

        <section className="state-section">
          <div className="state-intro">
            <span className="eyebrow light">Two states. Two visible lanes.</span>
            <h2>Compliance is part of the workflow—not footer copy.</h2>
            <p>
              Tradewind keeps Massachusetts and Rhode Island decisions separate
              and links every legal baseline to its dated public source.
            </p>
            <Link className="text-link light-link" href="/compliance">
              Review the compliance workspace →
            </Link>
          </div>
          <div className="state-cards">
            <article>
              <span className="state-code">MA</span>
              <h3>Principal vs. broker guide</h3>
              <p>
                Record the capacity in which you act. Marketing readiness stays
                gated until the interest and title disclosure are documented.
              </p>
            </article>
            <article>
              <span className="state-code ri">RI</span>
              <h3>2027 transition controls</h3>
              <p>
                A permanent January 1, 2027 alert and separate seller/assignee
                cancellation trackers keep the transition visible.
              </p>
            </article>
          </div>
        </section>

        <section className="public-section curriculum-section" id="curriculum">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">12-module field curriculum</span>
              <h2>From first principles to closeout.</h2>
            </div>
            <p>
              Every module has an action, tool, knowledge check, and measurable
              completion condition.
            </p>
          </div>
          <div className="curriculum-preview">
            {curriculumGroups.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <Link className="button button-navy" href="/academy">
            Explore the academy
          </Link>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="section-heading">
            <span className="eyebrow">A transparent value ladder</span>
            <h2>Start where you are. Add support when it earns its place.</h2>
          </div>
          <div className="pricing-grid">
            <article>
              <span className="price-tag">Free</span>
              <h3>Deal Readiness Kit</h3>
              <p>
                State selection, seven-day plan, MAO calculator, compliance
                checklist, and buyer-verification checklist.
              </p>
              <Link className="text-link" href="/dashboard">
                Open the kit →
              </Link>
            </article>
            <article>
              <span className="price-tag">$79 <small>/ month</small></span>
              <h3>DealFlow Membership</h3>
              <p>
                Full curriculum, action tracker, Deal Lab, local pipelines,
                weekly group support, and Deal Desk access.
              </p>
              <span className="availability">Enrollment details coming separately</span>
            </article>
            <article>
              <span className="price-tag">$1,497</span>
              <h3>90-Day Accelerator</h3>
              <p>
                A structured cohort with milestones, deal reviews, conversation
                review, buyer-list development, and closing guidance.
              </p>
              <span className="founding-badge">Founding cohort · $497</span>
            </article>
          </div>
        </section>

        <section className="public-cta">
          <span className="eyebrow light">Start clean</span>
          <h2>Bring your own real information. The workspace brings the structure.</h2>
          <p>
            No seeded opportunities. No invented buyers. No income claims. Your
            records stay on your device until you export them.
          </p>
          <Link className="button button-sand" href="/dashboard">
            Open Tradewind DealFlow →
          </Link>
        </section>
      </main>

      <footer className="public-footer">
        <Brand />
        <p>
          Tradewind DealFlow is educational and operational software. It is not
          legal, tax, financial, brokerage, appraisal, or investment advice.
          Counsel review is required for executable documents and
          state-dependent transaction structures.
        </p>
        <div>
          <Link href="/compliance">Compliance</Link>
          <Link href="/resources">Official sources</Link>
          <span>Last reviewed July 27, 2026</span>
        </div>
      </footer>
    </div>
  );
}
