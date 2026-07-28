"use client";

import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLocalData } from "@/components/LocalDataProvider";
import {
  EmptyState,
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import { downloadText } from "@/lib/download";
import {
  parseImportText,
  serializeData,
  serializePipelineCsv,
} from "@/lib/import-export";
import { shouldOfferWorkspaceClear } from "@/lib/local-storage";
import {
  PIPELINE_STAGES,
  type DealFlowData,
  type DealRecord,
  type DealStrategy,
  type PipelineStage,
  type RehabLevel,
  type StateCode,
} from "@/lib/types";

type LeadForm = {
  state: "" | StateCode;
  address: string;
  city: string;
  propertyType: string;
  source: string;
  ownerContactStatus: string;
  stage: PipelineStage;
  nextAction: string;
  notes: string;
  askingPrice: string;
  rehabLevel: RehabLevel;
  strategy: DealStrategy;
};

const blankLead: LeadForm = {
  state: "",
  address: "",
  city: "",
  propertyType: "",
  source: "",
  ownerContactStatus: "Not researched",
  stage: "Research",
  nextAction: "",
  notes: "",
  askingPrice: "",
  rehabLevel: "Moderate",
  strategy: "Direct acquisition",
};

export function PipelineWorkspace() {
  const {
    data,
    updateData,
    replaceData,
    clearData,
    storageStatus,
    writesSupported,
  } = useLocalData();
  const [form, setForm] = useState<LeadForm>(blankLead);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DealFlowData | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const hasLocalData =
    data.deals.length > 0 ||
    data.buyers.length > 0 ||
    data.analyses.length > 0 ||
    data.preferences.selectedState !== null ||
    data.preferences.participationPath !== null ||
    Object.values(data.curriculum).some(Boolean) ||
    Object.values(data.weekProgress).some(Boolean) ||
    Object.values(data.readinessChecks).some(Boolean) ||
    Object.values(data.compliance.outreachChecks).some(Boolean) ||
    Object.values(data.compliance.marketingChecks).some(Boolean) ||
    data.dealDeskDraft.dealId !== "" ||
    data.dealDeskDraft.summary !== "";
  const offerWorkspaceClear = shouldOfferWorkspaceClear(
    hasLocalData,
    storageStatus,
  );

  const addLead = async (event: React.FormEvent) => {
    event.preventDefault();
    const askingPrice =
      form.askingPrice.trim() === "" ? null : Number(form.askingPrice);
    if (
      !form.state ||
      !form.address.trim() ||
      !form.city.trim() ||
      !form.propertyType.trim() ||
      !form.source.trim() ||
      (askingPrice !== null && (!Number.isFinite(askingPrice) || askingPrice < 0))
    ) {
      setMessage("Complete every required field with a valid value.");
      return;
    }
    const now = new Date().toISOString();
    const lead: DealRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      state: form.state,
      address: form.address.trim(),
      city: form.city.trim(),
      market: "",
      propertyType: form.propertyType.trim(),
      source: form.source.trim(),
      ownerContactStatus: form.ownerContactStatus,
      stage: form.stage,
      nextAction: form.nextAction.trim(),
      notes: form.notes.trim(),
      askingPrice,
      rehabLevel: form.rehabLevel,
      sourceAssertions: [],
      factConflicts: [],
      researchRestrictions: [],
      strategies: [form.strategy],
      executedAgreement: false,
      equitableInterestRecorded: false,
      legalTitleDisclosureReady: false,
      attorneyReviewComplete: false,
    };
    const result = await updateData((current) => ({
      ...current,
      deals: [lead, ...current.deals],
    }));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setForm(blankLead);
    setShowForm(false);
    setMessage("Property record added locally. No contact was initiated.");
  };

  const removeLead = async () => {
    if (!deleteId) return;
    const result = await updateData((current) => ({
      ...current,
      deals: current.deals.filter((deal) => deal.id !== deleteId),
    }));
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDeleteId(null);
    setMessage("Property record deleted from this browser.");
  };

  const updateStage = (id: string, stage: PipelineStage) => {
    void updateData((current) => ({
      ...current,
      deals: current.deals.map((deal) =>
        deal.id === id
          ? { ...deal, stage, updatedAt: new Date().toISOString() }
          : deal,
      ),
    }));
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = parseImportText(await file.text());
    event.target.value = "";
    if (!result.ok) {
      setMessage(`Import rejected: ${result.errors.join(" ")}`);
      return;
    }
    setPendingImport(result.data);
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Local lead operations"
        title="Pipeline"
        description="Track only real, lawfully sourced property records that you add or import."
        action={
          <button
            className="button button-primary"
            type="button"
            disabled={!writesSupported}
            onClick={() => setShowForm((current) => !current)}
            aria-expanded={showForm}
          >
            {showForm ? "Close form" : "Add property"}
          </button>
        }
      />
      <LocalDataNotice />

      <section className="toolbar panel" aria-label="Pipeline tools">
        <div className="toolbar-copy">
          <StatusPill tone="neutral">{data.deals.length} records</StatusPill>
          <p>
            No telephone, text, email, or direct-mail action is sent from this release.
          </p>
        </div>
        <div className="button-row">
          <button
            className="button button-quiet button-small"
            type="button"
            onClick={() =>
              downloadText(
                "tradewind-dealflow-backup.json",
                serializeData(data),
                "application/json;charset=utf-8",
              )
            }
          >
            Export JSON
          </button>
          <button
            className="button button-quiet button-small"
            type="button"
            disabled={data.deals.length === 0}
            onClick={() =>
              downloadText(
                "tradewind-pipeline.csv",
                serializePipelineCsv(data.deals),
                "text/csv;charset=utf-8",
              )
            }
          >
            Export CSV
          </button>
          <button
            className="button button-quiet button-small"
            type="button"
            disabled={!writesSupported}
            onClick={() => fileRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            className="visually-hidden"
            ref={fileRef}
            type="file"
            disabled={!writesSupported}
            accept="application/json,.json"
            onChange={importFile}
            aria-label="Import a Tradewind DealFlow JSON backup"
          />
        </div>
      </section>

      {showForm && (
        <form className="panel record-form" onSubmit={addLead}>
          <div className="panel-heading">
            <div>
              <span className="mini-label">New user-entered record</span>
              <h2>Property intake</h2>
            </div>
            <span className="required-note">* Required</span>
          </div>
          <div className="form-grid three">
            <label>
              <span>State *</span>
              <select
                required
                value={form.state}
                onChange={(event) =>
                  setForm({ ...form, state: event.target.value as "" | StateCode })
                }
              >
                <option value="">Select</option>
                <option value="MA">Massachusetts</option>
                <option value="RI">Rhode Island</option>
              </select>
            </label>
            <label className="span-two">
              <span>Property address *</span>
              <input
                required
                autoComplete="street-address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="Enter a real address"
              />
            </label>
            <label>
              <span>City / town *</span>
              <input
                required
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </label>
            <label>
              <span>Property type *</span>
              <input
                required
                value={form.propertyType}
                onChange={(event) =>
                  setForm({ ...form, propertyType: event.target.value })
                }
                placeholder="e.g., Two-family"
              />
            </label>
            <label>
              <span>Source *</span>
              <input
                required
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
                placeholder="Authorized source or direct submission"
              />
            </label>
            <label>
              <span>Owner contact status</span>
              <select
                value={form.ownerContactStatus}
                onChange={(event) =>
                  setForm({ ...form, ownerContactStatus: event.target.value })
                }
              >
                <option>Not researched</option>
                <option>Contact data unverified</option>
                <option>Contact data verified</option>
                <option>Do not contact</option>
              </select>
            </label>
            <label>
              <span>Stage</span>
              <select
                value={form.stage}
                onChange={(event) =>
                  setForm({ ...form, stage: event.target.value as PipelineStage })
                }
              >
                {PIPELINE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
            </label>
            <label>
              <span>Asking price <small>optional</small></span>
              <input
                type="number"
                min="0"
                step="100"
                inputMode="decimal"
                value={form.askingPrice}
                onChange={(event) =>
                  setForm({ ...form, askingPrice: event.target.value })
                }
              />
            </label>
            <label>
              <span>Repair level</span>
              <select
                value={form.rehabLevel}
                onChange={(event) =>
                  setForm({ ...form, rehabLevel: event.target.value as RehabLevel })
                }
              >
                <option>Light</option>
                <option>Moderate</option>
                <option>Heavy</option>
              </select>
            </label>
            <label>
              <span>Working strategy</span>
              <select
                value={form.strategy}
                onChange={(event) =>
                  setForm({ ...form, strategy: event.target.value as DealStrategy })
                }
              >
                <option>Direct acquisition</option>
                <option>Assignment</option>
                <option>Double closing</option>
                <option>Wholetail</option>
                <option>Novation</option>
                <option>Seller financing</option>
                <option>Subject-to</option>
                <option>Buy-and-hold</option>
                <option>Rehab/resale</option>
                <option>Listing/referral</option>
                <option>No-deal/resource</option>
              </select>
            </label>
            <label className="span-two">
              <span>Next action</span>
              <input
                value={form.nextAction}
                onChange={(event) =>
                  setForm({ ...form, nextAction: event.target.value })
                }
                placeholder="A specific research or review action"
              />
            </label>
            <label className="span-three">
              <span>Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Avoid unnecessary sensitive seller information"
              />
            </label>
          </div>
          <div className="form-safety">
            <span aria-hidden="true">i</span>
            <p>
              Adding a record does not establish contact eligibility, consent,
              ownership, value, motivation, or legal authority to market.
            </p>
          </div>
          <div className="button-row">
            <button className="button button-primary" type="submit" disabled={!writesSupported}>Add local record</button>
            <button className="button button-quiet" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {message && <p className="form-message" role="status">{message}</p>}

      {data.deals.length === 0 ? (
        <section className="panel">
          <EmptyState
            title="Your pipeline is empty"
            action={
              <button className="button button-primary button-small" type="button" onClick={() => setShowForm(true)}>
                Add a real property record
              </button>
            }
          >
            No sample properties are inserted. Start with a direct submission,
            authorized CSV/JSON record, or a public-record lead you have verified.
          </EmptyState>
        </section>
      ) : (
        <section className="record-table-wrap panel" aria-labelledby="pipeline-table-title">
          <div className="panel-heading">
            <div>
              <span className="mini-label">User-entered records</span>
              <h2 id="pipeline-table-title">Active pipeline</h2>
            </div>
          </div>
          <div className="record-table-scroll">
            <table className="record-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Next action</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>
                      <strong>{deal.address}</strong>
                      <small>{deal.city}, {deal.state} · {deal.propertyType}</small>
                    </td>
                    <td>
                      <span>{deal.source}</span>
                      <small>{deal.ownerContactStatus}</small>
                    </td>
                    <td>
                      <select
                        aria-label={`Stage for ${deal.address}`}
                        disabled={!writesSupported}
                        value={deal.stage}
                        onChange={(event) => updateStage(deal.id, event.target.value as PipelineStage)}
                      >
                        {PIPELINE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
                      </select>
                    </td>
                    <td>{deal.nextAction || <span className="muted-copy">None recorded</span>}</td>
                    <td>
                      <button className="icon-button" type="button" disabled={!writesSupported} onClick={() => setDeleteId(deal.id)} aria-label={`Delete ${deal.address}`}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {offerWorkspaceClear && (
        <div className="danger-zone">
          <div>
            <strong>Reset local workspace</strong>
            <p>Export a backup first. This removes all local records and progress.</p>
          </div>
          <button className="button button-danger-outline button-small" type="button" disabled={!writesSupported} onClick={() => setClearOpen(true)}>
            Clear all local data
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this property record?"
        description="This removes the record from this browser. It cannot be recovered unless it exists in an exported backup."
        onCancel={() => setDeleteId(null)}
        onConfirm={removeLead}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear the entire local workspace?"
        description="All properties, buyers, analyses, learning progress, compliance checks, and Deal Desk drafts will be removed from this browser."
        confirmLabel="Clear all data"
        cancelLabel="Cancel"
        onCancel={() => setClearOpen(false)}
        onConfirm={async () => {
          const result = await clearData();
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          setClearOpen(false);
          setMessage("The local workspace was cleared.");
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Replace current data with this backup?"
        description="The file passed schema validation. Importing will replace the current browser data; export a backup first if needed."
        confirmLabel="Import and replace"
        cancelLabel="Keep current data"
        onCancel={() => setPendingImport(null)}
        onConfirm={async () => {
          if (!pendingImport) return;
          const result = await replaceData(pendingImport);
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          setPendingImport(null);
          setMessage("Validated backup imported successfully.");
        }}
      />
    </>
  );
}
