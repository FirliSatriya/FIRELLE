/**
 * Satu-satunya pintu baca environment variable aplikasi.
 *
 * Semua koneksi database (Supabase URL + publishable key) dan penanda mode
 * dibaca dari sini — tidak ada URL/API key yang di-hardcode di komponen mana
 * pun. Dengan begitu branch `main` (production) dan `demo` bisa memakai kode
 * yang 100% sama dan hanya berbeda isi `.env.local`.
 *
 * Catatan Next.js:
 * - `NEXT_PUBLIC_*` di-inline saat build, jadi aman dipakai di client.
 * - `APP_MODE`, `DEMO_EMAIL`, `DEMO_PASSWORD` hanya ada di server. Baca nilai
 *   itu dari Server Component lalu turunkan sebagai prop ke client component.
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

export interface DemoAccount {
  email: string;
  password: string;
}

/**
 * Akun demo untuk tombol login cepat.
 *
 * Hanya dikembalikan saat `APP_MODE=demo`, jadi build production tidak pernah
 * membawa kredensial demo ke bundle. Null berarti tombolnya tidak ditampilkan.
 */
export function getDemoAccount(): DemoAccount | null {
  if (!isDemoMode()) return null;

  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) return null;

  return { email, password };
}
