"use client";

import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { LIVE_POLL_INTERVAL } from "@/components/providers/QueryProvider";

/**
 * `useQuery` with the shared 3s polling cadence, for the live modules
 * (dashboard, transaksi, keuangan).
 *
 * Differences from a hand-rolled effect + `reloadTick`:
 *   - the previous data stays on screen while the next poll is in flight
 *     (`placeholderData` from the cache), so a 3s tick never flashes a spinner;
 *   - `isFetching` drives the "Muat Ulang" button, `isLoading` only covers the
 *     very first load;
 *   - polls pause while the tab is hidden (`refetchIntervalInBackground` off),
 *     so a forgotten cashier tab does not drain quota overnight.
 *
 * Pass `enabled: false` while the session is unresolved so no query fires for
 * an unknown role (RLS would reject it anyway).
 */
export function useLiveQuery<TData>(
  options: UseQueryOptions<TData, Error, TData, QueryKey>
) {
  return useQuery<TData, Error, TData, QueryKey>({
    ...options,
    refetchInterval: LIVE_POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });
}
