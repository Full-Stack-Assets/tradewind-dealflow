type MaoInput = {
  arv: number;
  repairs: number;
  holdingClosingCosts: number;
  buyerProfit: number;
  wholesaleFee: number;
};

type CalculationSuccess = {
  ok: true;
  value: number;
  expression: string;
};

type CalculationFailure = {
  ok: false;
  errors: string[];
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

export function parseMoney(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replaceAll(",", "").replace("$", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateMao(
  input: MaoInput,
): CalculationSuccess | CalculationFailure {
  const fields: Array<[keyof MaoInput, string]> = [
    ["arv", "ARV"],
    ["repairs", "Repairs"],
    ["holdingClosingCosts", "Holding/closing costs"],
    ["buyerProfit", "Buyer profit"],
    ["wholesaleFee", "Wholesale fee"],
  ];
  const errors: string[] = [];

  for (const [key, label] of fields) {
    const value = input[key];
    if (!Number.isFinite(value)) {
      errors.push(`${label} must be a finite number.`);
    } else if (value < 0) {
      errors.push(`${label} must be zero or greater.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const value =
    input.arv -
    input.repairs -
    input.holdingClosingCosts -
    input.buyerProfit -
    input.wholesaleFee;

  return {
    ok: true,
    value,
    expression: [
      input.arv,
      input.repairs,
      input.holdingClosingCosts,
      input.buyerProfit,
      input.wholesaleFee,
    ]
      .map(formatMoney)
      .join(" − "),
  };
}

export function calculateHeuristic(
  arv: number,
  repairs: number,
  percent: number,
):
  | {
      ok: true;
      value: number;
      label: string;
      warning: string;
    }
  | CalculationFailure {
  const errors: string[] = [];
  if (!Number.isFinite(arv) || arv < 0) {
    errors.push("ARV must be a finite number that is zero or greater.");
  }
  if (!Number.isFinite(repairs) || repairs < 0) {
    errors.push("Repairs must be a finite number that is zero or greater.");
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    errors.push("Heuristic percentage must be greater than 0 and no more than 100.");
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: arv * (percent / 100) - repairs,
    label: `${percent}% rule heuristic`,
    warning:
      "A heuristic is not a valuation, appraisal, or universal acquisition rule.",
  };
}

export function buildExitComparisons(input: MaoInput, targetPrice: number) {
  const mao = calculateMao(input);
  if (!mao.ok || !Number.isFinite(targetPrice) || targetPrice < 0) return [];

  const acquisitionSpread = input.arv - input.repairs - input.holdingClosingCosts - targetPrice;
  const assignmentRoom = mao.value - targetPrice;

  return [
    {
      name: "Direct acquisition",
      amount: acquisitionSpread,
      explanation:
        "ARV less repairs, holding/closing costs, and the entered purchase price. Financing, taxes, and selling costs may still be missing.",
    },
    {
      name: "Assignment review",
      amount: assignmentRoom,
      explanation:
        "Primary MAO less the entered purchase price. This is not an assignment fee quote or evidence of a buyer.",
    },
    {
      name: "No-deal / resource",
      amount: 0,
      explanation:
        "Use when the inputs, seller priorities, legal pathway, or buyer economics do not support a responsible transaction.",
    },
  ];
}
