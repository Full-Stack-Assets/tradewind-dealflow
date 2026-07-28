"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useLocalData } from "@/components/LocalDataProvider";
import {
  normalizeBuyBox,
  type BuyBoxValidationResult,
} from "@/lib/qualification";
import type {
  BuyBoxConfig,
  DataConfidence,
  RehabLevel,
  StateCode,
} from "@/lib/types";

type FieldKey =
  | "states"
  | "markets"
  | "propertyTypes"
  | "prices"
  | "rehab"
  | "confidence"
  | "freshness"
  | "financial";

type BuyBoxDraft = {
  states: StateCode[];
  maMarkets: string;
  riMarkets: string;
  propertyTypes: string;
  minPrice: string;
  maxPrice: string;
  rehabLevels: RehabLevel[];
  minimumConfidence: DataConfidence;
  maxVerificationAgeDays: string;
  maximumEstimatedValue: string;
  minimumEquityPercent: string;
  preferredEquityPercent: string;
  minimumAssignmentSpread: string;
  preferredAssignmentSpread: string;
  minimumBuyerProfit: string;
  preferredBuyerProfit: string;
  minimumWholesaleGrossMarginPercent: string;
};

const REHAB_LEVELS: RehabLevel[] = ["Light", "Moderate", "Heavy"];
const CONFIDENCE_LEVELS: DataConfidence[] = ["Low", "Medium", "High"];

