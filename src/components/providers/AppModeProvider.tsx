"use client";

import type { ReactNode } from "react";
import type { AppMode } from "@/lib/env";
import { setRuntimeAppMode } from "@/lib/app-mode";

/**
 * Menitipkan `APP_MODE` dari Server Component (`app/layout.tsx`) ke modul data
 * di browser tanpa harus mengekspos env sebagai `NEXT_PUBLIC_*`.
 *
 * Nilainya di-set saat render — sebelum children merender query pertamanya —
 * jadi `isDemoMode()` di `src/lib/data/*` sudah benar sejak awal.
 */
export function AppModeProvider({
  mode,
  children,
}: {
  mode: AppMode;
  children: ReactNode;
}) {
  setRuntimeAppMode(mode);
  return <>{children}</>;
}
