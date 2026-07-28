"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createEmptyData,
  LOCAL_DATA_KEY,
  validateImport,
} from "@/lib/import-export";
import type { DealFlowData } from "@/lib/types";

type DataContextValue = {
  data: DealFlowData;
  hydrated: boolean;
  updateData: (updater: (current: DealFlowData) => DealFlowData) => void;
  replaceData: (next: DealFlowData) => void;
  clearData: () => void;
};

const BOOTSTRAP_TIME = "2026-07-27T00:00:00.000Z";
const EMPTY_SERIALIZED = JSON.stringify(createEmptyData(BOOTSTRAP_TIME));
const LOCAL_CHANGE_EVENT = "tradewind-dealflow:local-change";
const DataContext = createContext<DataContextValue | null>(null);

function stamp(data: DealFlowData): DealFlowData {
  return { ...data, updatedAt: new Date().toISOString() };
}

function serverSnapshot() {
  return `server:${EMPTY_SERIALIZED}`;
}

function clientSnapshot() {
  return `client:${window.localStorage.getItem(LOCAL_DATA_KEY) ?? EMPTY_SERIALIZED}`;
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_DATA_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_CHANGE_EVENT, onStoreChange);
  };
}

function persist(data: DealFlowData) {
  window.localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

function parseSnapshot(snapshot: string): DealFlowData {
  const serialized = snapshot.slice(snapshot.indexOf(":") + 1);
  try {
    const result = validateImport(JSON.parse(serialized));
    return result.ok ? result.data : createEmptyData(BOOTSTRAP_TIME);
  } catch {
    return createEmptyData(BOOTSTRAP_TIME);
  }
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const data = useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const hydrated = snapshot.startsWith("client:");

  const updateData = useCallback(
    (updater: (current: DealFlowData) => DealFlowData) => {
      const latest = parseSnapshot(clientSnapshot());
      persist(stamp(updater(latest)));
    },
    [],
  );

  const replaceData = useCallback((next: DealFlowData) => {
    persist(stamp(next));
  }, []);

  const clearData = useCallback(() => {
    window.localStorage.removeItem(LOCAL_DATA_KEY);
    window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({ data, hydrated, updateData, replaceData, clearData }),
    [clearData, data, hydrated, replaceData, updateData],
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
