"use client";

import { useState } from "react";

import type { AIFieldKey } from "@/lib/ai-field-generation";

export function GenerateWithAIButton({
  field,
  value,
  onGenerated,
  disabled = false,
}: {
  field: AIFieldKey;
  value: string;
  onGenerated: (value: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/field-generation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, sourceText: value }),
      });
      const body = await response.json() as { text?: unknown; error?: unknown };
      if (!response.ok || typeof body.text !== "string") {
        throw new Error(typeof body.error === "string" ? body.error : "AI draft unavailable.");
      }
      onGenerated(body.text);
      setMessage("AI draft inserted; review before saving.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI draft unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="ai-field-action">
      <button
        className="button button-quiet button-small"
        type="button"
        data-ai-field={field}
        disabled={disabled || busy}
        onClick={() => void generate()}
      >
        {busy ? "Generating…" : "Generate with AI"}
      </button>
      {message && <small className="field-help" role="status">{message}</small>}
    </span>
  );
}
