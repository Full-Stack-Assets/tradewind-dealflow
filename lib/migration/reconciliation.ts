export type MigrationCounts = {
  total: number;
  accepted: number;
  exactDuplicates: number;
  conflicts: number;
  rejected: number;
};

export type MigrationDestinationCounts = {
  created: number;
  linkedDuplicates: number;
  openConflicts: number;
};

export type MigrationReconciliation = {
  status: "reconciled" | "not-reconciled";
  sourceTotal: number;
  accountedSourceTotal: number;
  expectedDestinationRecords: number;
  destinationCreatedRecords: number;
  issues: string[];
};

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function reconcileMigration(
  source: MigrationCounts,
  destination: MigrationDestinationCounts,
): MigrationReconciliation {
  const issues: string[] = [];
  const values = [...Object.values(source), ...Object.values(destination)];
  if (values.some((value) => !validCount(value))) {
    issues.push("Every migration count must be a non-negative safe integer.");
  }
  const accountedSourceTotal =
    source.accepted + source.exactDuplicates + source.conflicts + source.rejected;
  if (accountedSourceTotal !== source.total) {
    issues.push(`Source dispositions account for ${accountedSourceTotal} of ${source.total} records.`);
  }
  if (destination.created !== source.accepted) {
    issues.push(`Destination created ${destination.created}; expected ${source.accepted}.`);
  }
  if (destination.linkedDuplicates !== source.exactDuplicates) {
    issues.push(`Destination linked ${destination.linkedDuplicates} duplicates; expected ${source.exactDuplicates}.`);
  }
  if (destination.openConflicts !== source.conflicts) {
    issues.push(`Destination retained ${destination.openConflicts} conflicts; expected ${source.conflicts}.`);
  }
  return {
    status: issues.length === 0 ? "reconciled" : "not-reconciled",
    sourceTotal: source.total,
    accountedSourceTotal,
    expectedDestinationRecords: source.accepted,
    destinationCreatedRecords: destination.created,
    issues,
  };
}
