"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/** Polling cadence for the live modules (dashboard, transaksi, keuangan). */
export const LIVE_POLL_INTERVAL = 3_000;

/**
 * Query provider for the whole app.
 *
 * The client is created lazily inside `useState` so it survives re-renders but
 * is never shared between requests during prerendering (Cache Components).
 * Defaults are tuned for a POS: one cache per page, polling handled per-query
 * by `useLiveQuery`, and no refetch-on-focus (the 3s poll already covers it).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: LIVE_POLL_INTERVAL,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
