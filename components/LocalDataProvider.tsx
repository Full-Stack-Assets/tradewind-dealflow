"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createEmptyData } from "@/lib/import-export";
import {
  clearStoredWorkspace,
  LEGACY_LOCAL_DATA_KEY,
  LOCAL_DATA_KEY,
  mutateStoredWorkspace,
  readStoredWorkspace,
  replaceStoredWorkspace,
  type MutationResult,
  type StorageReadResult,
  type WorkspaceLockManager,
} from "@/lib/local-storage";
import type { DealFlowData } from "@/lib/types";

export type StorageStatus =
  | StorageReadResult["status"]
  | "unsupported-lock"
  | "invalid"
  | "too-large"
  | "quota"
  | "unavailable";

type DataContextValue = {
  data: DealFlowData;
  hydrated: boolean;
  updateData: (
    updater: (current: DealFlowData) => DealFlowData,
  ) => Promise<MutationResult>;
  replaceData: (next: DealFlowData) => Promise<MutationResult>;
  clearData: () => Promise<MutationResult>;
  storageStatus: StorageStatus;
  storageMessage: string | null;
  writesSupported: boolean;
};

type MutationIssue = Exclude<MutationResult, { ok: true }>;

const BOOTSTRAP_TIME = "2026-07-27T00:00:00.000Z";
const EMPTY_DATA = createEmptyData(BOOTSTRAP_TIME);
const EMPTY_SERIALIZED = JSON.stringify(EMPTY_DATA);
const LOCAL_CHANGE_EVENT = "tradewind-dealflow:local-change";
const UNSUPPORTED_LOCK_MESSAGE =
  "This browser cannot safely save workspace changes because Web Locks are unavailable. Read and export remain available.";
const DataContext = createContext<DataContextValue | null>(null);

function serverSnapshot() {
  return `server:${EMPTY_SERIALIZED}`;
}

function clientSnapshot() {
  try {
    return `client:${JSON.stringify([
      window.localStorage.getItem(LOCAL_DATA_KEY),
      window.localStorage.getItem(LEGACY_LOCAL_DATA_KEY),
    ])}`;
  } catch {
    return "client:unavailable";
  }
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === LOCAL_DATA_KEY ||
      event.key === LEGACY_LOCAL_DATA_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onStoreChange);
  };
}

function parseSnapshot(snapshot: string): StorageReadResult {
  if (snapshot.startsWith("server:")) {
    return {
      status: "empty",
      data: EMPTY_DATA,
      message: null,
    };
  }
  if (snapshot === "client:unavailable") {
    return {
      status: "corrupt",
      message:
        "Stored browser data is unavailable. Check browser storage permissions before restoring, clearing, or changing the workspace.",
    };
  }

  try {
    const [current, legacy]: [string | null, string | null] = JSON.parse(
      snapshot.slice("client:".length),
    );
    return readStoredWorkspace(
      {
        getItem(key) {
          if (key === LOCAL_DATA_KEY) return current;
          if (key === LEGACY_LOCAL_DATA_KEY) return legacy;
          return null;
        },
      },
      new Date(BOOTSTRAP_TIME),
    );
  } catch {
    return {
      status: "corrupt",
      message:
        "Stored browser data could not be validated. Restore a backup or clear the workspace before making changes.",
    };
  }
}

function getBrowserLocks(): WorkspaceLockManager | null {
  if (
    typeof navigator === "undefined" ||
    !("locks" in navigator) ||
    typeof navigator.locks?.request !== "function"
  ) {
    return null;
  }
  return {
    request<T>(name: string, callback: () => Promise<T> | T) {
      return navigator.locks.request(
        name,
        () => Promise.resolve(callback()),
      ) as Promise<T>;
    },
  };
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const readResult = useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const [mutationIssue, setMutationIssue] = useState<MutationIssue | null>(null);
  const hydrated = snapshot.startsWith("client:");
  const writesSupported = !hydrated || getBrowserLocks() !== null;
  const data =
    readResult.status === "corrupt" ? EMPTY_DATA : readResult.data;

  const finishMutation = useCallback((result: MutationResult) => {
    if (result.ok) {
      setMutationIssue(null);
      window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
    } else {
      setMutationIssue(result);
    }
    return result;
  }, []);

  const updateData = useCallback(
    async (updater: (current: DealFlowData) => DealFlowData) => {
      const result = await mutateStoredWorkspace(
        window.localStorage,
        getBrowserLocks(),
        updater,
      );
      return finishMutation(result);
    },
    [finishMutation],
  );

  const replaceData = useCallback(
    async (next: DealFlowData) => {
      const result = await replaceStoredWorkspace(
        window.localStorage,
        getBrowserLocks(),
        next,
      );
      return finishMutation(result);
    },
    [finishMutation],
  );

  const clearData = useCallback(async () => {
    const result = await clearStoredWorkspace(
      window.localStorage,
      getBrowserLocks(),
    );
    return finishMutation(result);
  }, [finishMutation]);

  const storageStatus: StorageStatus = mutationIssue
    ? mutationIssue.code
    : readResult.status === "corrupt"
      ? "corrupt"
      : !writesSupported
        ? "unsupported-lock"
        : readResult.status;
  const storageMessage = mutationIssue
    ? mutationIssue.message
    : readResult.status === "corrupt"
      ? readResult.message
      : !writesSupported
        ? UNSUPPORTED_LOCK_MESSAGE
        : readResult.message;

  const value = useMemo(
    () => ({
      data,
      hydrated,
      updateData,
      replaceData,
      clearData,
      storageStatus,
      storageMessage,
      writesSupported,
    }),
    [
      clearData,
      data,
      hydrated,
      replaceData,
      storageMessage,
      storageStatus,
      updateData,
      writesSupported,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useLocalData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useLocalData must be used inside LocalDataProvider.");
  }
  return context;
}
