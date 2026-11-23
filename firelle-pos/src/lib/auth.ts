/**
 * Fasad autentikasi — satu pintu untuk production (Supabase) dan demo (memori).
 *
 * `APP_MODE` adalah satu-satunya saklar: saat demo, tidak ada request ke
 * Supabase sama sekali; sesi disimpan di `sessionStorage` dan akun diperiksa
 * terhadap user demo in-memory.
 */
import { isDemoMode } from "@/lib/app-mode";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentProfile as getSupabaseProfile,
  type CurrentProfile,
} from "@/lib/supabase/products";
import {
  getDemoProfile,
  getDemoSessionUserId,
  signInDemo,
  signOutDemo,
  signUpDemo,
} from "@/lib/demo/auth";
import { subscribeDemoAuth } from "@/lib/demo/state";

export type { AppRole, CurrentProfile } from "@/types/auth";

export interface AuthUser {
  id: string;
}

export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT";

/** Sesi aktif (hanya id), atau null. */
export async function getAuthSession(): Promise<AuthUser | null> {
  if (isDemoMode()) {
    const id = getDemoSessionUserId();
    return id ? { id } : null;
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session ? { id: session.user.id } : null;
}

/** Profil staf untuk id user tersebut. */
export async function getAuthProfile(
  userId: string
): Promise<CurrentProfile | null> {
  if (isDemoMode()) return getDemoProfile(userId);
  return getSupabaseProfile(userId);
}

/**
 * Masuk. Melempar `Error` dengan pesan yang kompatibel dengan
 * `getAuthErrorMessage()` saat kredensial salah.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthUser> {
  if (isDemoMode()) {
    const id = await signInDemo(email, password);
    return { id };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.session) {
    throw new Error("Sesi tidak dapat dibuat. Coba masuk kembali.");
  }

  return { id: data.session.user.id };
}

export interface SignUpResult {
  /** Selalu terisi saat sesi langsung dibuat (demo / konfirmasi email mati). */
  user: AuthUser | null;
  /** True bila akun dibuat tetapi menunggu konfirmasi email. */
  needsConfirmation: boolean;
}

/** Daftar akun staf baru. */
export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<SignUpResult> {
  if (isDemoMode()) {
    const id = await signUpDemo(email, password, fullName);
    return { user: { id }, needsConfirmation: false };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) throw new Error(error.message);

  if (data.session) {
    return { user: { id: data.session.user.id }, needsConfirmation: false };
  }

  return { user: null, needsConfirmation: true };
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) {
    await signOutDemo();
    return;
  }

  await createClient().auth.signOut();
}

/**
 * Ikuti event auth. Hanya `SIGNED_OUT` yang diteruskan karena itulah satu-
 * satunya event yang harus mengakhiri sesi di UI.
 */
export function subscribeAuth(listener: (event: AuthEvent) => void): () => void {
  if (isDemoMode()) {
    return subscribeDemoAuth(listener);
  }

  const supabase = createClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") listener("SIGNED_OUT");
  });

  return () => subscription.unsubscribe();
}
