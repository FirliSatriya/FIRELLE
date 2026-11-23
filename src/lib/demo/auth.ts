/**
 * Auth demo — sepenuhnya di memori, tanpa Supabase.
 *
 * Kredensial diperiksa terhadap `DemoState.users`. Akun demo bawaan:
 * demo@firelle.com / demo12345. Pendaftaran baru membuat CASHIER aktif di
 * memori (hilang lagi saat halaman dimuat ulang).
 */
import type { CurrentProfile } from "@/types/auth";
import {
  clearDemoSession,
  currentDemoUser,
  demoId,
  getDemoState,
  setDemoSession,
} from "./state";

/** Profil untuk id user demo, atau null bila akun tidak ada/nonaktif. */
export async function getDemoProfile(
  userId: string
): Promise<CurrentProfile | null> {
  const user = getDemoState().users.find((row) => row.id === userId);
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
}

export function getDemoSessionUserId(): string | null {
  return currentDemoUser()?.id ?? null;
}

/**
 * Masuk dengan kredensial demo. Pesan error sengaja memakai teks Supabase
 * ("Invalid login credentials") agar `getAuthErrorMessage()` menerjemahkannya.
 */
export async function signInDemo(
  email: string,
  password: string
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const user = getDemoState().users.find(
    (row) => row.email.toLowerCase() === normalized
  );

  if (!user || user.password !== password) {
    throw new Error("Invalid login credentials");
  }

  setDemoSession(user.id);
  return user.id;
}

/** Daftar akun demo baru sebagai CASHIER aktif lalu langsung masuk. */
export async function signUpDemo(
  email: string,
  password: string,
  fullName: string
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const users = getDemoState().users;

  if (users.some((row) => row.email.toLowerCase() === normalized)) {
    throw new Error("User already registered");
  }

  const user = {
    id: demoId("user"),
    email: normalized,
    password,
    fullName: fullName.trim() || "Demo Staff",
    role: "CASHIER" as const,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  setDemoSession(user.id);
  return user.id;
}

export async function signOutDemo(): Promise<void> {
  clearDemoSession();
}
