import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { isReachable, reportReachable, subscribeReachable } from "./connectivity";
import { addItem, listItems, removeItem, type OutboxItem } from "./outbox";
import { flushOutbox } from "./sync";

interface OfflineValue {
  online: boolean;
  syncing: boolean;
  pending: OutboxItem[];
  notice: string | null;
  clearNotice: () => void;
  enqueueReport: (jobId: number, payload: unknown, label: string) => Promise<void>;
  syncNow: (retryFailed?: boolean) => Promise<void>;
  discard: (id: number) => Promise<void>;
}

const OfflineContext = createContext<OfflineValue | undefined>(undefined);

const POLL_MS = 15_000; // while offline or with reports waiting
const IDLE_CHECK_MS = 30_000; // otherwise just keep an eye on whether the server is still there
const REFRESH_AFTER_SYNC = ["service-reports", "my-jobs", "job", "cylinders", "alerts"];

// Any real answer from the app proves the server is reachable. The health
// endpoint needs no login and the service worker never caches it. A gateway
// error (502/503/504) means the host is up but the app behind it is asleep or
// restarting, which is the same as being offline for our purposes.
async function pingServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/health/`, { cache: "no-store" });
    reportReachable(![502, 503, 504].includes(response.status));
  } catch {
    reportReachable(false);
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [reachable, setReachable] = useState(isReachable());
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const online = browserOnline && reachable;

  const refresh = useCallback(async () => {
    setPending(userId ? await listItems(userId) : []);
  }, [userId]);

  const syncNow = useCallback(
    async (retryFailed = false) => {
      if (!userId) return;
      setSyncing(true);
      try {
        const result = await flushOutbox(userId, retryFailed);
        await refresh();
        if (result.synced > 0) {
          setNotice(`${result.synced} offline report${result.synced === 1 ? "" : "s"} sent.`);
          REFRESH_AFTER_SYNC.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
        }
      } finally {
        setSyncing(false);
      }
    },
    [userId, refresh, queryClient]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const goOnline = () => {
      setBrowserOnline(true);
      void pingServer();
    };
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const unsubscribe = subscribeReachable(setReachable);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      unsubscribe();
    };
  }, []);

  const hasQueued = pending.some((item) => !item.error);

  // Send as soon as the server is reachable again.
  useEffect(() => {
    if (online && hasQueued) void syncNow();
  }, [online, hasQueued, syncNow]);

  // While down (or while something is stuck behind a 5xx) keep checking. When
  // idle and online, still check occasionally: the service worker can answer
  // reads from its cache, so nothing else would notice the server vanishing.
  useEffect(() => {
    const busy = !online || hasQueued;
    const timer = window.setInterval(() => {
      if (!online) void pingServer();
      else if (hasQueued) void syncNow();
      else void pingServer();
    }, busy ? POLL_MS : IDLE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [online, hasQueued, syncNow]);

  // Re-check the moment the tab becomes visible again (e.g. back from a plant room).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void pingServer();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const enqueueReport = useCallback(
    async (jobId: number, payload: unknown, label: string) => {
      if (!userId) throw new Error("Not signed in");
      await addItem({ userId, kind: "service_report", jobId, label, payload, createdAt: new Date().toISOString() });
      await refresh();
      setNotice("You're offline - report saved on this device. It will be sent automatically when you're back online.");
    },
    [userId, refresh]
  );

  const discard = useCallback(
    async (id: number) => {
      await removeItem(id);
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<OfflineValue>(
    () => ({ online, syncing, pending, notice, clearNotice: () => setNotice(null), enqueueReport, syncNow, discard }),
    [online, syncing, pending, notice, enqueueReport, syncNow, discard]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}

