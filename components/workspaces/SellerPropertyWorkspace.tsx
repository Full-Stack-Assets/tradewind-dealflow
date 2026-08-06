"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import { GenerateWithAIButton } from "@/components/ai/GenerateWithAIButton";
import {
  EmptyState,
  LocalDataNotice,
  StatusPill,
  WorkspaceHeader,
} from "@/components/WorkspaceShell";
import type {
  SellerApprovalRequest,
  SellerComparableRange,
  SellerConversationActor,
  SellerConversationChannel,
  SellerConversationLog,
  SellerDocumentContract,
  SellerRepairRange,
  SellerReviewDraft,
  SellerWorkspaceTask,
} from "@/lib/types";

const actorOptions: SellerConversationActor[] = ["Seller", "Operator", "Team"];
const channelOptions: SellerConversationChannel[] = ["Call", "Text", "Email", "Video", "Meeting", "In-person"];
const taskStatuses = ["todo", "in_progress", "done"] as const;
const documentStatusOptions = [
  "Draft",
  "Pending review",
  "Approved",
  "Needs revision",
  "Rejected",
] as const;
const approvalStatuses = ["Pending", "Approved", "Rejected", "Needs revision"] as const;
const requestTypes = ["Document publish", "Range publish", "Fact-sheet export"] as const;
const documentCategories = [
  "Comparable packet",
  "Repair analysis",
  "Conversation packet",
  "Property fact sheet",
  "Other",
] as const;

function nextId() {
  return crypto.randomUUID();
}

function normalizeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function normalizeDate(rawDate: string): string {
  if (rawDate === "") return "";
  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function normalizeDateTime(rawDateTime: string): string {
  if (rawDateTime === "") return "";
  const parsed = new Date(rawDateTime);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

type ConversationForm = {
  propertyRecordId: string;
  actor: SellerConversationActor;
  channel: SellerConversationChannel;
  summary: string;
  nextAction: string;
  followUpAt: string;
  source: string;
  reference: string;
  collectedAt: string;
  confidence: "Low" | "Medium" | "High";
  verifiedAt: string;
  notes: string;
};

type TaskForm = {
  propertyRecordId: string;
  title: string;
  status: (typeof taskStatuses)[number];
  dueAt: string;
  notes: string;
};

type ComparableForm = {
  propertyRecordId: string;
  comparableAddress: string;
  soldPrice: string;
  soldDate: string;
  lowEstimate: string;
  highEstimate: string;
  adjustmentNotes: string;
  source: string;
  reference: string;
  collectedAt: string;
  confidence: "Low" | "Medium" | "High";
  verifiedAt: string;
  notes: string;
};

type RepairForm = {
  propertyRecordId: string;
  workItem: string;
  lowEstimate: string;
  highEstimate: string;
  evidenceSummary: string;
  source: string;
  reference: string;
  collectedAt: string;
  confidence: "Low" | "Medium" | "High";
  verifiedAt: string;
  notes: string;
};

type DocumentForm = {
  propertyRecordId: string;
  title: string;
  category: (typeof documentCategories)[number];
  fileName: string;
  mimeType: string;
  fileSizeBytes: string;
  notes: string;
  status: (typeof documentStatusOptions)[number];
  source: string;
  reference: string;
  collectedAt: string;
  confidence: "Low" | "Medium" | "High";
  verifiedAt: string;
  provenanceNotes: string;
};

type ReviewDraftForm = {
  propertyRecordId: string;
  title: string;
  summary: string;
  includeComparableRangeIds: string;
  includeRepairRangeIds: string;
  includeDocumentIds: string;
};

type ApprovalRequestForm = {
  propertyRecordId: string;
  reviewDraftId: string;
  requestType: (typeof requestTypes)[number];
  requestedBy: string;
  status: (typeof approvalStatuses)[number];
  reviewedAt: string;
  reviewer: string;
  reason: string;
};

const emptyConversation: ConversationForm = {
  propertyRecordId: "",
  actor: "Seller",
  channel: "Call",
  summary: "",
  nextAction: "",
  followUpAt: "",
  source: "manual-call-note",
  reference: "Operator journal / notes",
  collectedAt: "",
  confidence: "Medium",
  verifiedAt: "",
  notes: "",
};

const emptyTask: TaskForm = {
  propertyRecordId: "",
  title: "",
  status: "todo",
  dueAt: "",
  notes: "",
};

const emptyComparable: ComparableForm = {
  propertyRecordId: "",
  comparableAddress: "",
  soldPrice: "",
  soldDate: "",
  lowEstimate: "",
  highEstimate: "",
  adjustmentNotes: "",
  source: "manual-research",
  reference: "",
  collectedAt: "",
  confidence: "Medium",
  verifiedAt: "",
  notes: "",
};

const emptyRepair: RepairForm = {
  propertyRecordId: "",
  workItem: "",
  lowEstimate: "",
  highEstimate: "",
  evidenceSummary: "",
  source: "operator-walkthrough",
  reference: "",
  collectedAt: "",
  confidence: "Medium",
  verifiedAt: "",
  notes: "",
};

const emptyDocument: DocumentForm = {
  propertyRecordId: "",
  title: "",
  category: "Comparable packet",
  fileName: "manual-note.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: "",
  notes: "",
  status: "Draft",
  source: "manual-upload",
  reference: "Operator-recorded draft",
  collectedAt: "",
  confidence: "Medium",
  verifiedAt: "",
  provenanceNotes: "",
};

const emptyReviewDraft: ReviewDraftForm = {
  propertyRecordId: "",
  title: "",
  summary: "",
  includeComparableRangeIds: "",
  includeRepairRangeIds: "",
  includeDocumentIds: "",
};

const emptyApprovalRequest: ApprovalRequestForm = {
  propertyRecordId: "",
  reviewDraftId: "",
  requestType: "Document publish",
  requestedBy: "",
  status: "Pending",
  reviewedAt: "",
  reviewer: "",
  reason: "",
};

function asList(raw: string): string[] {
  return raw
    .split(/[\n,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SellerPropertyWorkspace() {
  const { data, updateData, writesSupported } = useLocalData();
  const [message, setMessage] = useState("");

  const [conversationForm, setConversationForm] = useState(emptyConversation);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [comparableForm, setComparableForm] = useState(emptyComparable);
  const [repairForm, setRepairForm] = useState(emptyRepair);
  const [documentForm, setDocumentForm] = useState(emptyDocument);
  const [reviewDraftForm, setReviewDraftForm] = useState(emptyReviewDraft);
  const [approvalRequestForm, setApprovalRequestForm] = useState(emptyApprovalRequest);

  const dealChoices = useMemo(
    () => data.deals.map((deal) => ({ value: deal.id, label: `${deal.address}, ${deal.city}` })),
    [data.deals],
  );

  const workspace = data.sellerPropertyWorkspace;

  const showNoProperties = data.deals.length === 0;

  const selectedDrafts = useMemo(
    () => workspace.reviewDrafts.filter((draft) => draft.propertyRecordId === reviewDraftForm.propertyRecordId),
    [workspace.reviewDrafts, reviewDraftForm.propertyRecordId],
  );

  const addConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (showNoProperties || !conversationForm.propertyRecordId) {
      setMessage("Select a property before logging a seller conversation.");
      return;
    }
    const normalizedFollowUpAt = normalizeDateTime(conversationForm.followUpAt);
    if (normalizedFollowUpAt === "") {
      setMessage("Provide a valid follow-up date and time.");
      return;
    }
    const record: SellerConversationLog = {
      id: nextId(),
      propertyRecordId: conversationForm.propertyRecordId,
      loggedAt: new Date().toISOString(),
      actor: conversationForm.actor,
      channel: conversationForm.channel,
      summary: conversationForm.summary.trim(),
      nextAction: conversationForm.nextAction.trim(),
      followUpAt: normalizedFollowUpAt || new Date().toISOString(),
      provenance: {
        source: conversationForm.source.trim(),
        reference: conversationForm.reference.trim(),
        collectedAt: conversationForm.collectedAt || new Date().toISOString(),
        confidence: conversationForm.confidence,
        verifiedAt: conversationForm.verifiedAt || null,
        notes: conversationForm.notes.trim(),
      },
    };

    if (!record.summary || !record.nextAction || !record.provenance.source) {
      setMessage("Complete the conversation summary, next action, and provenance fields.");
      return;
    }

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        conversationLogs: [record, ...current.sellerPropertyWorkspace.conversationLogs],
      },
    }));
    if (result.ok) {
      setMessage("Conversation log saved locally. No action was sent.");
      setConversationForm({ ...emptyConversation, propertyRecordId: conversationForm.propertyRecordId });
    } else {
      setMessage(result.message);
    }
  };

  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (showNoProperties || !taskForm.propertyRecordId || !taskForm.title.trim() || !taskForm.dueAt) {
      setMessage("Select a property and complete title and due date for this task.");
      return;
    }
    const normalizedDueAt = normalizeDate(taskForm.dueAt);
    if (normalizedDueAt === "") {
      setMessage("Provide a valid due date.");
      return;
    }

    const now = new Date().toISOString();
    const record: SellerWorkspaceTask = {
      id: nextId(),
      propertyRecordId: taskForm.propertyRecordId,
      createdAt: now,
      updatedAt: now,
      title: taskForm.title.trim(),
      status: taskForm.status,
      dueAt: normalizedDueAt,
      notes: taskForm.notes.trim(),
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        tasks: [record, ...current.sellerPropertyWorkspace.tasks],
      },
    }));
    if (result.ok) {
      setMessage("Task added to your local operator queue.");
      setTaskForm({ ...emptyTask, propertyRecordId: taskForm.propertyRecordId, status: taskForm.status });
    } else {
      setMessage(result.message);
    }
  };

  const addComparable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      showNoProperties
      || !comparableForm.propertyRecordId
      || !comparableForm.comparableAddress.trim()
      || !comparableForm.soldDate
      || !comparableForm.adjustmentNotes.trim()
    ) {
      setMessage("Complete comparable fields before saving.");
      return;
    }
    const now = new Date().toISOString();
    const normalizedSoldDate = normalizeDate(comparableForm.soldDate);
    if (normalizedSoldDate === "") {
      setMessage("Provide a valid sold date.");
      return;
    }
    const low = normalizeNumber(comparableForm.lowEstimate);
    const high = normalizeNumber(comparableForm.highEstimate);
    if (Number.isNaN(low ?? 0) || Number.isNaN(high ?? 0)) {
      setMessage("Comparable low/high estimates must be valid non-negative numbers or blank.");
      return;
    }
    if (low !== null && high !== null && low > high) {
      setMessage("Comparable low estimate cannot exceed high estimate.");
      return;
    }

    const record: SellerComparableRange = {
      id: nextId(),
      propertyRecordId: comparableForm.propertyRecordId,
      comparableAddress: comparableForm.comparableAddress.trim(),
      soldPrice: normalizeNumber(comparableForm.soldPrice),
      soldDate: normalizedSoldDate,
      lowEstimate: low,
      highEstimate: high,
      adjustmentNotes: comparableForm.adjustmentNotes.trim(),
      provenance: {
        source: comparableForm.source.trim(),
        reference: comparableForm.reference.trim(),
        collectedAt: comparableForm.collectedAt || now,
        confidence: comparableForm.confidence,
        verifiedAt: comparableForm.verifiedAt || null,
        notes: comparableForm.notes.trim(),
      },
      updatedAt: now,
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        comparableRanges: [record, ...current.sellerPropertyWorkspace.comparableRanges],
      },
    }));
    if (result.ok) {
      setMessage("Comparable range captured with local provenance.");
      setComparableForm({ ...emptyComparable, propertyRecordId: comparableForm.propertyRecordId });
    } else {
      setMessage(result.message);
    }
  };

  const addRepairRange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!repairForm.propertyRecordId || !repairForm.workItem.trim() || !repairForm.evidenceSummary.trim()) {
      setMessage("Choose a property and complete repair range fields.");
      return;
    }
    const now = new Date().toISOString();
    const low = normalizeNumber(repairForm.lowEstimate);
    const high = normalizeNumber(repairForm.highEstimate);
    if (Number.isNaN(low ?? 0) || Number.isNaN(high ?? 0)) {
      setMessage("Repair estimate values must be valid non-negative numbers or blank.");
      return;
    }
    if (low !== null && high !== null && low > high) {
      setMessage("Repair low estimate cannot exceed high estimate.");
      return;
    }

    const record: SellerRepairRange = {
      id: nextId(),
      propertyRecordId: repairForm.propertyRecordId,
      workItem: repairForm.workItem.trim(),
      lowEstimate: low,
      highEstimate: high,
      evidenceSummary: repairForm.evidenceSummary.trim(),
      provenance: {
        source: repairForm.source.trim(),
        reference: repairForm.reference.trim(),
        collectedAt: repairForm.collectedAt || now,
        confidence: repairForm.confidence,
        verifiedAt: repairForm.verifiedAt || null,
        notes: repairForm.notes.trim(),
      },
      updatedAt: now,
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        repairRanges: [record, ...current.sellerPropertyWorkspace.repairRanges],
      },
    }));
    if (result.ok) {
      setMessage("Repair estimate saved with provenance.");
      setRepairForm({ ...emptyRepair, propertyRecordId: repairForm.propertyRecordId });
    } else {
      setMessage(result.message);
    }
  };

  const addDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!documentForm.propertyRecordId || !documentForm.title.trim() || !documentForm.fileName.trim()) {
      setMessage("Choose property and provide document title and file name.");
      return;
    }
    const bytes = normalizeNumber(documentForm.fileSizeBytes);
    if (Number.isNaN(bytes) || (documentForm.fileSizeBytes.trim() !== "" && (bytes === null || !Number.isInteger(bytes)))) {
      setMessage("Provide a valid file size in bytes, or leave blank.");
      return;
    }
    const now = new Date().toISOString();
    const record: SellerDocumentContract = {
      id: nextId(),
      propertyRecordId: documentForm.propertyRecordId,
      title: documentForm.title.trim(),
      category: documentForm.category,
      storageMode: "metadata-only",
      fileName: documentForm.fileName.trim(),
      mimeType: documentForm.mimeType.trim(),
      fileSizeBytes: bytes === null ? 0 : bytes,
      notes: documentForm.notes.trim(),
      status: documentForm.status,
      provenance: {
        source: documentForm.source.trim(),
        reference: documentForm.reference.trim(),
        collectedAt: documentForm.collectedAt || now,
        confidence: documentForm.confidence,
        verifiedAt: documentForm.verifiedAt || null,
        notes: documentForm.provenanceNotes.trim(),
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        documents: [record, ...current.sellerPropertyWorkspace.documents],
      },
    }));
    if (result.ok) {
      setMessage("Metadata-only document draft stored locally.");
      setDocumentForm({ ...emptyDocument, propertyRecordId: documentForm.propertyRecordId, category: documentForm.category });
    } else {
      setMessage(result.message);
    }
  };

  const addReviewDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewDraftForm.propertyRecordId || !reviewDraftForm.title.trim() || !reviewDraftForm.summary.trim()) {
      setMessage("Select property and fill review draft title and summary.");
      return;
    }

    const now = new Date().toISOString();
    const record: SellerReviewDraft = {
      id: nextId(),
      propertyRecordId: reviewDraftForm.propertyRecordId,
      title: reviewDraftForm.title.trim(),
      summary: reviewDraftForm.summary.trim(),
      includeComparableRangeIds: asList(reviewDraftForm.includeComparableRangeIds),
      includeRepairRangeIds: asList(reviewDraftForm.includeRepairRangeIds),
      includeDocumentIds: asList(reviewDraftForm.includeDocumentIds),
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        reviewDrafts: [record, ...current.sellerPropertyWorkspace.reviewDrafts],
      },
    }));
    if (result.ok) {
      setMessage("Review draft saved locally; it is not approved for publication.");
      setReviewDraftForm({ ...emptyReviewDraft, propertyRecordId: reviewDraftForm.propertyRecordId });
    } else {
      setMessage(result.message);
    }
  };

  const addApprovalRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!approvalRequestForm.propertyRecordId || !approvalRequestForm.reviewDraftId || !approvalRequestForm.requestedBy.trim()) {
      setMessage("Complete approval request property, draft, and requester.");
      return;
    }
    const now = new Date().toISOString();
    const record: SellerApprovalRequest = {
      id: nextId(),
      propertyRecordId: approvalRequestForm.propertyRecordId,
      reviewDraftId: approvalRequestForm.reviewDraftId,
      requestType: approvalRequestForm.requestType,
      requestedAt: now,
      requestedBy: approvalRequestForm.requestedBy.trim(),
      status: approvalRequestForm.status,
      reviewedAt: approvalRequestForm.status === "Approved" || approvalRequestForm.status === "Rejected" ? (approvalRequestForm.reviewedAt || now) : null,
      reviewer: approvalRequestForm.reviewer.trim(),
      reason: approvalRequestForm.reason.trim(),
    };

    const result = await updateData((current) => ({
      ...current,
      sellerPropertyWorkspace: {
        ...current.sellerPropertyWorkspace,
        approvalRequests: [record, ...current.sellerPropertyWorkspace.approvalRequests],
      },
    }));
    if (result.ok) {
      setMessage("Approval request saved for manual review.");
      setApprovalRequestForm({
        ...emptyApprovalRequest,
        propertyRecordId: approvalRequestForm.propertyRecordId,
        status: approvalRequestForm.status,
      });
    } else {
      setMessage(result.message);
    }
  };

  const updateConversationField = useCallback(
    <K extends keyof ConversationForm>(key: K, value: ConversationForm[K]) => {
      setConversationForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateTaskField = useCallback(
    <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
      setTaskForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateComparableField = useCallback(
    <K extends keyof ComparableForm>(key: K, value: ComparableForm[K]) => {
      setComparableForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateRepairField = useCallback(
    <K extends keyof RepairForm>(key: K, value: RepairForm[K]) => {
      setRepairForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateDocumentField = useCallback(
    <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => {
      setDocumentForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateReviewDraftField = useCallback(
    <K extends keyof ReviewDraftForm>(key: K, value: ReviewDraftForm[K]) => {
      setReviewDraftForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateApprovalRequestField = useCallback(
    <K extends keyof ApprovalRequestForm>(key: K, value: ApprovalRequestForm[K]) => {
      setApprovalRequestForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  return (
    <>
      <WorkspaceHeader
        eyebrow="Seller intake"
        title="Seller/Property Workspace"
        description="Record property facts and preparation artifacts with local provenance, then route drafts through manual approval only."
        action={<StatusPill tone="blocked">Drafts unpublished</StatusPill>}
      />
      <LocalDataNotice />

      <aside className="legal-disclaimer">
        <span aria-hidden="true">!</span>
        <p>
          This workspace is fail-closed by design: no draft is published, sent,
          or used for execution until a separate human review step approves it.
        </p>
      </aside>

      {message && <p className="persistent-message" role="status" aria-live="polite">{message}</p>}

      {showNoProperties ? (
        <section className="panel" aria-label="No properties">
          <EmptyState title="A property record is required">
            Add a property in Pipeline first. Seller workspace inputs are scoped
            to a selected property record and remain local drafts until manual
            review.
          </EmptyState>
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="conversation-title">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Seller communication</span>
                <h2 id="conversation-title">Manual conversation log</h2>
              </div>
              <StatusPill tone="neutral">Record-only</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addConversation}>
              <div className="form-grid three">
                <label>
                  <span>Property</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={conversationForm.propertyRecordId}
                    onChange={(event) => updateConversationField("propertyRecordId", event.target.value)}
                  >
                    <option value="">Select property</option>
                    {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Actor</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={conversationForm.actor}
                    onChange={(event) => updateConversationField("actor", event.target.value as SellerConversationActor)}
                  >
                    {actorOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span>Channel</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={conversationForm.channel}
                    onChange={(event) => updateConversationField("channel", event.target.value as SellerConversationChannel)}
                  >
                    {channelOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Conversation summary *</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={conversationForm.summary}
                  onChange={(event) => updateConversationField("summary", event.target.value)}
                />
                <GenerateWithAIButton field="conversationSummary" value={conversationForm.summary} onGenerated={(value) => updateConversationField("summary", value)} disabled={!writesSupported} />
              </label>
              <label>
                <span>Next action *</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={conversationForm.nextAction}
                  onChange={(event) => updateConversationField("nextAction", event.target.value)}
                />
                <GenerateWithAIButton field="conversationNextAction" value={conversationForm.nextAction} onGenerated={(value) => updateConversationField("nextAction", value)} disabled={!writesSupported} />
              </label>
              <label>
                <span>Follow-up timestamp (ISO) *</span>
                <input
                  type="datetime-local"
                  required
                  disabled={!writesSupported}
                  value={conversationForm.followUpAt}
                  onChange={(event) => updateConversationField("followUpAt", event.target.value)}
                />
              </label>
              <div className="form-grid two">
                <label>
                  <span>Provenance source</span>
                  <input
                    required
                    disabled={!writesSupported}
                    value={conversationForm.source}
                    onChange={(event) => updateConversationField("source", event.target.value)}
                  />
                </label>
                <label>
                  <span>Reference</span>
                  <input
                    required
                    disabled={!writesSupported}
                    value={conversationForm.reference}
                    onChange={(event) => updateConversationField("reference", event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Provenance notes</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={conversationForm.notes}
                  onChange={(event) => updateConversationField("notes", event.target.value)}
                />
                <GenerateWithAIButton field="conversationNotes" value={conversationForm.notes} onGenerated={(value) => updateConversationField("notes", value)} disabled={!writesSupported} />
              </label>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>
                Save conversation note
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Seller tasking</span>
                <h2>Task queue</h2>
              </div>
              <StatusPill tone="neutral">Manual queue</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addTask}>
              <div className="form-grid three">
                <label>
                  <span>Property</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={taskForm.propertyRecordId}
                    onChange={(event) => updateTaskField("propertyRecordId", event.target.value)}
                  >
                    <option value="">Select property</option>
                    {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={taskForm.status}
                    onChange={(event) => updateTaskField("status", event.target.value as TaskForm["status"])}
                  >
                    {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  <span>Due (date)</span>
                  <input
                    required
                    disabled={!writesSupported}
                    type="date"
                    value={taskForm.dueAt}
                    onChange={(event) => updateTaskField("dueAt", event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Title *</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={taskForm.title}
                  onChange={(event) => updateTaskField("title", event.target.value)}
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={taskForm.notes}
                  onChange={(event) => updateTaskField("notes", event.target.value)}
                />
                <GenerateWithAIButton field="taskNotes" value={taskForm.notes} onGenerated={(value) => updateTaskField("notes", value)} disabled={!writesSupported} />
              </label>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>
                Add task
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Comparable ranges</span>
                <h2>Provenance-aware comparable evidence</h2>
              </div>
              <StatusPill tone="neutral">Range evidence</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addComparable}>
              <div className="form-grid two">
                <label>
                  <span>Property</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={comparableForm.propertyRecordId}
                    onChange={(event) => updateComparableField("propertyRecordId", event.target.value)}
                  >
                    <option value="">Select property</option>
                    {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Sold date</span>
                  <input
                    required
                    type="date"
                    disabled={!writesSupported}
                    value={comparableForm.soldDate}
                    onChange={(event) => updateComparableField("soldDate", event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Comparable address or parcel</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={comparableForm.comparableAddress}
                  onChange={(event) => updateComparableField("comparableAddress", event.target.value)}
                />
              </label>
              <label>
                <span>Adjustment notes</span>
                <textarea
                  rows={2}
                  required
                  disabled={!writesSupported}
                  value={comparableForm.adjustmentNotes}
                  onChange={(event) => updateComparableField("adjustmentNotes", event.target.value)}
                />
                <GenerateWithAIButton field="comparableAdjustmentNotes" value={comparableForm.adjustmentNotes} onGenerated={(value) => updateComparableField("adjustmentNotes", value)} disabled={!writesSupported} />
              </label>
              <div className="form-grid three">
                <label>
                  <span>Sold price</span>
                  <input
                    inputMode="decimal"
                    disabled={!writesSupported}
                    value={comparableForm.soldPrice}
                    onChange={(event) => updateComparableField("soldPrice", event.target.value)}
                  />
                </label>
                <label>
                  <span>Low estimate</span>
                  <input
                    inputMode="decimal"
                    disabled={!writesSupported}
                    value={comparableForm.lowEstimate}
                    onChange={(event) => updateComparableField("lowEstimate", event.target.value)}
                  />
                </label>
                <label>
                  <span>High estimate</span>
                  <input
                    inputMode="decimal"
                    disabled={!writesSupported}
                    value={comparableForm.highEstimate}
                    onChange={(event) => updateComparableField("highEstimate", event.target.value)}
                  />
                </label>
              </div>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>Save comparable range</button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Repair ranges</span>
                <h2>Preliminary repair estimate packets</h2>
              </div>
              <StatusPill tone="neutral">Manual estimate ranges</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addRepairRange}>
              <label>
                <span>Property</span>
                <select
                  required
                  disabled={!writesSupported}
                  value={repairForm.propertyRecordId}
                  onChange={(event) => updateRepairField("propertyRecordId", event.target.value)}
                >
                  <option value="">Select property</option>
                  {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                </select>
              </label>
              <label>
                <span>Work item</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={repairForm.workItem}
                  onChange={(event) => updateRepairField("workItem", event.target.value)}
                />
              </label>
              <label>
                <span>Evidence summary</span>
                <textarea
                  required
                  rows={2}
                  disabled={!writesSupported}
                  value={repairForm.evidenceSummary}
                  onChange={(event) => updateRepairField("evidenceSummary", event.target.value)}
                />
                <GenerateWithAIButton field="repairEvidenceSummary" value={repairForm.evidenceSummary} onGenerated={(value) => updateRepairField("evidenceSummary", value)} disabled={!writesSupported} />
              </label>
              <div className="form-grid two">
                <label>
                  <span>Low estimate</span>
                  <input
                    inputMode="decimal"
                    disabled={!writesSupported}
                    value={repairForm.lowEstimate}
                    onChange={(event) => updateRepairField("lowEstimate", event.target.value)}
                  />
                </label>
                <label>
                  <span>High estimate</span>
                  <input
                    inputMode="decimal"
                    disabled={!writesSupported}
                    value={repairForm.highEstimate}
                    onChange={(event) => updateRepairField("highEstimate", event.target.value)}
                  />
                </label>
              </div>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>Save repair range</button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Document contract</span>
                <h2>Metadata-only document drafts</h2>
              </div>
              <StatusPill tone="neutral">No provider upload</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addDocument}>
              <div className="form-grid three">
                <label>
                  <span>Property</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={documentForm.propertyRecordId}
                    onChange={(event) => updateDocumentField("propertyRecordId", event.target.value)}
                  >
                    <option value="">Select property</option>
                    {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Category</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={documentForm.category}
                    onChange={(event) => updateDocumentField("category", event.target.value as DocumentForm["category"])}
                  >
                    {documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={documentForm.status}
                    onChange={(event) => updateDocumentField("status", event.target.value as DocumentForm["status"])}
                  >
                    {documentStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Title</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={documentForm.title}
                  onChange={(event) => updateDocumentField("title", event.target.value)}
                />
              </label>
              <div className="form-grid three">
                <label>
                  <span>File name</span>
                  <input
                    required
                    disabled={!writesSupported}
                    value={documentForm.fileName}
                    onChange={(event) => updateDocumentField("fileName", event.target.value)}
                  />
                </label>
                <label>
                  <span>MIME type</span>
                  <input
                    required
                    disabled={!writesSupported}
                    value={documentForm.mimeType}
                    onChange={(event) => updateDocumentField("mimeType", event.target.value)}
                  />
                </label>
                <label>
                  <span>File size (bytes)</span>
                  <input
                    inputMode="numeric"
                    disabled={!writesSupported}
                    value={documentForm.fileSizeBytes}
                    onChange={(event) => updateDocumentField("fileSizeBytes", event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Notes</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={documentForm.notes}
                  onChange={(event) => updateDocumentField("notes", event.target.value)}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>Save document draft</button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Review packet</span>
                <h2>ReviewDraft with evidence selection</h2>
              </div>
              <StatusPill tone="neutral">Draft for human review</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addReviewDraft}>
              <label>
                <span>Property</span>
                <select
                  required
                  disabled={!writesSupported}
                  value={reviewDraftForm.propertyRecordId}
                  onChange={(event) => updateReviewDraftField("propertyRecordId", event.target.value)}
                >
                  <option value="">Select property</option>
                  {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                </select>
              </label>
              <label>
                <span>Draft title</span>
                <input
                  required
                  disabled={!writesSupported}
                  value={reviewDraftForm.title}
                  onChange={(event) => updateReviewDraftField("title", event.target.value)}
                />
              </label>
              <label>
                <span>Summary</span>
                <textarea
                  required
                  rows={2}
                  disabled={!writesSupported}
                  value={reviewDraftForm.summary}
                  onChange={(event) => updateReviewDraftField("summary", event.target.value)}
                />
                <GenerateWithAIButton field="reviewSummary" value={reviewDraftForm.summary} onGenerated={(value) => updateReviewDraftField("summary", value)} disabled={!writesSupported} />
              </label>
              <label>
                <span>Include comparable IDs (comma or newline separated)</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={reviewDraftForm.includeComparableRangeIds}
                  onChange={(event) => updateReviewDraftField("includeComparableRangeIds", event.target.value)}
                />
              </label>
              <label>
                <span>Include repair IDs (comma or newline separated)</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={reviewDraftForm.includeRepairRangeIds}
                  onChange={(event) => updateReviewDraftField("includeRepairRangeIds", event.target.value)}
                />
              </label>
              <label>
                <span>Include document IDs (comma or newline separated)</span>
                <textarea
                  rows={2}
                  disabled={!writesSupported}
                  value={reviewDraftForm.includeDocumentIds}
                  onChange={(event) => updateReviewDraftField("includeDocumentIds", event.target.value)}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>Save review draft</button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Approval request</span>
                <h2>Manual approval records</h2>
              </div>
              <StatusPill tone="neutral">Fail-closed gate</StatusPill>
            </div>
            <form className="space-y-3" onSubmit={addApprovalRequest}>
              <div className="form-grid two">
                <label>
                  <span>Property</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={approvalRequestForm.propertyRecordId}
                    onChange={(event) => updateApprovalRequestField("propertyRecordId", event.target.value)}
                  >
                    <option value="">Select property</option>
                    {dealChoices.map((deal) => <option key={deal.value} value={deal.value}>{deal.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Review draft</span>
                  <select
                    required
                    disabled={!writesSupported || selectedDrafts.length === 0}
                    value={approvalRequestForm.reviewDraftId}
                    onChange={(event) => updateApprovalRequestField("reviewDraftId", event.target.value)}
                  >
                    <option value="">Select draft</option>
                    {selectedDrafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-grid three">
                <label>
                  <span>Request type</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={approvalRequestForm.requestType}
                    onChange={(event) => updateApprovalRequestField("requestType", event.target.value as ApprovalRequestForm["requestType"])}
                  >
                    {requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  <span>Requested by</span>
                  <input
                    required
                    disabled={!writesSupported}
                    value={approvalRequestForm.requestedBy}
                    onChange={(event) => updateApprovalRequestField("requestedBy", event.target.value)}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    required
                    disabled={!writesSupported}
                    value={approvalRequestForm.status}
                    onChange={(event) => updateApprovalRequestField("status", event.target.value as ApprovalRequestForm["status"])}
                  >
                    {approvalStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Reason</span>
                <textarea
                  rows={2}
                  required
                  disabled={!writesSupported}
                  value={approvalRequestForm.reason}
                  onChange={(event) => updateApprovalRequestField("reason", event.target.value)}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={!writesSupported}>Save approval request</button>
            </form>
          </section>

          <section className="panel" aria-labelledby="seller-workspace-summary-title">
            <div className="panel-heading">
              <div>
                <span className="mini-label">Current draft counts</span>
                <h2 id="seller-workspace-summary-title">Draft inventory</h2>
              </div>
              <span className="status-pill warning">{workspace.conversationLogs.length} logs · {workspace.tasks.length} tasks</span>
            </div>
            <ul>
              <li>
                Comparable ranges: {workspace.comparableRanges.length} · highest range example: {workspace.comparableRanges[0]?.lowEstimate ?? "—"}–{workspace.comparableRanges[0]?.highEstimate ?? "—"}
              </li>
              <li>Repair ranges: {workspace.repairRanges.length}</li>
              <li>Document drafts: {workspace.documents.length}</li>
              <li>Review drafts: {workspace.reviewDrafts.length}</li>
              <li>Approval requests: {workspace.approvalRequests.length}</li>
            </ul>
          </section>
        </>
      )}
    </>
  );
}
