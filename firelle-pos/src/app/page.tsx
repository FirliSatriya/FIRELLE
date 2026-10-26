import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/navigation";

/**
 * Akar situs adalah gerbang aplikasi: pengunjung mendarat di halaman login.
 * Kalau sesinya masih valid, LoginForm sendiri yang meneruskan ke halaman
 * sesuai role (admin → /products, kasir → /pos).
 */
export default function Home() {
  redirect(LOGIN_PATH);
}
