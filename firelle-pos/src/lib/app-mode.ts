/**
 * Mode aplikasi yang bisa dibaca dari server **dan** browser.
 *
 * `APP_MODE` sendiri tidak pernah ikut ke bundle client (hanya `NEXT_PUBLIC_*`
 * yang di-inline Next.js). Karena itu RootLayout membacanya di server lalu
 * menitipkan nilainya ke `AppModeProvider`, yang memanggil
 * `setRuntimeAppMode()` sebelum children dirender. Dengan begitu modul data
 * client (`src/lib/data/*`) tahu harus memakai Supabase atau memori demo.
 *
 * Fail-safe: apa pun selain `"demo"` dianggap production.
 */

import type { AppMode } from "@/lib/env";

let runtimeMode: AppMode | null = null;

/** Dipanggil sekali oleh `AppModeProvider` (server + client render). */
export function setRuntimeAppMode(mode: AppMode): void {
  runtimeMode = mode;
}

/** Mode aktif untuk lapisan data. */
export function currentAppMode(): AppMode {
  if (runtimeMode) return runtimeMode;

  // Fallback server (mis. dipanggil dari Server Component sebelum provider).
  return process.env.APP_MODE?.trim().toLowerCase() === "demo"
    ? "demo"
    : "production";
}

export function isDemoMode(): boolean {
  return currentAppMode() === "demo";
}
