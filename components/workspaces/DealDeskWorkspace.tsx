"use client";

import { useLocalData } from "@/components/LocalDataProvider";
import { GenerateWithAIButton } from "@/components/ai/GenerateWithAIButton";
import {
  EmptyState,
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import { downloadText } from "@/lib/download";

const qualificationChecks = [
  "Property and ownership facts have reliable sources",
  "Seller goals and decision-makers are recorded voluntarily",
  "Comparable and repair evidence is documented",
  "Transaction structure is clearly identified",
  "State lane and participation capacity are recorded",
  "No public or buyer marketing is implied by this packet",
  "Attorney and closing-professional questions are listed",
] as const;

export function DealDeskWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const draft = data.dealDeskDraft;
  const selectedDeal = data.deals.find((deal) => deal.id === draft.dealId);
  const checkCount = qualificationChecks.filter(
    (item) => draft.qualificationChecks[item],
  ).length;
  const ready =
    Boolean(selectedDeal) &&
    draft.submitterName.trim() !== "" &&
    draft.submitterEmail.trim() !== "" &&
    draft.summary.trim() !== "" &&
    draft.requestedStructure.trim() !== "" &&
    checkCount === qualificationChecks.length &&
    draft.consentToReview;

  const patchDraft = (patch: Partial<typeof draft>) => {
    void updateData((current) => ({
      ...current,
      dealDeskDraft: { ...current.dealDeskDraft, ...patch },
    }));
  };

  const exportPacket = () => {
    if (!ready || !selectedDeal) return;
    const checked = qualificationChecks
      .map((item) => `- [${draft.qualificationChecks[item] ? "x" : " "}] ${item}`)
      .join("\n");
    const packet = [
      "TRADEWIND DEALFLOW — DEAL DESK REVIEW PACKET",
      `Exported: ${new Date().toISOString()}`,
      "",
      "SUBMITTER",
      `Name: ${draft.submitterName}`,
      `Email: ${draft.submitterEmail}`,
      "",
      "USER-ENTERED PROPERTY RECORD",
      `Address: ${selectedDeal.address}, ${selectedDeal.city}, ${selectedDeal.state}`,
      `Property type: ${selectedDeal.propertyType}`,
      `Source: ${selectedDeal.source}`,
      `Stage: ${selectedDeal.stage}`,
      `Asking price: ${selectedDeal.askingPrice ?? "Not recorded"}`,
      "",
      "REQUEST",
      `Structure to review: ${draft.requestedStructure}`,
      draft.summary,
      "",
      "QUALIFICATION CHECKLIST",
      checked,
      "",
      "CONSENT",
      "The operator recorded consent for Tradewind to review this exported packet.",
      "",
      "IMPORTANT LIMITATION",
      "Preparing or sharing this packet does not create representation, agency,",
      "financing, acceptance, compensation, or a promise to acquire, fund,",
      "partner on, assign, or close the transaction.",
    ].join("\n");
    downloadText("tradewind-deal-desk-packet.txt", packet);
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Structured human review"
        title="Deal Desk"
        description="Prepare a disciplined, exportable review packet without implying acceptance, funding, or representation."
        action={<StatusPill tone={ready ? "good" : "warning"}>{ready ? "Packet ready" : "Draft incomplete"}</StatusPill>}
      />
      <LocalDataNotice />

      <section className="desk-principle">
        <span className="desk-number">01</span>
        <div>
          <span className="eyebrow light">What the Deal Desk may do</span>
          <h2>Review a qualifying opportunity for a documented, lawful structure.</h2>
          <p>
            Possible outcomes may include Tradewind becoming a bona fide principal,
            an attorney-drafted joint venture, an assignment, an acquisition, or a
            licensed brokerage arrangement. No outcome is promised.
          </p>
        </div>
      </section>

      {data.deals.length === 0 ? (
        <section className="panel">
          <EmptyState title="A real property record is required">
            Add a lawfully sourced property in Pipeline before preparing a Deal
            Desk packet. The system will not create a sample opportunity.
          </EmptyState>
        </section>
      ) : (
        <div className="desk-layout">
          <form className="panel desk-form" onSubmit={(event) => event.preventDefault()}>
            <div className="panel-heading">
              <div>
                <span className="mini-label">Local packet draft</span>
                <h2>Opportunity and request</h2>
              </div>
              <span className="required-note">* Required</span>
            </div>
            <label>
              <span>Property record *</span>
              <select required disabled={!writesSupported} value={draft.dealId} onChange={(event) => patchDraft({ dealId: event.target.value })}>
                <option value="">Select a property</option>
                {data.deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.address}, {deal.city} · {deal.state}</option>)}
              </select>
            </label>
            <div className="form-grid two">
              <label>
                <span>Submitter name *</span>
                <input required disabled={!writesSupported} autoComplete="name" value={draft.submitterName} onChange={(event) => patchDraft({ submitterName: event.target.value })} />
              </label>
              <label>
                <span>Submitter email *</span>
                <input required disabled={!writesSupported} type="email" autoComplete="email" value={draft.submitterEmail} onChange={(event) => patchDraft({ submitterEmail: event.target.value })} />
              </label>
            </div>
            <label>
              <span>Structure requested for review *</span>
              <select required disabled={!writesSupported} value={draft.requestedStructure} onChange={(event) => patchDraft({ requestedStructure: event.target.value })}>
                <option value="">Select a review question</option>
                <option>Direct acquisition</option>
                <option>Assignment</option>
                <option>Double closing</option>
                <option>Attorney-drafted joint venture</option>
                <option>Licensed brokerage arrangement</option>
                <option>Seller financing — specialist review</option>
                <option>Subject-to — specialist review</option>
                <option>Novation — specialist review</option>
                <option>No-deal / resource outcome</option>
              </select>
            </label>
            <label>
              <span>Evidence summary, seller priorities, and open questions *</span>
              <textarea
                required
                disabled={!writesSupported}
                rows={9}
                value={draft.summary}
                onChange={(event) => patchDraft({ summary: event.target.value })}
                placeholder="Summarize verified facts, assumptions, missing evidence, and the specific help requested. Minimize sensitive data."
              />
              <GenerateWithAIButton field="dealDeskSummary" value={draft.summary} onGenerated={(value) => patchDraft({ summary: value })} disabled={!writesSupported} />
            </label>
            <div className="form-safety">
              <span aria-hidden="true">i</span>
              <p>
                Do not paste full proof-of-funds documents, identity documents,
                account numbers, medical details, or unnecessary distress information.
              </p>
            </div>
          </form>

          <aside className="panel desk-checklist">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Submission gate</span>
                <h2>Qualification checklist</h2>
              </div>
              <StatusPill tone={checkCount === qualificationChecks.length ? "good" : "neutral"}>
                {checkCount}/{qualificationChecks.length}
              </StatusPill>
            </div>
            <div className="check-list">
              {qualificationChecks.map((item) => (
                <label className="check-row" key={item}>
                  <input
                    type="checkbox"
                    disabled={!writesSupported}
                    checked={Boolean(draft.qualificationChecks[item])}
                    onChange={(event) =>
                      patchDraft({
                        qualificationChecks: {
                          ...draft.qualificationChecks,
                          [item]: event.target.checked,
                        },
                      })
                    }
                  />
                  <span><strong>{item}</strong></span>
                </label>
              ))}
            </div>
            <label className="consent-card">
              <input
                type="checkbox"
                disabled={!writesSupported}
                checked={draft.consentToReview}
                onChange={(event) => patchDraft({ consentToReview: event.target.checked })}
              />
              <span>
                <strong>I consent to review of the packet I choose to export and share.</strong>
                <small>
                  This local checkbox does not transmit the packet or authorize
                  representation, marketing, signatures, or financial action.
                </small>
              </span>
            </label>
            <button className="button button-primary" type="button" disabled={!ready} onClick={exportPacket}>
              Export review packet
            </button>
            <p className="export-note">
              Initial release: export only. You decide whether and how to share
              the resulting file with an authorized reviewer.
            </p>
          </aside>
        </div>
      )}

      <aside className="deal-desk-disclaimer">
        <span aria-hidden="true">!</span>
        <p>
          Deal Desk submission does not create representation, agency, financing,
          acceptance, compensation, or any promise to acquire, fund, partner on,
          assign, or close a transaction.
        </p>
      </aside>
    </>
  );
}
