'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { AuthProvider } from '@/src/auth/AuthContext';
import { OfflineProvider } from '@/src/offline/OfflineContext';
import { ToastProvider } from '@/src/components/ui/Toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <OfflineProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </OfflineProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}