import {
  createEmptyData,
  validateImport,
} from "./import-export.ts";
import type { DealFlowData } from "./types.ts";

export const LOCAL_DATA_KEY = "tradewind-dealflow:v2";
export const LEGACY_LOCAL_DATA_KEY = "tradewind-dealflow:v1";
export const MAX_WORKSPACE_BYTES = 4 * 1024 * 1024;
export const WORKSPACE_WRITE_LOCK = "tradewind-dealflow:workspace-write";

const CORRUPT_STORAGE_MESSAGE =
  "Stored browser data could not be validated. Restore a backup or clear the workspace before making changes.";
const LEGACY_STORAGE_MESSAGE =
  "A valid legacy workspace was loaded. Your next successful change will save it in the current format.";
const RECOVERED_LEGACY_MESSAGE =
  "The current workspace is damaged. A valid legacy workspace was recovered without overwriting the damaged data.";
const UNSUPPORTED_LOCK_MESSAGE =
  "This browser cannot safely save workspace changes because Web Locks are unavailable. Read and export remain available.";
const STORAGE_ACCESS_MESSAGE =
  "The workspace could not be saved because browser storage is unavailable. Check browser storage permissions and try again.";
const STORAGE_QUOTA_MESSAGE =
  "The workspace could not be saved because browser storage is full. Export a backup or free browser storage, then try again.";
const WORKSPACE_TOO_LARGE_MESSAGE =
  "The workspace is too large to save in this browser. Export a backup and remove records before trying again.";
const INVALID_MUTATION_MESSAGE =
  "The workspace change was rejected because it did not produce valid data.";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageReadResult =
  | {
      status: "empty" | "current" | "legacy" | "recovered-legacy";
      data: DealFlowData;
      message: string | null;
    }
  | {
      status: "corrupt";
      message: string;
    };

export type StorageWriteResult =
  | { ok: true; bytes: number }
  | {
      ok: false;
      code: "too-large" | "quota" | "unavailable";
      message: string;
    };

export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "unsupported-lock"
        | "corrupt"
        | "invalid"
        | "too-large"
        | "quota"
        | "unavailable";
      message: string;
    };

export type WorkspaceLockManager = {
  request<T>(
    name: string,
    callback: () => Promise<T> | T,
  ): Promise<T>;
};

function parseStoredCandidate(
  serialized: string,
  expectedVersion: 1 | 2,
  now: Date,
): DealFlowData | null {
  try {
    const raw: unknown = JSON.parse(serialized);
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("schemaVersion" in raw) ||
      raw.schemaVersion !== expectedVersion
    ) {
      return null;
    }
    const result = validateImport(raw, now);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

function readItem(
  storage: Pick<StorageLike, "getItem">,
  key: string,
): { ok: true; value: string | null } | { ok: false } {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return { ok: false };
  }
}

export function readStoredWorkspace(
  storage: Pick<StorageLike, "getItem">,
  now = new Date(),
): StorageReadResult {
  const current = readItem(storage, LOCAL_DATA_KEY);
  if (current.ok && current.value !== null) {
    const data = parseStoredCandidate(current.value, 2, now);
    if (data !== null) {
      return { status: "current", data, message: null };
    }
  }

  const legacy = readItem(storage, LEGACY_LOCAL_DATA_KEY);
  if (legacy.ok && legacy.value !== null) {
    const data = parseStoredCandidate(legacy.value, 1, now);
    if (data !== null) {
      const recoveredCurrent =
        !current.ok || (current.ok && current.value !== null);
      return {
        status: recoveredCurrent ? "recovered-legacy" : "legacy",
        data,
        message: recoveredCurrent
          ? RECOVERED_LEGACY_MESSAGE
          : LEGACY_STORAGE_MESSAGE,
      };
    }
  }

  if (
    current.ok &&
    current.value === null &&
    legacy.ok &&
    legacy.value === null
  ) {
    return {
      status: "empty",
      data: createEmptyData(now.toISOString()),
      message: null,
    };
  }

  return { status: "corrupt", message: CORRUPT_STORAGE_MESSAGE };
}

export function writeStoredWorkspace(
  storage: Pick<StorageLike, "setItem">,
  data: DealFlowData,
): StorageWriteResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: STORAGE_ACCESS_MESSAGE,
    };
  }

  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_WORKSPACE_BYTES) {
    return {
      ok: false,
      code: "too-large",
      message: WORKSPACE_TOO_LARGE_MESSAGE,
    };
  }

  try {
    storage.setItem(LOCAL_DATA_KEY, serialized);
    return { ok: true, bytes };
  } catch (error) {
    const quota =
      error instanceof DOMException
        ? error.name === "QuotaExceededError"
        : error instanceof Error && error.name === "QuotaExceededError";
    return {
      ok: false,
      code: quota ? "quota" : "unavailable",
      message: quota ? STORAGE_QUOTA_MESSAGE : STORAGE_ACCESS_MESSAGE,
    };
  }
}

export async function mutateStoredWorkspace(
  storage: StorageLike,
  locks: WorkspaceLockManager | null,
  updater: (current: DealFlowData) => DealFlowData,
  now: Date | (() => Date) = () => new Date(),
): Promise<MutationResult> {
  if (locks === null) {
    return {
      ok: false,
      code: "unsupported-lock",
      message: UNSUPPORTED_LOCK_MESSAGE,
    };
  }

  try {
    return await locks.request(WORKSPACE_WRITE_LOCK, () => {
      const mutationTime = typeof now === "function" ? now() : now;
      const latest = readStoredWorkspace(storage, mutationTime);
      if (latest.status === "corrupt") {
        return {
          ok: false,
          code: "corrupt",
          message: latest.message,
        };
      }

      let candidate: DealFlowData;
      try {
        candidate = updater(latest.data);
      } catch {
        return {
          ok: false,
          code: "invalid",
          message: INVALID_MUTATION_MESSAGE,
        };
      }

      const validation = validateImport(candidate, mutationTime);
      if (!validation.ok || candidate.schemaVersion !== 2) {
        return {
          ok: false,
          code: "invalid",
          message: INVALID_MUTATION_MESSAGE,
        };
      }

      const stamped: DealFlowData = {
        ...validation.data,
        revision: latest.data.revision + 1,
        updatedAt: mutationTime.toISOString(),
      };
      const written = writeStoredWorkspace(storage, stamped);
      if (!written.ok) {
        return {
          ok: false,
          code: written.code,
          message: written.message,
        };
      }
      return { ok: true };
    });
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: STORAGE_ACCESS_MESSAGE,
    };
  }
}

export async function clearStoredWorkspace(
  storage: StorageLike,
  locks: WorkspaceLockManager | null,
): Promise<MutationResult> {
  if (locks === null) {
    return {
      ok: false,
      code: "unsupported-lock",
      message: UNSUPPORTED_LOCK_MESSAGE,
    };
  }

  try {
    return await locks.request(WORKSPACE_WRITE_LOCK, () => {
      try {
        storage.removeItem(LOCAL_DATA_KEY);
        storage.removeItem(LEGACY_LOCAL_DATA_KEY);
        return { ok: true };
      } catch {
        return {
          ok: false,
          code: "unavailable",
          message: STORAGE_ACCESS_MESSAGE,
        };
      }
    });
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: STORAGE_ACCESS_MESSAGE,
    };
  }
}
