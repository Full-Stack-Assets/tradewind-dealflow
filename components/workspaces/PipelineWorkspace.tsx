"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLocalData } from "@/components/LocalDataProvider";
import { AuthorizedCsvImport } from "@/components/pipeline/AuthorizedCsvImport";
import { BuyBoxForm } from "@/components/pipeline/BuyBoxForm";
import { QualificationPanel } from "@/components/pipeline/QualificationPanel";
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
import type { DealFlowData } from "@/lib/types";

export function PipelineWorkspace() {
  const {
    data,
    replaceData,
    clearData,
    storageStatus,
    writesSupported,
  } = useLocalData();
  const [clearOpen, setClearOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DealFlowData | null>(null);
  const [message, setMessage] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);
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

  const readBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = parseImportText(await file.text());
    event.target.value = "";
    if (!result.ok) {
      setMessage(`Backup rejected: ${result.errors.join(" ")}`);
      return;
    }
    setPendingImport(result.data);
    setMessage(
      "Backup validated. Confirm replacement before any browser data changes.",
    );
  };

  const restoreBackup = async () => {
    if (!pendingImport) return;
    const result = await replaceData(pendingImport);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPendingImport(null);
    setMessage("Validated backup restored in this browser.");
  };

  const clearWorkspace = async () => {
    const result = await clearData();
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setClearOpen(false);
    setMessage("Local workspace cleared. This action cannot be undone.");
  };

  return (
    <>
      <WorkspaceHeader
        eyebrow="Fast-track lead engine"
        title="Pipeline"
        description="Import authorized records, apply one narrow buy box, and move only evidence-backed research forward."
      />
      <LocalDataNotice />

      <section className="toolbar panel" aria-label="Pipeline tools">
        <div className="toolbar-copy">
          <StatusPill tone="neutral">{data.deals.length} records</StatusPill>
          <p>
            No telephone, text, email, direct-mail, offer, contract, or public
            marketing action is sent from this workspace.
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
            Export JSON backup
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
            Export property CSV
          </button>
          <button
            className="button button-quiet button-small"
            type="button"
            disabled={!writesSupported}
            onClick={() => backupInputRef.current?.click()}
          >
            Restore JSON backup
          </button>
          <input
            className="visually-hidden"
            ref={backupInputRef}
            type="file"
            disabled={!writesSupported}
            accept="application/json,.json"
            onChange={readBackup}
            aria-label="Restore a Tradewind DealFlow JSON backup"
          />
          {offerWorkspaceClear && (
            <button
              className="button button-danger button-small"
              type="button"
              disabled={!writesSupported}
              onClick={() => setClearOpen(true)}
            >
              Clear local workspace
            </button>
          )}
        </div>
      </section>

      {message && (
        <p className="persistent-message" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <BuyBoxForm key={JSON.stringify(data.buyBox)} />
      <AuthorizedCsvImport />

      <aside className="action-boundary" aria-label="Lead engine safety boundary">
        <strong>A score never authorizes contact.</strong>
        <span>
          Every imported record begins in Research. First contact, offers,
          contracts, buyer selection, public marketing, money, and closing
          instructions stay outside this release or require human approval.
        </span>
      </aside>

      {data.deals.length === 0 ? (
        <section className="panel lead-engine-section" aria-label="Property records">
          <EmptyState
            eyebrow="Authorized records only"
            title="No real property records yet"
          >
            Your pipeline is empty. Select an authorized CSV above, review the
            preview, resolve possible matches, and apply only safe rows. No
            sample properties are included.
          </EmptyState>
        </section>
      ) : (
        <section
          className="lead-engine-section qualification-list"
          aria-labelledby="qualification-results-title"
        >
          <div className="section-heading">
            <div>
              <span className="mini-label">Research records</span>
              <h2 id="qualification-results-title">
                Qualification and provenance
              </h2>
            </div>
            <span className="status-pill neutral">
              {data.deals.length} total
            </span>
          </div>
          {data.deals.map((deal) => (
            <QualificationPanel key={deal.id} deal={deal} />
          ))}
        </section>
      )}

      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace this browser workspace?"
        description="The validated JSON backup will replace every local record and setting. Export the current workspace first if you may need it."
        confirmLabel="Replace workspace"
        cancelLabel="Keep current workspace"
        onCancel={() => {
          setPendingImport(null);
          backupInputRef.current?.focus();
        }}
        onConfirm={() => void restoreBackup()}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear the local workspace?"
        description="All property records, source history, configuration, and other browser-only workspace data will be deleted. Export a backup first if you may need it."
        confirmLabel="Clear workspace"
        cancelLabel="Keep workspace"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void clearWorkspace()}
      />
    </>
  );
}
