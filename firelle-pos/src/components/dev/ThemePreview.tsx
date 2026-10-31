"use client";

import * as React from "react";
import {
  LuCheck,
  LuMoon,
  LuSun,
  LuPlus,
  LuCircleAlert,
  LuArchive,
  LuPackage,
  LuSparkles,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { StockBadge } from "@/components/products/StockBadge";
import { MoneyText } from "@/components/ui/money-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Swatch data — names only, colours come from CSS variables           */
/* ------------------------------------------------------------------ */

const coreSwatches = [
  { name: "background", className: "bg-background", value: "#FDFBF7" },
  { name: "foreground", className: "bg-foreground", value: "#3B2F2A" },
  { name: "card", className: "bg-card", value: "#FFFFFF" },
  { name: "primary", className: "bg-primary", value: "#7A5C45" },
  { name: "secondary", className: "bg-secondary", value: "#EFE7DA" },
  { name: "muted", className: "bg-muted", value: "#F5F0E8" },
  { name: "accent", className: "bg-accent", value: "#E6D5C3" },
  { name: "border", className: "bg-border", value: "#E7DDCF" },
  { name: "ring", className: "bg-ring", value: "#A8805F" },
  { name: "destructive", className: "bg-destructive", value: "#A94B39" },
] as const;

const semanticSwatches = [
  { name: "success", className: "bg-success", tint: "bg-success/12", value: "#6B8F6B" },
  { name: "warning", className: "bg-warning", tint: "bg-warning/12", value: "#C79A3B" },
  { name: "info", className: "bg-info", tint: "bg-info/12", value: "#7C8FA0" },
] as const;

const chartSwatches = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function ThemePreview() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    return () => root.classList.remove("dark");
  }, [dark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LuSparkles size={20} />
            </span>
            <div>
              <p className="font-heading text-xl font-semibold leading-tight">Firelle — Earth tones</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Design tokens · dev only
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setDark((v) => !v)}
            aria-pressed={dark}
            className="gap-2"
          >
            {dark ? <LuSun size={16} /> : <LuMoon size={16} />}
            <span>{dark ? "Light mode" : "Dark mode"}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-6 py-10">
        {/* ── Colour ─────────────────────────────────────────── */}
        <Section
          title="Warna"
          hint="Semua kelas Tailwind membaca HSL triplets dari globals.css — tidak ada nilai warna di komponen. Nilai hex di bawah adalah light mode; dark memakai token yang sama."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {coreSwatches.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-xl border border-border bg-card shadow-warm">
                <div className={cn("h-16 w-full border-b border-border", s.className)} />
                <div className="space-y-0.5 px-3 py-2">
                  <p className="text-xs font-semibold">--{s.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {semanticSwatches.map((s) => (
              <div key={s.name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-warm">
                <div className={cn("size-10 shrink-0 rounded-lg border border-border", s.className)} />
                <div className={cn("flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-xs font-semibold text-foreground", s.tint)}>
                  12% tint
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">--{s.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {chartSwatches.map((c, i) => (
              <div key={c} className="space-y-1">
                <div className={cn("h-16 w-20 rounded-lg border border-border", c)} />
                <p className="text-[11px] text-muted-foreground">chart-{i + 1}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Typography ─────────────────────────────────────── */}
        <Section
          title="Tipografi"
          hint="Cormorant Garamond 600 untuk judul & angka besar, DM Sans untuk UI. Semua angka memakai tabular-nums."
        >
          <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-warm">
            <p className="font-heading text-5xl font-semibold leading-none">Rp 1.250.000</p>
            <p className="font-heading text-3xl font-semibold">Judul Halaman — Katalog Produk</p>
            <p className="font-heading text-xl font-semibold">Sub-judul kartu / dialog</p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Body text DM Sans 400. Warna espresso di atas warm white, dengan muted-foreground
              yang sudah dinaikkan kontrasnya agar lolos WCAG AA 4,5:1.
            </p>
            <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Harga jual</p>
                <p className="font-mono text-base font-semibold tabular-nums">Rp 249.000</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Masuk</p>
                <MoneyText value={1250000} direction="in" showSign />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Keluar</p>
                <MoneyText value={-350000} direction="out" showSign />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Netral</p>
                <MoneyText value={89000} />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────────── */}
        <Section title="Tombol" hint="Primary mocha · secondary sand · outline border · destructive brick. Target sentuh 44px.">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-warm">
            <Button className="gap-2"><LuPlus size={16} /> Tambah Produk</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive" className="gap-2"><LuArchive size={16} /> Arsipkan</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Button size="icon" aria-label="Ikon"><LuCheck size={18} /></Button>
          </div>
        </Section>

        {/* ── Inputs ─────────────────────────────────────────── */}
        <Section title="Input & form" hint="Border hangat, focus ring selalu terlihat.">
          <div className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-warm md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nama produk</label>
              <Input placeholder="Pashmina Silk Latte" />
              <p className="text-[11px] text-muted-foreground">Teks bantuan di bawah input.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Satuan</label>
              <Select defaultValue="Pcs">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pcs">Pcs</SelectItem>
                  <SelectItem value="Meter">Meter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Harga jual</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">Rp</span>
                <Input type="number" defaultValue={249000} className="pl-9 font-mono tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Input error</label>
              <Input aria-invalid defaultValue="0" className="border-destructive ring-2 ring-destructive/20" />
              <p className="text-[11px] text-destructive">Harga jual tidak boleh negatif.</p>
            </div>
          </div>
        </Section>

        {/* ── Badges ─────────────────────────────────────────── */}
        <Section
          title="Badge stok & status"
          hint="Selalu ikon + teks + tint, aman untuk buta warna. Arsip memakai muted."
        >
          <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-warm">
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge status="OK" />
              <StockBadge status="WARNING" />
              <StockBadge status="LOW" />
              <StockBadge status="OUT" />
              <StockBadge status="ARCHIVED" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <StatusBadge variant="completed" />
              <StatusBadge variant="void" />
              <StatusBadge variant="in" />
              <StatusBadge variant="out" />
              <StatusBadge variant="low" />
              <StatusBadge variant="out-of-stock" />
              <StatusBadge variant="archived" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="muted">Muted</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </div>
        </Section>

        {/* ── Card + table + skeleton ────────────────────────── */}
        <Section title="Kartu, tabel, loading" hint="Header tabel memakai muted, hover baris sand/40, tanpa zebra.">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-warm">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow className="hover:bg-muted">
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Produk</TableHead>
                    <TableHead className="h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stok</TableHead>
                    <TableHead className="h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Harga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: "Pashmina Silk Latte", status: "OK" as const, price: 189000 },
                    { name: "Gamis Linen Mocha", status: "LOW" as const, price: 349000 },
                    { name: "Bergo Sage Daily", status: "OUT" as const, price: 79000 },
                  ].map((row) => (
                    <TableRow key={row.name} className="hover:bg-secondary/40">
                      <TableCell className="px-4 py-3 font-medium">{row.name}</TableCell>
                      <TableCell className="px-4 py-3"><StockBadge status={row.status} /></TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono tabular-nums">
                        <MoneyText value={row.price} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <Card className="shadow-warm">
                <CardHeader>
                  <CardTitle>Ringkasan hari ini</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-heading text-4xl font-semibold leading-none tabular-nums">Rp 4.820.000</p>
                  <p className="text-xs text-muted-foreground">32 transaksi · rata-rata Rp 150.000</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant="completed" label="Tutup kasir" />
                    <MoneyText value={1250000} direction="in" showSign className="text-sm" />
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-warm">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Dialog + toast ─────────────────────────────────── */}
        <Section title="Dialog & toast" hint="Dialog memakai bg-card, border hangat, shadow lembut.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-warm-lg">
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <LuCircleAlert size={20} />
                </span>
                <div className="space-y-1">
                  <p className="font-heading text-xl font-semibold">Arsipkan produk?</p>
                  <p className="text-xs text-muted-foreground">
                    Produk tidak akan muncul di POS, namun riwayat transaksi tetap tersimpan.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary">Batal</Button>
                <Button variant="destructive" className="gap-2"><LuArchive size={16} /> Ya, Arsipkan</Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-warm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/12 text-success-foreground">
                  <LuCheck size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Stok berhasil diperbarui</p>
                  <p className="text-xs text-muted-foreground">Pashmina Silk Latte · 24 Pcs</p>
                </div>
                <Badge variant="success" className="ml-auto">Tersimpan</Badge>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-warm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive">
                  <LuCircleAlert size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Gagal menyimpan</p>
                  <p className="text-xs text-muted-foreground">Periksa kembali harga dan satuan.</p>
                </div>
                <Button variant="ghost" size="sm" className="ml-auto">Tutup</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Empty state ────────────────────────────────────── */}
        <Section title="Empty state">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LuPackage size={24} />
            </span>
            <p className="text-sm font-medium">Belum ada produk</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Klik &quot;Tambah Produk&quot; untuk mulai mengisi katalog hijab dan busana.
            </p>
            <Button className="mt-2 gap-2"><LuPlus size={16} /> Tambah Produk</Button>
          </div>
        </Section>

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Token terdokumentasi di <code className="font-mono">src/styles/theme.md</code>. Halaman ini
          hanya tersedia di development.
        </p>
      </main>
    </div>
  );
}
