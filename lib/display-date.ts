export function formatProvenanceDate(value: string | null): string {
  if (!value) return "Unverified / unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(parsed);
}
