/**
 * Satu-satunya pintu baca environment variable aplikasi.
 *
 * Semua koneksi database (Supabase URL + publishable key) dan penanda mode
 * dibaca dari sini — tidak ada URL/API key yang di-hardcode di komponen mana
 * pun. Satu branch untuk semua mode: production memakai Supabase, demo memakai
 * data hardcoded di memori browser. Beda hanya environment variable `APP_MODE`
 * yang diset di masing-masing project deploy. Lihat README.md → "Deploy".
 *
 * Catatan Next.js:
 * - `NEXT_PUBLIC_*` di-inline saat build, jadi aman dipakai di client.
 * - `APP_MODE` hanya ada di server. Nilainya disuntikkan oleh Server Component
 *   lewat `AppModeProvider` ke client — tidak pernah di-bundle sebagai
 *   `NEXT_PUBLIC_*`, dan tidak ada kredensial demo dari environment.
 */

/** Nilai `APP_MODE` yang dikenali. Selain "demo" selalu dianggap production. */
export type AppMode = "production" | "demo";

/** Normalisasi `APP_MODE`; fail-safe ke production agar banner demo tak bocor. */
export function parseAppMode(raw: string | undefined): AppMode {
  return raw?.trim().toLowerCase() === "demo" ? "demo" : "production";
}

/** Mode aplikasi aktif (server-side). */
export function appMode(): AppMode {
  return parseAppMode(process.env.APP_MODE);
}

export function isDemoMode(): boolean {
  return appMode() === "demo";
}

export interface SupabaseEnv {
  url: string;
  key: string;
}

/**
 * Kredensial Supabase dari environment.
 *
 * Sengaja melempar error yang jelas saat env belum diisi: lebih baik gagal
 * cepat daripada diam-diam tersambung ke project yang salah.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local (lihat .env.example)."
    );
  }

  return { url, key };
}

/** Hostname Supabase untuk `images.remotePatterns` di next.config.ts. */
export function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

