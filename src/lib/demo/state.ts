/**
 * State demo in-memory (satu instance per tab).
 *
 * Semua data demo — produk, pelanggan, transaksi, kas, pengaturan, gambar —
 * disimpan di variabel module ini. Tidak ada `localStorage` untuk data: muat
 * ulang halaman mengembalikan semuanya ke `buildDemoState()`.
 *
 * Satu-satunya hal yang dipersistenkan adalah id sesi login (`sessionStorage`)
 * supaya pengguna tidak perlu login ulang saat refresh. Akun demo tetap
 * di-seed ulang dengan id yang sama.
 */
import { buildDemoState, wibDateKey, type DemoState, type DemoUser } from "./seed";

export type { DemoState, DemoUser, StoreSettingsRow, AppRole } from "./seed";

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT";

const SESSION_KEY = "firelle:demo:user";

let state: DemoState | null = null;
let idCounter = 0;

const authListeners = new Set<(event: AuthEvent) => void>();

/** State demo, di-seed sekali saat pertama kali dipakai. */
export function getDemoState(): DemoState {
  if (!state) state = buildDemoState(new Date());
  return state;
}

/** Buang semua perubahan dan mulai lagi dari data seed. */
export function resetDemoState(): void {
  state = null;
  idCounter = 0;
}

/** Salinan plain-object supaya pemanggil tidak bisa memutasi state langsung. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Id unik lokal demo (bukan UUID asli, cukup unik per tab). */
export function demoId(prefix: string): string {
  idCounter += 1;
  return `demo-${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Error dengan kontrak yang sama seperti RPC Supabase
 * (`{ code, message, details }`) agar `getErrorMessage()` tetap bekerja.
 */
export function demoError(
  code: string,
  message: string,
  details?: string
): { code: string; message: string; details?: string } {
  return details ? { code, message, details } : { code, message };
}

// ============================================================
// Sesi login
// ============================================================

function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.sessionStorage.setItem(SESSION_KEY, userId);
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* mode privat / storage penuh: sesi hanya bertahan selama render */
  }
}

/** User demo yang sedang login, atau null. */
export function currentDemoUser(): DemoUser | null {
  const userId = readSessionUserId();
  if (!userId) return null;

  const user = getDemoState().users.find((row) => row.id === userId);
  if (!user || !user.isActive) {
    writeSessionUserId(null);
    return null;
  }
  return user;
}

/** ADMIN yang sedang login, untuk operasi yang di production dibatasi RLS. */
export function requireDemoAdmin(): DemoUser {
  const user = currentDemoUser();
  if (!user) {
    throw demoError("FR009", "UNAUTHENTICATED");
  }
  if (user.role !== "ADMIN") {
    throw demoError("FR009", "FORBIDDEN", "Only an active ADMIN may do this.");
  }
  return user;
}

export function setDemoSession(userId: string): void {
  writeSessionUserId(userId);
  for (const listener of authListeners) listener("SIGNED_IN");
}

export function clearDemoSession(): void {
  writeSessionUserId(null);
  for (const listener of authListeners) listener("SIGNED_OUT");
}

export function subscribeDemoAuth(
  listener: (event: AuthEvent) => void
): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

// ============================================================
// Invoice
// ============================================================

/** Nomor invoice demo berikutnya untuk tanggal bisnis WIB tertentu. */
export function nextDemoInvoiceNumber(
  demoState: DemoState,
  date: Date = new Date()
): string {
  const key = wibDateKey(date);
  const prefix = `INV-${key}-`;
  let max = 0;

  for (const transaction of demoState.transactions) {
    if (!transaction.invoice_number.startsWith(prefix)) continue;
    const value = Number(transaction.invoice_number.slice(prefix.length));
    if (Number.isFinite(value) && value > max) max = value;
  }

  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
