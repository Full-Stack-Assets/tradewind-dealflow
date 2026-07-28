"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  decodeCsvFile,
  parseCsv,
} from "@/lib/csv";
import { downloadText } from "@/lib/download";
import {
  applyLeadImportPlan,
  attachPossibleDuplicate,
  holdPossibleDuplicate,
  planLeadImport,
  validateLeadCsv,
  type LeadImportCandidate,
  type LeadImportPlan,
} from "@/lib/lead-ingestion";
import type {
  DealFlowData,
  DealRecord,
  PropertyFactSnapshot,
} from "@/lib/types";

type ImportPreview = {
  id: number;
  fileName: string;
  plan: LeadImportPlan | null;
  errors: string[];
};

const LAUNCH_TEMPLATE_HEADERS = [
  "source",
  "source_record_id",
  "retrieved_date",
  "usage_rights",
  "property_address",
  "city",
  "state",
  "zip",
  "verification_date",
  "market",
  "confidence",
  "property_type",
  "asking_price",
  "rehab_level",
  "owner_contact_status",
  "next_action",
  "notes",
] as const;

const FACT_FIELDS: Array<keyof PropertyFactSnapshot> = [
  "state",
  "address",
  "city",
  "zip",
  "market",
  "propertyType",
  "askingPrice",
  "rehabLevel",
  "ownerContactStatus",
  "nextAction",
  "notes",
];

