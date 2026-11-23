import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/navigation";

/**
 * This route never renders UI — it only issues a redirect, so it can never
 * produce an instant navigation target or a non-empty static shell. Opting out
 * keeps Cache Components' `instant` validation from failing on it.
 */
export const instant = false;

/**
 * Akar situs adalah gerbang aplikasi: pengunjung mendarat di halaman login.
 * Kalau sesinya masih valid, LoginForm sendiri yang meneruskan ke halaman
 * sesuai role (admin → /products, kasir → /pos).
 */
export default function Home() {
  redirect(LOGIN_PATH);
}
