import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Masuk — Firelle POS",
  description: "Masuk ke Firelle POS & Mini ERP.",
};

export default function LoginPage() {
  return (
    <main className="login-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* Brand wordmark */}
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2.5">
          <Image
            src="/firelle-logo.png"
            alt="Firelle Logo"
            width={32}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
          <span className="font-heading text-4xl font-semibold leading-none tracking-tight text-foreground">
            Firelle
          </span>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">

        </p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-warm-lg sm:p-9">
        <header className="mb-7 space-y-1.5 text-center">
          <h1 className="font-heading text-3xl font-semibold text-foreground">Selamat datang</h1>
          <p className="text-sm text-muted-foreground">
            Masuk untuk mengelola katalog, stok, keuangan, dan transaksi butik Anda.
          </p>
        </header>

        <LoginForm />

        <p className="mt-7 border-t border-border pt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          Hubungi admin toko bila akun Anda belum aktif.
        </p>
      </section>

      <p className="mt-8 text-[11px] text-muted-foreground">
        © Firelle · Modest Fashion
      </p>
    </main>
  );
}
