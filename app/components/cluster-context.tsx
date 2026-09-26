"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import type { ClusterMoniker } from "../lib/solana-client";
import { CLUSTERS } from "../lib/solana-client";
import { getExplorerUrl } from "../lib/explorer";

type ClusterContextValue = {
  cluster: ClusterMoniker;
  setCluster: (cluster: ClusterMoniker) => void;
  getExplorerUrl: (path: string) => string;
};

const ClusterContext = createContext<ClusterContextValue | null>(null);

const STORAGE_KEY = "solana-cluster";
const CLUSTER_EVENT = "solana-cluster-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CLUSTER_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CLUSTER_EVENT, onStoreChange);
  };
}

function getStoredCluster(): ClusterMoniker {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && CLUSTERS.includes(stored as ClusterMoniker)
    ? (stored as ClusterMoniker)
    : "devnet";
}

export { CLUSTERS };

export function ClusterProvider({ children }: { children: ReactNode }) {
  const cluster = useSyncExternalStore<ClusterMoniker>(
    subscribe,
    getStoredCluster,
    () => "devnet"
  );

  const setCluster = useCallback((c: ClusterMoniker) => {
    localStorage.setItem(STORAGE_KEY, c);
    window.dispatchEvent(new Event(CLUSTER_EVENT));
  }, []);

  const explorerUrl = useCallback(
    (path: string) => getExplorerUrl(path, cluster),
    [cluster]
  );

  return (
    <ClusterContext.Provider
      value={{ cluster, setCluster, getExplorerUrl: explorerUrl }}
    >
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error("useCluster must be used within ClusterProvider");
  return ctx;
}
