import type { D1Bindings } from "./d1.ts";
import { getActivePolicy, listRuns } from "./ingestion-store.ts";
import { runIngestion } from "./ingestion-runner.ts";

function localParts(now: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

export async function runDuePolicies(env: D1Bindings, now: Date): Promise<void> {
  const policy = await getActivePolicy(env.DB);
  if (!policy || !policy.policy.scheduleEnabled) return;
  const local = localParts(now);
  const targetMinutes = policy.policy.scheduleHour * 60 + policy.policy.scheduleMinute;
  const currentMinutes = local.hour * 60 + local.minute;
  if (currentMinutes < targetMinutes) return;
  const idempotencyKey = `schedule:${policy.id}:${policy.version}:${local.date}`;
  const prior = (await listRuns(env.DB, 100)).find((run) => run.idempotencyKey === idempotencyKey);
  if (prior) return;
  await runIngestion({
    db: env.DB,
    policy,
    trigger: "schedule",
    idempotencyKey,
    actorId: "scheduler",
    signal: new AbortController().signal,
  });
}