export function AuthorizedCsvImport() {
  const {
    data,
    updateData,
    writesSupported,
    storageStatus,
  } = useLocalData();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const previewSequence = useRef(0);

  const safeCount = preview?.plan ? countSafeRows(preview.plan) : 0;
  const stale =
    preview?.plan !== null &&
    preview?.plan !== undefined &&
    preview.plan.baseRevision !== data.revision;
  const unresolved = preview?.plan?.possibleDuplicates.length ?? 0;
  const applyDisabled =
    preview?.plan === null ||
    preview?.plan === undefined ||
    safeCount === 0 ||
    unresolved > 0 ||
    stale ||
    !writesSupported ||
    storageStatus === "corrupt";

  const conflictPreviews = preview?.plan
    ? plannedConflictPreviews(data, preview.plan)
    : [];
  const restrictedCount = preview?.plan
    ? countRestrictedRows(preview.plan)
    : 0;

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    previewSequence.current += 1;
    const id = previewSequence.current;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = decodeCsvFile(bytes);
      const parsed = parseCsv(text);
      if (!parsed.ok) {
        setPreview({
          id,
          fileName: file.name,
          plan: null,
          errors: parsed.errors,
        });
        requestAnimationFrame(() => previewHeadingRef.current?.focus());
        setMessage("The selected file was rejected before planning.");
        return;
      }
      const validation = validateLeadCsv(parsed.rows, new Date());
      const plan =
        validation.candidates.length > 0
          ? planLeadImport(data, validation.candidates)
          : null;
      setPreview({
        id,
        fileName: file.name,
        plan,
        errors: validation.errors,
      });
      requestAnimationFrame(() => previewHeadingRef.current?.focus());
      setMessage(
        plan === null
          ? "No valid rows are available to plan."
          : "Preview ready. Review every category before applying safe records.",
      );
    } catch (error) {
      setPreview({
        id,
        fileName: file.name,
        plan: null,
        errors: [
          error instanceof Error
            ? error.message
            : "The selected file could not be read safely.",
        ],
      });
      requestAnimationFrame(() => previewHeadingRef.current?.focus());
      setMessage("The selected file was rejected before planning.");
    }
  };

  const attach = (rowNumber: number, deal: DealRecord) => {
    if (!preview?.plan) return;
    const confirmed = window.confirm(
      `Attach CSV row ${rowNumber} to the existing record at ${deal.address}? The source snapshot and any conflicting facts will remain visible.`,
    );
    if (!confirmed) return;
    try {
      setPreview({
        ...preview,
        plan: attachPossibleDuplicate(preview.plan, rowNumber, deal.id),
      });
      setMessage(`Row ${rowNumber} will attach to the selected property.`);
    } catch (error) {
      setMessage(safeError(error));
    }
  };

  const hold = (rowNumber: number) => {
    if (!preview?.plan) return;
    const confirmed = window.confirm(
      `Hold CSV row ${rowNumber} outside production for later identity review?`,
    );
    if (!confirmed) return;
    try {
      setPreview({
        ...preview,
        plan: holdPossibleDuplicate(preview.plan, rowNumber),
      });
      setMessage(`Row ${rowNumber} will remain outside production.`);
    } catch (error) {
      setMessage(safeError(error));
    }
  };

  const apply = async () => {
    if (!preview?.plan || applyDisabled) return;
    const plan = preview.plan;
    let applicationError = "";
    const result = await updateData((current) => {
      const applied = applyLeadImportPlan(current, plan, new Date());
      if (!applied.ok) {
        applicationError = applied.error;
        throw new Error("Import plan rejected");
      }
      return applied.data;
    });
    if (!result.ok) {
      setMessage(applicationError || result.message);
      return;
    }
    const appliedCount = countSafeRows(plan);
    setPreview(null);
    setMessage(
      `${appliedCount} safe ${appliedCount === 1 ? "row was" : "rows were"} applied as Research records. No contact was initiated.`,
    );
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  const cancel = () => {
    setPreview(null);
    setMessage("CSV preview cancelled. No property records changed.");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  return (
    <section className="panel lead-engine-section" aria-labelledby="csv-import-title">
      <div className="panel-heading">
        <div>
          <span className="mini-label">Preview before one locked mutation</span>
          <h2 id="csv-import-title">Authorized CSV intake</h2>
        </div>
        <button
          className="button button-quiet button-small"
          type="button"
          onClick={() =>
            downloadText(
              "tradewind-property-intake-template.csv",
              `${LAUNCH_TEMPLATE_HEADERS.join(",")}\n`,
              "text/csv;charset=utf-8",
            )
          }
        >
          Download blank CSV template
        </button>
      </div>
      <p className="panel-intro">
        The selected file stays in this browser. Tradewind does not transmit
        file contents, addresses, source IDs, notes, or qualification results.
        Review the local preview before you can Apply safe records.
      </p>

      <div className="csv-instructions" id="csv-file-help">
        <strong>Required columns</strong>
        <span>
          source, source_record_id, retrieved_date, usage_rights,
          property_address, city, state, and zip.
        </span>
        <small>
          Dates use YYYY-MM-DD. Unknown optional facts stay blank. Do not add
          seller contact data or protected/sensitive characteristics.
        </small>
        <small>
          Usage rights must be Public record, Licensed provider, Direct
          submission, Authorized CRM, Operator research, or Restricted —
          research only.
        </small>
      </div>

      <label className="file-picker">
        <span>Select an authorized property CSV</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={!writesSupported}
          aria-describedby="csv-file-help"
          onChange={chooseFile}
        />
      </label>

      <p className="form-message persistent-message" role="status" aria-live="polite">
        {message || "No CSV is selected."}
      </p>

      {preview && (
        <div className="import-preview">
          <div className="section-line-heading">
            <div>
              <span className="mini-label">Local validation result</span>
              <h3 ref={previewHeadingRef} tabIndex={-1}>
                Review CSV preview
              </h3>
            </div>
            <span className="source-identifier">{preview.fileName}</span>
          </div>

          {stale && (
            <p className="inline-alert" role="alert">
              The workspace changed after this preview. Select the file again
              before applying records.
            </p>
          )}

          <dl className="preview-count-grid" aria-label="Import result counts">
            <Count label="Safe new records" value={preview.plan?.newRows.length ?? 0} />
            <Count
              label="Changed source snapshots"
              value={preview.plan?.changedSourceRows.length ?? 0}
            />
            <Count
              label="Exact unchanged reimports"
              value={preview.plan?.exactReimports.length ?? 0}
            />
            <Count
              label="Same-file duplicates"
              value={preview.plan?.sameFileDuplicates.length ?? 0}
            />
            <Count
              label="Possible property matches"
              value={preview.plan?.possibleDuplicates.length ?? 0}
            />
            <Count
              label="Held or rejected rows"
              value={preview.plan?.rejected.length ?? 0}
            />
            <Count label="Validation errors" value={preview.errors.length} />
            <Count label="Potential fact conflicts" value={conflictPreviews.length} />
            <Count label="Restricted-source rows" value={restrictedCount} />
          </dl>

          {preview.errors.length > 0 && (
            <PreviewGroup title="Validation errors" tone="blocked">
              <ul>
                {preview.errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </PreviewGroup>
          )}

          {(preview.plan?.possibleDuplicates.length ?? 0) > 0 && (
            <PreviewGroup title="Resolve or hold possible property matches" tone="warning">
              <div className="preview-card-list">
                {preview.plan?.possibleDuplicates.map((item) => (
                  <article className="preview-card" key={item.rowNumber}>
                    <strong>
                      Row {item.rowNumber}: {item.candidate.address}
                    </strong>
                    <span>
                      {item.candidate.city}, {item.candidate.state}{" "}
                      {item.candidate.zip}
                    </span>
                    <p>{item.reason}</p>
                    <div className="button-row">
                      {item.matchingDealIds.map((dealId) => {
                        const deal = data.deals.find(({ id }) => id === dealId);
                        return deal ? (
                          <button
                            className="button button-quiet button-small"
                            type="button"
                            key={dealId}
                            onClick={() => attach(item.rowNumber, deal)}
                          >
                            Attach to {deal.address}
                          </button>
                        ) : null;
                      })}
                      <button
                        className="button button-danger-outline button-small"
                        type="button"
                        onClick={() => hold(item.rowNumber)}
                      >
                        Hold outside production
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </PreviewGroup>
          )}

          {conflictPreviews.length > 0 && (
            <PreviewGroup title="Potential conflicting facts" tone="warning">
              <ul>
                {conflictPreviews.map(({ rowNumber, fields }) => (
                  <li key={rowNumber}>
                    Row {rowNumber}: {fields.join(", ")} will remain conflicting
                    until reviewed; canonical facts will not be overwritten.
                  </li>
                ))}
              </ul>
            </PreviewGroup>
          )}

          {(preview.plan?.exactReimports.length ?? 0) > 0 && (
            <PreviewGroup title="Exact unchanged reimports">
              <ul>
                {preview.plan?.exactReimports.map((item) => (
                  <li key={item.rowNumber}>
                    Row {item.rowNumber}: no record or source snapshot will be
                    created.
                  </li>
                ))}
              </ul>
            </PreviewGroup>
          )}

          {(preview.plan?.sameFileDuplicates.length ?? 0) > 0 && (
            <PreviewGroup title="Same-file duplicates">
              <ul>
                {preview.plan?.sameFileDuplicates.map((item) => (
                  <li key={item.rowNumber}>
                    Row {item.rowNumber}: no duplicate record or source
                    snapshot will be created.
                  </li>
                ))}
              </ul>
            </PreviewGroup>
          )}

          {(preview.plan?.rejected.length ?? 0) > 0 && (
            <PreviewGroup title="Rows held outside production" tone="blocked">
              <ul>
                {preview.plan?.rejected.map((item) => (
                  <li key={item.rowNumber}>
                    Row {item.rowNumber}: {item.reason}
                  </li>
                ))}
              </ul>
            </PreviewGroup>
          )}

          <div className="form-safety">
            <span aria-hidden="true">i</span>
            <p>
              Applying uses one serialized browser mutation. New records enter
              Research. Exact reimports do nothing, held rows stay outside
              production, and restricted source rights keep contact blocked.
            </p>
          </div>
          <div className="button-row preview-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={applyDisabled}
              onClick={apply}
            >
              Apply safe records
            </button>
            <button className="button button-quiet" type="button" onClick={cancel}>
              Cancel preview
            </button>
          </div>
          {applyDisabled && (
            <p className="muted-copy">
              Apply remains unavailable for no safe rows, unresolved matches,
              stale plans, corrupt storage, or browsers without Web Locks.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PreviewGroup({
  title,
  tone = "neutral",
  children,
}: {
  title: string;
  tone?: "neutral" | "warning" | "blocked";
  children: ReactNode;
}) {
  return (
    <section className={`preview-group ${tone}`}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function countSafeRows(plan: LeadImportPlan): number {
  return (
    plan.newRows.length +
    plan.changedSourceRows.length +
    plan.attachments.length
  );
}

function allPlanCandidates(plan: LeadImportPlan): LeadImportCandidate[] {
  return [
    ...plan.newRows,
    ...plan.changedSourceRows,
    ...plan.exactReimports,
    ...plan.sameFileDuplicates,
    ...plan.possibleDuplicates,
    ...plan.rejected,
    ...plan.attachments,
  ].map(({ candidate }) => candidate);
}

function countRestrictedRows(plan: LeadImportPlan): number {
  return allPlanCandidates(plan).filter(
    ({ usageClassification }) =>
      usageClassification === "Restricted — research only",
  ).length;
}

function plannedConflictPreviews(
  data: DealFlowData,
  plan: LeadImportPlan,
): Array<{ rowNumber: number; fields: string[] }> {
  const planned = new Map(
    plan.newRows.map((item) => [item.rowNumber, item.candidate]),
  );
  const result: Array<{ rowNumber: number; fields: string[] }> = [];
  for (const item of plan.changedSourceRows) {
    const target = item.dealId
      ? data.deals.find(({ id }) => id === item.dealId)
      : candidateAsDealFacts(
          planned.get(item.plannedDealRowNumber ?? -1) ?? null,
        );
    const fields = target
      ? differingFields(target, item.candidate)
      : [];
    if (fields.length > 0) result.push({ rowNumber: item.rowNumber, fields });
  }
  for (const item of plan.attachments) {
    const target = data.deals.find(({ id }) => id === item.dealId);
    const fields = target ? differingFields(target, item.candidate) : [];
    if (fields.length > 0) result.push({ rowNumber: item.rowNumber, fields });
  }
  return result;
}

function candidateAsDealFacts(
  candidate: LeadImportCandidate | null,
): PropertyFactSnapshot | null {
  return candidate === null ? null : {
    state: candidate.state,
    address: candidate.address,
    city: candidate.city,
    zip: candidate.zip,
    market: candidate.market,
    propertyType: candidate.propertyType ?? "",
    askingPrice: candidate.askingPrice,
    rehabLevel: candidate.rehabLevel,
    ownerContactStatus: candidate.ownerContactStatus ?? "",
    nextAction: candidate.nextAction ?? "",
    notes: candidate.notes ?? "",
  };
}

function differingFields(
  target: Pick<DealRecord, keyof PropertyFactSnapshot> | PropertyFactSnapshot,
  candidate: LeadImportCandidate,
): string[] {
  const asserted = candidateAsDealFacts(candidate);
  if (asserted === null) return [];
  return FACT_FIELDS.filter(
    (field) => JSON.stringify(target[field]) !== JSON.stringify(asserted[field]),
  );
}

function safeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The preview decision could not be applied.";
}
