/**
 * Konstanta & helper routing bersama.
 *
 * Modul ini TIDAK boleh diberi "use client": nilai yang diimpor dari modul
 * client oleh server component menjadi client reference (bukan string), yang
 * merusak `redirect()` di server. Semua nilai di sini harus polos/serializable.
 */

/** Halaman login — satu-satunya tujuan redirect untuk sesi yang tidak valid. */
export const LOGIN_PATH = "/login";

/** Landing page per role: kasir menjual, admin mengelola (RBAC §2). */
export function landingFor(role: string | null | undefined): string {
  return role === "ADMIN" ? "/products" : "/pos";
}
