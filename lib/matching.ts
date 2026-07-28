import type { BuyerRecord, DealRecord } from "./types.ts";
import { formatMoney } from "./calculations.ts";

function sameText(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function daysBetween(earlier: string, later: string): number | null {
  const earlierTime = Date.parse(`${earlier}T00:00:00Z`);
  const laterTime = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(earlierTime) || !Number.isFinite(laterTime)) return null;
  return Math.max(0, Math.floor((laterTime - earlierTime) / 86_400_000));
}

export function matchBuyer(
  deal: DealRecord,
  buyer: BuyerRecord,
  today: string,
): { score: number; reasons: string[]; conflicts: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const conflicts: string[] = [];

  if (buyer.states.includes(deal.state)) {
    score += 15;
    reasons.push(`State ${deal.state} is in the buyer’s buy box.`);
  } else {
    conflicts.push(`State ${deal.state} is outside the recorded buy box.`);
  }

  if (buyer.markets.some((market) => sameText(market, deal.city))) {
    score += 10;
    reasons.push(`${deal.city} is an exact market match.`);
  } else {
    conflicts.push(`${deal.city || "The deal city"} is not an exact recorded market.`);
  }

  if (
    buyer.propertyTypes.some((propertyType) =>
      sameText(propertyType, deal.propertyType),
    )
  ) {
    score += 10;
    reasons.push(`${deal.propertyType} matches the buyer’s property types.`);
  } else {
    conflicts.push(`${deal.propertyType || "The property type"} is outside the recorded property types.`);
  }

  if (
    deal.askingPrice !== null &&
    buyer.minPrice !== null &&
    buyer.maxPrice !== null &&
    deal.askingPrice >= buyer.minPrice &&
    deal.askingPrice <= buyer.maxPrice
  ) {
    score += 20;
    reasons.push(`${formatMoney(deal.askingPrice)} is inside the recorded price range.`);
  } else if (
    deal.askingPrice !== null &&
    buyer.minPrice !== null &&
    buyer.maxPrice !== null
  ) {
    conflicts.push(
      `${formatMoney(deal.askingPrice)} is outside the recorded ${formatMoney(buyer.minPrice)}–${formatMoney(buyer.maxPrice)} range.`,
    );
  } else {
    conflicts.push("The deal or buyer price range is incomplete.");
  }

  if (buyer.rehabTolerance.includes(deal.rehabLevel)) {
    score += 15;
    reasons.push(`${deal.rehabLevel} rehab is within tolerance.`);
  } else {
    conflicts.push(`${deal.rehabLevel} rehab exceeds the recorded tolerance.`);
  }

  const sharedStrategy = deal.strategies.find((strategy) =>
    buyer.strategies.includes(strategy),
  );
  if (sharedStrategy) {
    score += 10;
    reasons.push(`${sharedStrategy} matches a recorded strategy.`);
  } else {
    conflicts.push("No recorded exit strategy overlaps.");
  }

  const proofUnexpired =
    buyer.proofOfFundsStatus === "Verified" &&
    buyer.proofOfFundsExpiresAt !== "" &&
    buyer.proofOfFundsExpiresAt >= today;
  if (proofUnexpired) {
    score += 10;
    reasons.push("Proof of funds is recorded as verified and unexpired.");
  } else {
    conflicts.push("Proof of funds is not recorded as verified and unexpired.");
  }

  const age = daysBetween(buyer.lastVerifiedAt, today);
  if (age !== null && age <= 90) {
    score += 10;
    reasons.push(`Buyer verification is ${age} ${age === 1 ? "day" : "days"} old.`);
  } else {
    conflicts.push("Buyer verification is missing or more than 90 days old.");
  }

  return { score, reasons, conflicts };
}
