import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Masuk — Firelle POS",
  description: "Masuk ke Firelle POS.",
};

export default function LoginPage() {
  return (
    <main className="login-hero flex min-h-svh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:py-14">
        <section className="flex w-full flex-col items-center">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <Image
              src="/firelle-logo.png"
              alt=""
              width={40}
              height={50}
              className="h-11 w-auto object-contain"
              priority
            />
            <p className="font-heading text-3xl font-semibold leading-none tracking-tight text-foreground">
              FIRÉLLE
            </p>
          </div>

          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-warm-lg sm:p-8">
              <LoginForm />
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              Lupa kata sandi atau akun belum aktif? Hubungi admin toko.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
