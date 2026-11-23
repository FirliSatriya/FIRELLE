/** Peran akun aplikasi (mengikuti enum `user_role` di database). */
export type AppRole = "ADMIN" | "CASHIER";

/** Profil staf yang dipakai UI setelah login. */
export interface CurrentProfile {
  id: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}
