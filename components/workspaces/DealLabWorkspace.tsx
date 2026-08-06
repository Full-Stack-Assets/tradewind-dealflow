"use client";

import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GenerateWithAIButton } from "@/components/ai/GenerateWithAIButton";
import { useLocalData } from "@/components/LocalDataProvider";
import {
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import {
  buildExitComparisons,
  calculateHeuristic,
  calculateMao,
  formatMoney,
  parseMoney,
} from "@/lib/calculations";
import { downloadText } from "@/lib/download";
import type { DealAnalysis, StateCode } from "@/lib/types";

type FormState = {
  dealId: string;
  propertyLabel: string;
  state: "" | StateCode;
  arv: string;
  repairs: string;
  holdingClosingCosts: string;
  buyerProfit: string;
  wholesaleFee: string;
  targetPrice: string;
  heuristicPercent: string;
  compEvidence: string;
  repairEvidence: string;
  riskNotes: string;
};

const blankForm: FormState = {
  dealId: "",
  propertyLabel: "",
  state: "",
  arv: "",
  repairs: "",
  holdingClosingCosts: "",
  buyerProfit: "",
  wholesaleFee: "",
  targetPrice: "",
  heuristicPercent: "70",
  compEvidence: "",
  repairEvidence: "",
  riskNotes: "",
};

function safeNumber(value: string) {
  return parseMoney(value) ?? Number.NaN;
}

export function DealLabWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const [form, setForm] = useState<FormState>(blankForm);
  const [message, setMessage] = useState("");
  const [deleteAnalysisId, setDeleteAnalysisId] = useState<string | null>(null);

  const inputs = useMemo(
    () => ({
      arv: safeNumber(form.arv),
      repairs: safeNumber(form.repairs),
      holdingClosingCosts: safeNumber(form.holdingClosingCosts),
      buyerProfit: safeNumber(form.buyerProfit),
      wholesaleFee: safeNumber(form.wholesaleFee),
    }),
    [
      form.arv,
      form.buyerProfit,
      form.holdingClosingCosts,
      form.repairs,
      form.wholesaleFee,
    ],
  );
  const mao = calculateMao(inputs);
  const heuristic = calculateHeuristic(
    safeNumber(form.arv),
    safeNumber(form.repairs),
    Number(form.heuristicPercent),
  );
  const exits = buildExitComparisons(inputs, safeNumber(form.targetPrice));
  const evidenceReady =
    form.state !== "" &&
    form.propertyLabel.trim() !== "" &&
    form.compEvidence.trim() !== "" &&
    form.repairEvidence.trim() !== "" &&
    mao.ok;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectDeal = (dealId: string) => {
    const deal = data.deals.find((candidate) => candidate.id === dealId);
    setForm((current) => ({
      ...current,
      dealId,
      propertyLabel: deal ? `${deal.address}, ${deal.city}` : "",
      state: deal?.state ?? "",
      targetPrice: deal?.askingPrice === null ? "" : String(deal?.askingPrice ?? ""),
    }));
  };

  const saveAnalysis = async () => {
    if (!mao.ok || !heuristic.ok || !evidenceReady) {
      setMessage("Complete the required evidence and valid cost inputs before saving.");
      return;
    }
    const now = new Date().toISOString();
    const analysis: DealAnalysis = {
      id: crypto.randomUUID(),
      dealId: form.dealId || null,
      propertyLabel: form.propertyLabel.trim(),
      state: form.state || null,
      createdAt: now,
      updatedAt: now,
      arv: inputs.arv,
      repairs: inputs.repairs,
      holdingClosingCosts: inputs.holdingClosingCosts,
      buyerProfit: inputs.buyerProfit,
      wholesaleFee: inputs.wholesaleFee,
      mao: mao.value,
      targetPrice: parseMoney(form.targetPrice),
      heuristicPercent: Number(form.heuristicPercent),
      heuristicValue: heuristic.value,
      compEvidence: form.compEvidence.trim(),
      repairEvidence: form.repairEvidence.trim(),
      riskNotes: form.riskNotes.trim(),
    };
    const result = await updateData((current) => ({
      ...current,
      analyses: [analysis, ...current.analyses],
    }));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("Analysis saved locally. No offer was created or sent.");
  };

  const exportSummary = () => {
    if (!mao.ok) {
      setMessage("Enter valid inputs before exporting an analysis.");
      return;
    }
    const summary = [
      "TRADEWIND DEALFLOW — EDUCATIONAL ANALYSIS SUMMARY",
      `Generated: ${new Date().toISOString()}`,
      `Property label: ${form.propertyLabel || "Not recorded"}`,
      `State: ${form.state || "Not selected"}`,
      "",
      "PRIMARY MAXIMUM ALLOWABLE OFFER CALCULATION",
      "MAO = ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee",
      `${mao.expression} = ${formatMoney(mao.value)}`,
      "",
      `Comparable evidence: ${form.compEvidence || "Not recorded"}`,
      `Repair evidence: ${form.repairEvidence || "Not recorded"}`,
      `Risk notes: ${form.riskNotes || "None recorded"}`,
      "",
      "This summary uses operator-entered assumptions. It is not an appraisal,",
      "offer, contract, legal opinion, or evidence of a buyer or closing outcome.",
    ].join("\n");
    downloadText("tradewind-deal-analysis.txt", summary);
    setMessage("Analysis summary exported to your device.");
  };

  const loadAnalysis = (analysis: DealAnalysis) => {
    setForm({
      dealId: analysis.dealId ?? "",
      propertyLabel: analysis.propertyLabel,
      state: analysis.state ?? "",
      arv: String(analysis.arv),
      repairs: String(analysis.repairs),
      holdingClosingCosts: String(analysis.holdingClosingCosts),
      buyerProfit: String(analysis.buyerProfit),
      wholesaleFee: String(analysis.wholesaleFee),
      targetPrice:
        analysis.targetPrice === null ? "" : String(analysis.targetPrice),
      heuristicPercent: String(analysis.heuristicPercent),
      compEvidence: analysis.compEvidence,
      repairEvidence: analysis.repairEvidence,
      riskNotes: analysis.riskNotes,
    });
    setMessage("Saved analysis loaded for review. Saving again creates a new record.");
    window.scrollTo({ top: 0 });
  };

  const removeAnalysis = async () => {
    if (!deleteAnalysisId) return;
    const result = await updateData((current) => ({
      ...current,
      analyses: current.analyses.filter(
        (analysis) => analysis.id !== deleteAnalysisId,
      ),
    }));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDeleteAnalysisId(null);
    setMessage("Saved analysis deleted from this browser.");
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Underwriting"
        title="Deal Lab"
        description="Build a transparent acquisition range from your own evidence—without false precision."
        action={
          <button className="button button-outline" type="button" onClick={() => window.print()}>
            Print view
          </button>
        }
      />
      <LocalDataNotice />

      <div className="lab-layout">
        <form className="panel lab-form" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <div>
              <span className="mini-label">Analysis inputs</span>
              <h2>Property and evidence</h2>
            </div>
            <StatusPill tone={evidenceReady ? "good" : "warning"}>
              {evidenceReady ? "Evidence gate ready" : "Inputs incomplete"}
            </StatusPill>
          </div>

          <div className="form-grid two">
            <label>
              <span>Link a pipeline record <small>optional</small></span>
              <select value={form.dealId} onChange={(event) => selectDeal(event.target.value)}>
                <option value="">No linked record</option>
                {data.deals.map((deal) => (
                  <option value={deal.id} key={deal.id}>
                    {deal.address}, {deal.city} · {deal.state}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>State</span>
              <select
                required
                value={form.state}
                onChange={(event) => setField("state", event.target.value as "" | StateCode)}
              >
                <option value="">Select a state</option>
                <option value="MA">Massachusetts</option>
                <option value="RI">Rhode Island</option>
              </select>
            </label>
          </div>
          <label>
            <span>Property label or address</span>
            <input
              required
              value={form.propertyLabel}
              onChange={(event) => setField("propertyLabel", event.target.value)}
              placeholder="Enter your real property record"
            />
          </label>

          <div className="input-section">
            <h3>Value and cost assumptions</h3>
            <p>Use evidence-backed ranges in your notes. This calculation uses the specific point inputs below.</p>
            <div className="form-grid two">
              <MoneyField label="After-repair value (ARV)" value={form.arv} onChange={(value) => setField("arv", value)} />
              <MoneyField label="Repair estimate" value={form.repairs} onChange={(value) => setField("repairs", value)} />
              <MoneyField label="Holding / closing costs" value={form.holdingClosingCosts} onChange={(value) => setField("holdingClosingCosts", value)} />
              <MoneyField label="Buyer profit requirement" value={form.buyerProfit} onChange={(value) => setField("buyerProfit", value)} />
              <MoneyField label="Wholesale / transaction fee" value={form.wholesaleFee} onChange={(value) => setField("wholesaleFee", value)} />
              <MoneyField label="Proposed purchase price" optional value={form.targetPrice} onChange={(value) => setField("targetPrice", value)} />
            </div>
          </div>

          <div className="form-grid two">
            <label>
              <span>Comparable evidence and selection reasons</span>
              <textarea
                required
                rows={4}
                value={form.compEvidence}
                onChange={(event) => setField("compEvidence", event.target.value)}
                placeholder="Record real comparable sources, dates, and why they are relevant"
              />
              <GenerateWithAIButton field="compEvidence" value={form.compEvidence} onGenerated={(value) => setField("compEvidence", value)} />
            </label>
            <label>
              <span>Repair evidence and range basis</span>
              <textarea
                required
                rows={4}
                value={form.repairEvidence}
                onChange={(event) => setField("repairEvidence", event.target.value)}
                placeholder="Record walkthrough, contractor, scope, or other basis"
              />
              <GenerateWithAIButton field="repairEvidence" value={form.repairEvidence} onGenerated={(value) => setField("repairEvidence", value)} />
            </label>
          </div>
          <label>
            <span>Risks, missing data, and seller priorities</span>
            <textarea
              rows={4}
              value={form.riskNotes}
              onChange={(event) => setField("riskNotes", event.target.value)}
              placeholder="Name what could change the conclusion"
            />
            <GenerateWithAIButton field="riskNotes" value={form.riskNotes} onGenerated={(value) => setField("riskNotes", value)} />
          </label>
        </form>

        <aside className="lab-results">
          <section className="result-card primary-result" aria-live="polite">
            <span className="mini-label light">Primary calculation</span>
            <h2>Maximum allowable offer</h2>
            <strong className="result-number">
              {mao.ok ? formatMoney(mao.value) : "—"}
            </strong>
            <p className="formula">
              ARV - Repairs - Holding/Closing Costs - Buyer Profit - Wholesale Fee
            </p>
            {mao.ok ? (
              <code>{mao.expression}</code>
            ) : (
              <ul className="error-list">
                {mao.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
            <p className="result-disclaimer">
              An input-based decision aid—not an appraisal, offer, or promise of
              seller net, buyer profit, fee, or closing.
            </p>
          </section>

          <section className="result-card">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Secondary comparison</span>
                <h2>Percentage heuristic</h2>
              </div>
              <label className="compact-field">
                <span>Percent</span>
                <input
                  aria-label="Heuristic percentage"
                  type="number"
                  min="1"
                  max="100"
                  value={form.heuristicPercent}
                  onChange={(event) => setField("heuristicPercent", event.target.value)}
                />
              </label>
            </div>
            <strong className="secondary-number">
              {heuristic.ok ? formatMoney(heuristic.value) : "—"}
            </strong>
            <p>{heuristic.ok ? heuristic.label : "Enter valid ARV and repair inputs."}</p>
            <div className="warning-note">
              {heuristic.ok
                ? heuristic.warning
                : "The secondary estimate stays unavailable until its inputs are valid."}
            </div>
          </section>

          <section className="result-card">
            <span className="mini-label">Multiple-exit view</span>
            <h2>Compare, don’t prescribe</h2>
            {exits.length > 0 ? (
              <div className="exit-list">
                {exits.map((exit) => (
                  <article key={exit.name}>
                    <div>
                      <strong>{exit.name}</strong>
                      <span>{formatMoney(exit.amount)}</span>
                    </div>
                    <p>{exit.explanation}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted-copy">
                Enter a proposed purchase price and complete every cost input to
                compare exits.
              </p>
            )}
          </section>

          <section className={evidenceReady ? "readiness-gate ready" : "readiness-gate"}>
            <span aria-hidden="true">{evidenceReady ? "✓" : "!"}</span>
            <div>
              <strong>
                {evidenceReady ? "Analysis can be saved" : "Deal-readiness gate"}
              </strong>
              <p>
                {evidenceReady
                  ? "Core inputs and evidence notes are present. Legal and offer approvals remain separate."
                  : "Add a state, property label, valid inputs, comparable reasons, and repair evidence."}
              </p>
            </div>
          </section>

          <div className="stack-actions">
            <button className="button button-primary" type="button" disabled={!writesSupported} onClick={saveAnalysis}>
              Save analysis locally
            </button>
            <button className="button button-quiet" type="button" onClick={exportSummary}>
              Export summary
            </button>
          </div>
          {message && <p className="form-message" role="status">{message}</p>}
        </aside>
      </div>

      {data.analyses.length > 0 && (
        <section className="panel saved-analyses" aria-labelledby="saved-analyses-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">Local analysis history</span>
              <h2 id="saved-analyses-title">Saved evidence and assumptions</h2>
            </div>
            <StatusPill tone="neutral">{data.analyses.length} saved</StatusPill>
          </div>
          <div className="saved-analysis-list">
            {data.analyses.map((analysis) => (
              <article key={analysis.id}>
                <div className="saved-analysis-heading">
                  <div>
                    <span className="mini-label">
                      {analysis.state ?? "State not recorded"} ·{" "}
                      {new Date(analysis.updatedAt).toLocaleDateString()}
                    </span>
                    <h3>{analysis.propertyLabel}</h3>
                  </div>
                  <strong>{formatMoney(analysis.mao)} MAO</strong>
                </div>
                <dl>
                  <div>
                    <dt>Comparable evidence</dt>
                    <dd>{analysis.compEvidence}</dd>
                  </div>
                  <div>
                    <dt>Repair evidence</dt>
                    <dd>{analysis.repairEvidence}</dd>
                  </div>
                  <div>
                    <dt>Risks / missing data</dt>
                    <dd>{analysis.riskNotes || "None recorded"}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <button
                    className="button button-quiet button-small"
                    type="button"
                    onClick={() => loadAnalysis(analysis)}
                  >
                    Load for review
                  </button>
                  <button
                    className="button button-danger button-small"
                    type="button"
                    disabled={!writesSupported}
                    onClick={() => setDeleteAnalysisId(analysis.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(deleteAnalysisId)}
        title="Delete this saved analysis?"
        description="The stored inputs, evidence notes, and risk notes will be removed from this browser. This cannot delete any exported copies."
        confirmLabel="Delete analysis"
        onCancel={() => setDeleteAnalysisId(null)}
        onConfirm={removeAnalysis}
      />
    </>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label>
      <span>
        {label} {optional && <small>optional</small>}
      </span>
      <span className="money-input">
        <i aria-hidden="true">$</i>
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="100"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          required={!optional}
        />
      </span>
    </label>
  );
}
