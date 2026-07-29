"use client";

import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLocalData } from "@/components/LocalDataProvider";
import {
  EmptyState,
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import { matchBuyer } from "@/lib/matching";
import type {
  BuyerRecord,
  DealStrategy,
  ProofOfFundsStatus,
  RehabLevel,
  StateCode,
} from "@/lib/types";

type BuyerForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  states: StateCode[];
  markets: string;
  propertyTypes: string;
  minPrice: string;
  maxPrice: string;
  rehabTolerance: RehabLevel[];
  strategies: DealStrategy[];
  proofOfFundsStatus: ProofOfFundsStatus;
  proofOfFundsExpiresAt: string;
  lastVerifiedAt: string;
};

const blankBuyer: BuyerForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  states: [],
  markets: "",
  propertyTypes: "",
  minPrice: "",
  maxPrice: "",
  rehabTolerance: [],
  strategies: [],
  proofOfFundsStatus: "Not provided",
  proofOfFundsExpiresAt: "",
  lastVerifiedAt: "",
};

const strategies: DealStrategy[] = [
  "Direct acquisition",
  "Assignment",
  "Double closing",
  "Wholetail",
  "Buy-and-hold",
  "Rehab/resale",
];

export function BuyersWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const [form, setForm] = useState<BuyerForm>(blankBuyer);
  const [showForm, setShowForm] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const selectedDeal = data.deals.find((deal) => deal.id === selectedDealId);

  const matches = useMemo(() => {
    if (!selectedDeal) return [];
    const today = new Date().toISOString().slice(0, 10);
    return data.buyers
      .map((buyer) => ({ buyer, ...matchBuyer(selectedDeal, buyer, today) }))
      .sort((left, right) => right.score - left.score);
  }, [data.buyers, selectedDeal]);

  const toggleArray = <T extends string>(
    key: "states" | "rehabTolerance" | "strategies",
    value: T,
  ) => {
    setForm((current) => {
      const values = current[key] as string[];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((candidate) => candidate !== value)
          : [...values, value],
      };
    });
  };

  const addBuyer = async (event: React.FormEvent) => {
    event.preventDefault();
    const minPrice = form.minPrice === "" ? null : Number(form.minPrice);
    const maxPrice = form.maxPrice === "" ? null : Number(form.maxPrice);
    if (
      !form.name.trim() ||
      form.states.length === 0 ||
      !form.markets.trim() ||
      !form.propertyTypes.trim() ||
      minPrice === null ||
      maxPrice === null ||
      !Number.isFinite(minPrice) ||
      !Number.isFinite(maxPrice) ||
      minPrice < 0 ||
      maxPrice < minPrice ||
      form.rehabTolerance.length === 0 ||
      form.strategies.length === 0
    ) {
      setMessage("Complete the required buy-box fields and enter a valid price range.");
      return;
    }
    const now = new Date().toISOString();
    const buyer: BuyerRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      states: form.states,
      markets: form.markets.split(",").map((value) => value.trim()).filter(Boolean),
      propertyTypes: form.propertyTypes.split(",").map((value) => value.trim()).filter(Boolean),
      minPrice,
      maxPrice,
      rehabTolerance: form.rehabTolerance,
      strategies: form.strategies,
      proofOfFundsStatus: form.proofOfFundsStatus,
      proofOfFundsExpiresAt: form.proofOfFundsExpiresAt,
      lastVerifiedAt: form.lastVerifiedAt,
    };
    const result = await updateData((current) => ({
      ...current,
      buyers: [buyer, ...current.buyers],
    }));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setForm(blankBuyer);
    setShowForm(false);
    setMessage("Buyer profile added locally. No buyer was contacted.");
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Verified relationships"
        title="Buyer workspace"
        description="Build a real buyer CRM and compare recorded criteria—never an invented buyer list."
        action={
          <button
            className="button button-primary"
            type="button"
            disabled={!writesSupported}
            aria-expanded={showForm}
            onClick={() => setShowForm((current) => !current)}
          >
            {showForm ? "Close form" : "Add buyer"}
          </button>
        }
      />
      <LocalDataNotice />

      <aside className="sensitive-notice">
        <span aria-hidden="true">⌁</span>
        <div>
          <strong>Minimize sensitive buyer data.</strong>
          <p>
            Record proof-of-funds status and expiration only. This local release
            does not accept identity documents, statements, or file uploads.
          </p>
        </div>
      </aside>

      {showForm && (
        <form className="panel record-form" onSubmit={addBuyer}>
          <div className="panel-heading">
            <div>
              <span className="mini-label">Real relationship record</span>
              <h2>Buyer profile and buy box</h2>
            </div>
            <span className="required-note">* Required</span>
          </div>
          <div className="form-grid three">
            <label>
              <span>Buyer or contact name *</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              <span>Company</span>
              <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </label>
            <label>
              <span>Email</span>
              <input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>
              <span>Phone</span>
              <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            <label>
              <span>Markets * <small>comma separated</small></span>
              <input required value={form.markets} onChange={(event) => setForm({ ...form, markets: event.target.value })} placeholder="Cities or counties actually stated" />
            </label>
            <label>
              <span>Property types * <small>comma separated</small></span>
              <input required value={form.propertyTypes} onChange={(event) => setForm({ ...form, propertyTypes: event.target.value })} />
            </label>
            <label>
              <span>Minimum price *</span>
              <input required type="number" min="0" inputMode="decimal" value={form.minPrice} onChange={(event) => setForm({ ...form, minPrice: event.target.value })} />
            </label>
            <label>
              <span>Maximum price *</span>
              <input required type="number" min="0" inputMode="decimal" value={form.maxPrice} onChange={(event) => setForm({ ...form, maxPrice: event.target.value })} />
            </label>
            <label>
              <span>POF status</span>
              <select value={form.proofOfFundsStatus} onChange={(event) => setForm({ ...form, proofOfFundsStatus: event.target.value as ProofOfFundsStatus })}>
                <option>Not provided</option>
                <option>Pending review</option>
                <option>Verified</option>
                <option>Expired</option>
              </select>
            </label>
            <label>
              <span>POF expiration</span>
              <input type="date" value={form.proofOfFundsExpiresAt} onChange={(event) => setForm({ ...form, proofOfFundsExpiresAt: event.target.value })} />
            </label>
            <label>
              <span>Last verified date</span>
              <input type="date" value={form.lastVerifiedAt} onChange={(event) => setForm({ ...form, lastVerifiedAt: event.target.value })} />
            </label>
          </div>

          <fieldset className="option-fieldset">
            <legend>States *</legend>
            <div className="chip-options">
              {(["MA", "RI"] as StateCode[]).map((state) => (
                <label key={state}>
                  <input type="checkbox" checked={form.states.includes(state)} onChange={() => toggleArray("states", state)} />
                  <span>{state === "MA" ? "Massachusetts" : "Rhode Island"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset">
            <legend>Rehab tolerance *</legend>
            <div className="chip-options">
              {(["Light", "Moderate", "Heavy"] as RehabLevel[]).map((level) => (
                <label key={level}>
                  <input type="checkbox" checked={form.rehabTolerance.includes(level)} onChange={() => toggleArray("rehabTolerance", level)} />
                  <span>{level}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="option-fieldset">
            <legend>Accepted strategies *</legend>
            <div className="chip-options">
              {strategies.map((strategy) => (
                <label key={strategy}>
                  <input type="checkbox" checked={form.strategies.includes(strategy)} onChange={() => toggleArray("strategies", strategy)} />
                  <span>{strategy}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="button-row">
            <button className="button button-primary" type="submit" disabled={!writesSupported}>Save buyer locally</button>
            <button className="button button-quiet" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {message && <p className="form-message" role="status">{message}</p>}

      <section className="panel matching-panel" aria-labelledby="matching-title">
        <div className="panel-heading">
          <div>
            <span className="mini-label">Explainable matching</span>
            <h2 id="matching-title">Compare a selected deal</h2>
          </div>
          <StatusPill tone={selectedDeal ? "good" : "neutral"}>
            {selectedDeal ? `${matches.length} scored` : "No deal selected"}
          </StatusPill>
        </div>
        <label className="match-selector">
          <span>Pipeline property</span>
          <select value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)}>
            <option value="">Select one of your property records</option>
            {data.deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.address}, {deal.city} · {deal.state}
              </option>
            ))}
          </select>
        </label>
        {selectedDeal && data.buyers.length > 0 ? (
          <div className="match-list">
            {matches.map(({ buyer, score, reasons, conflicts }, index) => (
              <article className="match-card" key={buyer.id}>
                <div className="match-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="match-identity">
                  <strong>{buyer.name}</strong>
                  <span>{buyer.company || "No company recorded"}</span>
                  <StatusPill tone={buyer.proofOfFundsStatus === "Verified" ? "good" : "warning"}>
                    POF · {buyer.proofOfFundsStatus}
                  </StatusPill>
                </div>
                <div className="match-score">
                  <strong>{score}</strong><span>/100</span>
                </div>
                <div className="match-evidence">
                  <details>
                    <summary>Why this score</summary>
                    <div className="evidence-columns">
                      <div>
                        <strong>Matches</strong>
                        <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                      </div>
                      <div>
                        <strong>Conflicts or gaps</strong>
                        {conflicts.length > 0 ? <ul>{conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul> : <p>None from the recorded criteria.</p>}
                      </div>
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            {data.deals.length === 0
              ? "Add a real property record in Pipeline before matching."
              : data.buyers.length === 0
                ? "Add and verify a real buyer profile before matching."
                : "Select a property to calculate transparent buyer scores."}
          </p>
        )}
      </section>

      {data.buyers.length === 0 ? (
        <section className="panel">
          <EmptyState title="No buyer profiles yet" action={<button className="button button-primary button-small" type="button" onClick={() => setShowForm(true)}>Add a real buyer</button>}>
            Buyer records must come from a submission, authorized CRM import, lawful source,
            or verified relationship. The production workspace never invents them.
          </EmptyState>
        </section>
      ) : (
        <section className="buyer-grid" aria-label="Buyer profiles">
          {data.buyers.map((buyer) => (
            <article className="buyer-card" key={buyer.id}>
              <div className="buyer-card-top">
                <span className="buyer-initial" aria-hidden="true">{buyer.name.slice(0, 1).toUpperCase()}</span>
                <button className="icon-button" type="button" disabled={!writesSupported} onClick={() => setDeleteId(buyer.id)} aria-label={`Delete ${buyer.name}`}>×</button>
              </div>
              <h2>{buyer.name}</h2>
              <p>{buyer.company || "No company recorded"}</p>
              <dl>
                <div><dt>Markets</dt><dd>{buyer.markets.join(", ")}</dd></div>
                <div><dt>Price range</dt><dd>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(buyer.minPrice ?? 0)}–{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(buyer.maxPrice ?? 0)}</dd></div>
                <div><dt>Verified</dt><dd>{buyer.lastVerifiedAt || "Not recorded"}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this buyer profile?"
        description="This removes the buyer and recorded criteria from this browser. Export a backup if the relationship record must be retained."
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          const result = await updateData((current) => ({
            ...current,
            buyers: current.buyers.filter((buyer) => buyer.id !== deleteId),
          }));
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          setDeleteId(null);
          setMessage("Buyer profile deleted from this browser.");
        }}
      />
    </>
  );
}