export function BuyBoxForm() {
  const { data, updateData, writesSupported } = useLocalData();
  const [draft, setDraft] = useState(() => draftFromBuyBox(data.buyBox));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = candidateFromDraft(draft, data.buyBox);
    const validation = normalizeBuyBox(candidate, data.buyBox, new Date());
    if (!validation.ok) {
      const nextErrors = errorsFromValidation(validation);
      setErrors(nextErrors);
      setMessage("Review the marked buy-box fields before saving.");
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }

    let storedVersion: number | null = null;
    let lockedValidationError = "";
    const result = await updateData((current) => {
      const normalized = normalizeBuyBox(candidate, current.buyBox, new Date());
      if (!normalized.ok) {
        lockedValidationError = normalized.errors.join(" ");
        throw new Error("Invalid buy-box update");
      }
      storedVersion = normalized.value.version;
      return { ...current, buyBox: normalized.value };
    });
    if (!result.ok) {
      setMessage(lockedValidationError || result.message);
      return;
    }
    setErrors({});
    setMessage(
      `Launch buy box saved as version ${String(storedVersion)}. Qualification was recalculated locally.`,
    );
  };

  return (
    <section className="panel lead-engine-section" aria-labelledby="buy-box-title">
      <div className="panel-heading">
        <div>
          <span className="mini-label">One active launch configuration</span>
          <h2 id="buy-box-title">Configure launch buy box</h2>
        </div>
        <span className="status-pill good">
          Version {data.buyBox.version}
        </span>
      </div>
      <p className="panel-intro">
        Start narrowly with Bristol County, Massachusetts and Providence
        County, Rhode Island. Changes create a new version; saved versions are
        never silently edited in place.
      </p>

      <form ref={formRef} className="buy-box-form" onSubmit={save} noValidate>
        <fieldset
          className="option-fieldset"
          aria-invalid={Boolean(errors.states)}
          aria-describedby={errors.states ? "buy-box-states-error" : undefined}
        >
          <legend>Launch states</legend>
          <div className="chip-options">
            {(["MA", "RI"] as StateCode[]).map((state) => (
              <label key={state}>
                <input
                  type="checkbox"
                  checked={draft.states.includes(state)}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      states: toggle(current.states, state),
                    }))
                  }
                />
                <span>
                  {state === "MA" ? "Massachusetts" : "Rhode Island"}
                </span>
              </label>
            ))}
          </div>
          <FieldError id="buy-box-states-error" message={errors.states} />
        </fieldset>

        <div className="form-grid two">
          <label>
            <span>Massachusetts county or city</span>
            <input
              value={draft.maMarkets}
              onChange={(event) =>
                setDraft({ ...draft, maMarkets: event.target.value })
              }
              aria-invalid={Boolean(errors.markets)}
              aria-describedby={
                errors.markets ? "buy-box-markets-error" : "ma-market-help"
              }
            />
            <small id="ma-market-help">Comma-separated exact labels.</small>
          </label>
          <label>
            <span>Rhode Island county or city</span>
            <input
              value={draft.riMarkets}
              onChange={(event) =>
                setDraft({ ...draft, riMarkets: event.target.value })
              }
              aria-invalid={Boolean(errors.markets)}
              aria-describedby={
                errors.markets ? "buy-box-markets-error" : "ri-market-help"
              }
            />
            <small id="ri-market-help">Comma-separated exact labels.</small>
          </label>
          <FieldError id="buy-box-markets-error" message={errors.markets} />

          <label className="span-two">
            <span>Property types</span>
            <textarea
              rows={2}
              value={draft.propertyTypes}
              onChange={(event) =>
                setDraft({ ...draft, propertyTypes: event.target.value })
              }
              aria-invalid={Boolean(errors.propertyTypes)}
              aria-describedby={
                errors.propertyTypes
                  ? "buy-box-types-help buy-box-types-error"
                  : "buy-box-types-help"
              }
            />
            <small id="buy-box-types-help">
              Launch scope is single-family, duplex, triplex, and four-unit
              residential. Separate values with commas.
            </small>
            <FieldError
              id="buy-box-types-error"
              message={errors.propertyTypes}
            />
          </label>

          <NumberField
            label="Preferred minimum acquisition price"
            value={draft.minPrice}
            onChange={(value) => setDraft({ ...draft, minPrice: value })}
            describedBy="buy-box-prices-error"
            invalid={Boolean(errors.prices)}
          />
          <NumberField
            label="Preferred maximum acquisition price"
            value={draft.maxPrice}
            onChange={(value) => setDraft({ ...draft, maxPrice: value })}
            describedBy="buy-box-prices-error"
            invalid={Boolean(errors.prices)}
          />
          <FieldError id="buy-box-prices-error" message={errors.prices} />
        </div>

        <fieldset
          className="option-fieldset"
          aria-invalid={Boolean(errors.rehab)}
          aria-describedby={errors.rehab ? "buy-box-rehab-error" : undefined}
        >
          <legend>Maximum practical repair scope</legend>
          <div className="chip-options">
            {REHAB_LEVELS.map((level) => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={draft.rehabLevels.includes(level)}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      rehabLevels: toggle(current.rehabLevels, level),
                    }))
                  }
                />
                <span>{level}</span>
              </label>
            ))}
          </div>
          <FieldError id="buy-box-rehab-error" message={errors.rehab} />
        </fieldset>

        <details className="advanced-settings">
          <summary>Qualification thresholds</summary>
          <div className="form-grid three">
            <label>
              <span>Minimum source confidence</span>
              <select
                value={draft.minimumConfidence}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    minimumConfidence: event.target.value as DataConfidence,
                  })
                }
                aria-invalid={Boolean(errors.confidence)}
                aria-describedby={
                  errors.confidence ? "buy-box-confidence-error" : undefined
                }
              >
                {CONFIDENCE_LEVELS.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
              <FieldError
                id="buy-box-confidence-error"
                message={errors.confidence}
              />
            </label>
            <NumberField
              label="Maximum verification age in days"
              value={draft.maxVerificationAgeDays}
              onChange={(value) =>
                setDraft({ ...draft, maxVerificationAgeDays: value })
              }
              describedBy="buy-box-freshness-error"
              invalid={Boolean(errors.freshness)}
            />
            <NumberField
              label="Maximum estimated value"
              value={draft.maximumEstimatedValue}
              onChange={(value) =>
                setDraft({ ...draft, maximumEstimatedValue: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Minimum equity percent"
              value={draft.minimumEquityPercent}
              onChange={(value) =>
                setDraft({ ...draft, minimumEquityPercent: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Preferred equity percent"
              value={draft.preferredEquityPercent}
              onChange={(value) =>
                setDraft({ ...draft, preferredEquityPercent: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Minimum assignment spread"
              value={draft.minimumAssignmentSpread}
              onChange={(value) =>
                setDraft({ ...draft, minimumAssignmentSpread: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Preferred assignment spread"
              value={draft.preferredAssignmentSpread}
              onChange={(value) =>
                setDraft({ ...draft, preferredAssignmentSpread: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Minimum buyer profit"
              value={draft.minimumBuyerProfit}
              onChange={(value) =>
                setDraft({ ...draft, minimumBuyerProfit: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Preferred buyer profit"
              value={draft.preferredBuyerProfit}
              onChange={(value) =>
                setDraft({ ...draft, preferredBuyerProfit: value })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <NumberField
              label="Minimum wholesale gross margin percent"
              value={draft.minimumWholesaleGrossMarginPercent}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  minimumWholesaleGrossMarginPercent: value,
                })
              }
              describedBy="buy-box-financial-error"
              invalid={Boolean(errors.financial)}
            />
            <FieldError
              id="buy-box-freshness-error"
              message={errors.freshness}
            />
            <FieldError
              id="buy-box-financial-error"
              message={errors.financial}
            />
          </div>
        </details>

        <div className="form-safety">
          <span aria-hidden="true">i</span>
          <p>
            This buy box prioritizes research only. It cannot authorize owner
            contact, an offer, marketing, a contract, funds, or closing
            instructions.
          </p>
        </div>
        <div className="button-row">
          <button
            className="button button-primary"
            type="submit"
            disabled={!writesSupported}
          >
            Save new buy-box version
          </button>
        </div>
        <p className="form-message persistent-message" role="status" aria-live="polite">
          {message || "No unsaved validation result."}
        </p>
      </form>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  describedBy: string;
  invalid: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? describedBy : undefined}
      />
    </label>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  return message ? (
    <small className="field-error" id={id}>
      {message}
    </small>
  ) : null;
}

function draftFromBuyBox(value: BuyBoxConfig): BuyBoxDraft {
  return {
    states: value.states,
    maMarkets: value.marketsByState.MA.join(", "),
    riMarkets: value.marketsByState.RI.join(", "),
    propertyTypes: value.propertyTypes.join(", "),
    minPrice: numberText(value.minPrice),
    maxPrice: numberText(value.maxPrice),
    rehabLevels: value.rehabLevels,
    minimumConfidence: value.minimumConfidence,
    maxVerificationAgeDays: String(value.maxVerificationAgeDays),
    maximumEstimatedValue: String(
      value.financialThresholds.maximumEstimatedValue,
    ),
    minimumEquityPercent: String(
      value.financialThresholds.minimumEquityPercent,
    ),
    preferredEquityPercent: String(
      value.financialThresholds.preferredEquityPercent,
    ),
    minimumAssignmentSpread: String(
      value.financialThresholds.minimumAssignmentSpread,
    ),
    preferredAssignmentSpread: String(
      value.financialThresholds.preferredAssignmentSpread,
    ),
    minimumBuyerProfit: String(
      value.financialThresholds.minimumBuyerProfit,
    ),
    preferredBuyerProfit: String(
      value.financialThresholds.preferredBuyerProfit,
    ),
    minimumWholesaleGrossMarginPercent: String(
      value.financialThresholds.minimumWholesaleGrossMarginPercent,
    ),
  };
}

function candidateFromDraft(
  draft: BuyBoxDraft,
  previous: BuyBoxConfig,
): BuyBoxConfig {
  return {
    ...previous,
    states: draft.states,
    marketsByState: {
      MA: commaValues(draft.maMarkets),
      RI: commaValues(draft.riMarkets),
    },
    propertyTypes: commaValues(draft.propertyTypes),
    minPrice: nullableNumber(draft.minPrice),
    maxPrice: nullableNumber(draft.maxPrice),
    rehabLevels: draft.rehabLevels,
    minimumConfidence: draft.minimumConfidence,
    maxVerificationAgeDays: Number(draft.maxVerificationAgeDays),
    financialThresholds: {
      maximumEstimatedValue: Number(draft.maximumEstimatedValue),
      minimumEquityPercent: Number(draft.minimumEquityPercent),
      preferredEquityPercent: Number(draft.preferredEquityPercent),
      minimumAssignmentSpread: Number(draft.minimumAssignmentSpread),
      preferredAssignmentSpread: Number(draft.preferredAssignmentSpread),
      minimumBuyerProfit: Number(draft.minimumBuyerProfit),
      preferredBuyerProfit: Number(draft.preferredBuyerProfit),
      minimumWholesaleGrossMarginPercent: Number(
        draft.minimumWholesaleGrossMarginPercent,
      ),
    },
  };
}

function errorsFromValidation(
  result: Extract<BuyBoxValidationResult, { ok: false }>,
): Partial<Record<FieldKey, string>> {
  const mapped: Partial<Record<FieldKey, string>> = {};
  for (const error of result.errors) {
    const normalized = error.toLowerCase();
    const key: FieldKey = /state/.test(normalized)
      ? "states"
      : /market/.test(normalized)
        ? "markets"
        : /property type/.test(normalized)
          ? "propertyTypes"
          : /price/.test(normalized)
            ? "prices"
            : /rehab/.test(normalized)
              ? "rehab"
              : /confidence/.test(normalized)
                ? "confidence"
                : /fresh|verification age/.test(normalized)
                  ? "freshness"
                  : "financial";
    mapped[key] = mapped[key] ? `${mapped[key]} ${error}` : error;
  }
  return mapped;
}

function focusFirstInvalid(form: HTMLFormElement | null) {
  const invalid = form?.querySelector<HTMLElement>(
    '[aria-invalid="true"] input, [aria-invalid="true"] textarea, [aria-invalid="true"] select, input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"]',
  );
  if (!invalid) return;
  const disclosure = invalid.closest("details");
  if (disclosure) disclosure.open = true;
  invalid.focus();
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function commaValues(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function nullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value);
}
