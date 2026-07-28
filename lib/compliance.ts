import type {
  MarketingReadinessInput,
  ParticipationPath,
  StateCode,
} from "./types.ts";

type CancellationInput = {
  startDate: string;
  today: string;
  verifiedHolidays: string[];
  holidayCalendarVerified: boolean;
  attorneyConfirmed: boolean;
};

type CancellationResult = {
  endDate: string | null;
  isOpen: boolean;
  requiresAttorneyConfirmation: boolean;
  ready: boolean;
  reason: string;
};

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatIsoDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addBusinessDays(
  startDate: string,
  days: number,
  verifiedHolidays: string[],
): string | null {
  const cursor = parseIsoDate(startDate);
  if (!cursor || !Number.isInteger(days) || days < 0) return null;
  const holidays = new Set(verifiedHolidays.filter((value) => parseIsoDate(value)));
  let remaining = days;

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    const iso = formatIsoDate(cursor);
    if (weekday !== 0 && weekday !== 6 && !holidays.has(iso)) {
      remaining -= 1;
    }
  }

  return formatIsoDate(cursor);
}

export function evaluateCancellationWindow(
  input: CancellationInput,
): CancellationResult {
  if (!input.startDate) {
    return {
      endDate: null,
      isOpen: false,
      requiresAttorneyConfirmation: true,
      ready: false,
      reason: "No contract date is recorded.",
    };
  }

  const endDate = addBusinessDays(
    input.startDate,
    3,
    input.holidayCalendarVerified ? input.verifiedHolidays : [],
  );
  if (!endDate || !parseIsoDate(input.today)) {
    return {
      endDate: null,
      isOpen: false,
      requiresAttorneyConfirmation: true,
      ready: false,
      reason: "A valid contract date and current date are required.",
    };
  }

  const isOpen = input.today <= endDate;
  const requiresAttorneyConfirmation = !input.holidayCalendarVerified;

  if (requiresAttorneyConfirmation) {
    return {
      endDate,
      isOpen,
      requiresAttorneyConfirmation,
      ready: false,
      reason:
        "The weekday-only date is tentative because no verified holiday calendar is recorded.",
    };
  }

  if (isOpen) {
    return {
      endDate,
      isOpen,
      requiresAttorneyConfirmation: false,
      ready: false,
      reason: "The recorded three-business-day window remains open.",
    };
  }

  if (!input.attorneyConfirmed) {
    return {
      endDate,
      isOpen,
      requiresAttorneyConfirmation: false,
      ready: false,
      reason: "Attorney confirmation has not been recorded.",
    };
  }

  return {
    endDate,
    isOpen,
    requiresAttorneyConfirmation: false,
    ready: true,
    reason: "The recorded three-business-day window has elapsed.",
  };
}

export function evaluateMarketingReadiness(input: MarketingReadinessInput): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!input.state) missing.push("Select Massachusetts or Rhode Island.");
  if (!input.participationPath) {
    missing.push("Record whether you are acting as a principal or through a licensed pathway.");
  }
  if (!input.executedAgreement) {
    missing.push("Record an executed agreement before considering interest marketing.");
  }
  if (!input.equitableInterestRecorded) {
    missing.push("Record the contractual or equitable-interest basis.");
  }
  if (!input.legalTitleDisclosureReady) {
    missing.push("Prepare accurate disclosure that legal title is not held.");
  }
  if (!input.attorneyReviewComplete) {
    missing.push("Record review by counsel in the applicable state.");
  }
  if (input.state === "RI") {
    if (!input.sellerWindowReady) {
      missing.push("The seller cancellation window must elapse and be confirmed.");
    }
    if (!input.assigneeWindowReady) {
      missing.push("The assignee cancellation window must elapse and be confirmed.");
    }
  }
  return { ready: missing.length === 0, missing };
}

export function statePathSummary(
  state: StateCode | null,
  path: ParticipationPath | null,
): string {
  if (!state) return "Choose a state before relying on a workflow.";
  if (!path) return `Choose a principal or licensed pathway for ${state}.`;
  if (state === "MA" && path === "principal") {
    return "Massachusetts principal lane selected. Do not perform brokerage services for another person for compensation.";
  }
  if (state === "RI" && path === "principal") {
    return "Rhode Island principal lane selected. Recurring equitable-interest wholesaling defaults to licensed-path review for January 1, 2027.";
  }
  return `${state} licensed pathway selected. Record the supervising brokerage and confirm the activity is within its policies.`;
}
