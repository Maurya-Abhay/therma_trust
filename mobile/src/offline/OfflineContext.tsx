
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from 'react';

import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Outbox } from './Outbox';
import { SyncManager } from './SyncManager';
import { getStoredValue, setStoredValue } from '@/src/storage';
import { useAuth } from '@/src/auth/AuthContext';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  forceSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const onlineRef = useRef(true);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  const refreshPendingCount = useCallback(async () => {
    try {
      const entries = userId ? Outbox.getAll(userId) : [];

      if (mountedRef.current) {
        setPendingCount(entries.length);
      }
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }, [userId]);

  const forceSync = useCallback(async () => {
    if (!userId || !onlineRef.current || syncingRef.current) return;

    syncingRef.current = true;

    if (mountedRef.current) {
      setIsSyncing(true);
    }

    try {
      await SyncManager.syncAll(userId);

      const syncTime = new Date();

      await setStoredValue('last_sync', syncTime.toISOString());

      if (mountedRef.current) {
        setLastSync(syncTime);
      }

      await refreshPendingCount();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      syncingRef.current = false;

      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [refreshPendingCount, userId]);

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        await Outbox.init();

        await refreshPendingCount();
        if (userId && onlineRef.current && Outbox.getAll(userId).length > 0) {
          await forceSync();
        }

        const saved = await getStoredValue('last_sync');

        if (saved && mountedRef.current) {
          const parsed = new Date(saved);

          if (!Number.isNaN(parsed.getTime())) {
            setLastSync(parsed);
          }
        }
      } catch (error) {
        console.error('Offline initialization failed:', error);
      }
    };

    initialize();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true &&
        state.isInternetReachable !== false;

      const wasOffline = !onlineRef.current;

      onlineRef.current = online;

      if (mountedRef.current) {
        setIsOnline(online);
      }

      if (online && wasOffline) {
        forceSync();
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !onlineRef.current) return;
      try {
        if (userId && Outbox.getAll(userId).length > 0) void forceSync();
      } catch (error) {
        console.error('Failed to check pending offline work:', error);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [forceSync, refreshPendingCount, userId]);

  useEffect(() => {
    if (!isOnline || pendingCount === 0) return;
    const timer = setInterval(() => { void forceSync(); }, 30000);
    return () => clearInterval(timer);
  }, [forceSync, isOnline, pendingCount]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSync,
        forceSync,
        refreshPendingCount,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);

  if (!context) {
    throw new Error(
      'useOffline must be used within an OfflineProvider'
    );
  }

  return context;
}
