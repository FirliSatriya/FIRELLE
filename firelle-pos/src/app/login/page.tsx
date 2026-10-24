import type { Metadata } from "next";
import Image from "next/image";
import {
  LuChartLine,
  LuPackageCheck,
  LuScanBarcode,
  LuShieldCheck,
} from "react-icons/lu";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Masuk — Firelle POS",
  description: "Masuk ke Firelle POS & Mini ERP.",
};

const highlights = [
  {
    icon: LuScanBarcode,
    title: "Kasir yang cepat",
    description: "Transaksi, pembayaran, dan struk selesai dalam hitungan detik.",
  },
  {
    icon: LuPackageCheck,
    title: "Stok yang terkendali",
    description: "Pantau katalog dan peringatan stok menipis tanpa catatan terpisah.",
  },
  {
    icon: LuChartLine,
    title: "Laporan yang rapi",
    description: "Arus kas dan performa penjualan tersaji dalam satu tampilan.",
  },
] as const;

export default function LoginPage() {
  return (
    <main className="login-hero flex min-h-svh flex-col">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,30rem)] lg:gap-16 lg:py-14">
        {/* Brand story — desktop only */}
        <section className="hidden flex-col gap-10 lg:flex">
          <div className="flex items-center gap-3">
            <Image
              src="/firelle-logo.png"
              alt=""
              width={48}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
            <div>
              <p className="font-heading text-2xl font-semibold leading-none tracking-tight text-foreground">
                FIRÉLLE
              </p>
              <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Modest Fashion · POS
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <LuShieldCheck size={13} className="text-primary" aria-hidden="true" />
              Mini ERP untuk butik modest fashion
            </span>

            <div className="space-y-3">
              <h1 className="max-w-lg font-heading text-5xl font-semibold leading-[1.08] tracking-tight text-foreground xl:text-6xl">
                Rapi dari kasir, stok, sampai laporan.
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Firelle menyatukan transaksi, katalog, pelanggan, dan keuangan
                dalam satu alur kerja yang tenang — dibuat mengikuti ritme butik
                Anda.
              </p>
            </div>

            <ul className="max-w-md space-y-4 border-t border-border pt-6">
              {highlights.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-warm">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Form — shared across breakpoints */}
        <section className="flex w-full flex-col items-center">
          <div className="mb-7 flex flex-col items-center gap-3 text-center lg:hidden">
            <Image
              src="/firelle-logo.png"
              alt=""
              width={40}
              height={50}
              className="h-11 w-auto object-contain"
              priority
            />
            <div>
              <p className="font-heading text-3xl font-semibold leading-none tracking-tight text-foreground">
                FIRÉLLE
              </p>
              <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Modest Fashion · POS
              </p>
            </div>
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

      <footer className="px-4 pb-6 text-center text-[11px] text-muted-foreground">
        © Firelle · Modest Fashion
      </footer>
    </main>
  );
}
