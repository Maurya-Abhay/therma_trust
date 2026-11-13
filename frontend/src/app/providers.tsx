"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AuthProvider } from "../auth/AuthContext";
import { OfflineProvider } from "../offline/OfflineContext";
import { API_BASE_URL } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import { ColorModeProvider } from "../ui/ColorMode";
import { ToastHost } from "../ui/Toast";
import { emitToast } from "../ui/toastBus";

export function Providers({ children }: { children: ReactNode }) {
  // "offlineFirst" makes the first request fire even when the browser reports
  // offline, so the service worker can answer from its cache; the default
  // ("online") would pause every query and the app would just sit on a spinner.
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      defaultOptions: { queries: { networkMode: "offlineFirst" }, mutations: { networkMode: "offlineFirst" } },
      // Opt-in toasts: a mutation sets `meta: { success: "Saved" }` (and
      // `toastError: true` where it has no inline error of its own).
      mutationCache: new MutationCache({
        onSuccess: (_data, _vars, _ctx, mutation) => {
          const message = mutation.meta?.success;
          if (typeof message === "string") emitToast("success", message);
          // Any save can complete a get-started step, so the checklist refreshes right away
          // instead of waiting for its cache to expire.
          void client.invalidateQueries({ queryKey: ["onboarding"] });
        },
        onError: (error, _vars, _ctx, mutation) => {
          if (mutation.meta?.toastError) emitToast("error", getErrorMessage(error));
        },
      }),
    });
    return client;
  });

  useEffect(() => {
    // The free-tier API sleeps when idle and takes up to a minute to wake. Poking it
    // as soon as the page loads means it is usually awake by the time someone signs in.
    fetch(`${API_BASE_URL}/health/`, { mode: "no-cors", cache: "no-store" }).catch(() => {
      // Purely a wake-up call; nothing depends on the answer.
    });

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app works without it; offline support is a bonus, never a requirement.
      });
    }
  }, []);

  return (
    <AppRouterCacheProvider>
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OfflineProvider>
              <ToastHost>{children}</ToastHost>
            </OfflineProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ColorModeProvider>
    </AppRouterCacheProvider>
  );
}
