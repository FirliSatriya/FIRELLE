/**
 * Kredensial akun demo bawaan.
 *
 * Modul terpisah tanpa data seed supaya form login bisa menampilkan tombol
 * "Masuk sebagai demo" tanpa ikut membundel seluruh data demo.
 */
export const DEMO_ACCOUNT = {
  email: "demo@firelle.com",
  password: "demo12345",
  fullName: "Demo Admin",
  role: "ADMIN" as const,
};
