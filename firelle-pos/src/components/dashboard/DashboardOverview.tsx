"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LuLayoutDashboard,
  LuRotateCcw,
  LuTriangleAlert,
  LuShoppingCart,
  LuPackage,
  LuUsers,
  LuWallet,
  LuReceipt,
  LuTrendingUp,
  LuTrendingDown,
  LuArrowRight,
  LuPackageSearch,
} from "react-icons/lu";
import {
  formatRupiah,
  formatNumber,
  getStockStatus,
  getPrimaryImageUrl,
  type Product,
} from "@/types/product";
import {
  PAYMENT_METHOD_LABELS,
  type Transaction,
} from "@/types/transaction";
import { formatDateWIB, cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { listProducts } from "@/lib/supabase/products";
import { listTransactions } from "@/lib/supabase/transactions";
import {
  getCashflowSummary,
  type CashflowSummary,
} from "@/lib/supabase/finance";
import { resolveDateRange } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/products/StockBadge";

export function DashboardOverview() {
  const { ready, role, profile } = useSession();
  const isAdmin = role === "ADMIN";

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Resolved after mount so prerendering never reads the wall clock.
  const [todayKey, setTodayKey] = useState("");

  useEffect(() => {
    setTodayKey(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
        new Date()
      )
    );
  }, [reloadTick]);

  const reload = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!ready || !role) return;
    let active = true;

    void (async () => {
      try {
        const [productList, txnList, cashflow] = await Promise.all([
          listProducts(role),
          listTransactions(200),
          isAdmin
            ? getCashflowSummary(resolveDateRange("THIS_MONTH", undefined, new Date()))
            : Promise.resolve(null),
        ]);
        if (!active) return;
        setProducts(productList.filter((p) => !p.is_deleted));
        setTransactions(txnList);
        setSummary(cashflow);
        setLoadError(null);
      } catch (err) {
        if (active) setLoadError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [ready, role, isAdmin, reloadTick]);

  // ─── Today's sales, derived from the WIB calendar day ───
  const todayStats = useMemo(() => {
    if (!todayKey) {
      return { revenue: 0, count: 0, avg: 0 };
    }

    const todays = transactions.filter(
      (t) => t.status === "COMPLETED" && wibDateKey(t.created_at) === todayKey
    );

    const revenue = todays.reduce((sum, t) => sum + t.total_amount, 0);
    const items = todays.length;

    return {
      revenue,
      count: items,
      avg: items ? revenue / items : 0,
    };
  }, [transactions, todayKey]);

  const lowStock = useMemo(
    () =>
      products
        .filter((p) => getStockStatus(p.stock, p.min_stock) !== "OK")
        .sort((a, b) => a.stock - b.stock),
    [products]
  );

  const recentTransactions = useMemo(
    () => transactions.slice(0, 6),
    [transactions]
  );

  const topProducts = useMemo(() => {
    // Rank by stock value is unavailable to cashiers (no cost data), so we
    // surface the deepest stock instead — useful for both roles.
    return [...products].sort((a, b) => b.stock - a.stock).slice(0, 5);
  }, [products]);

  const lowStockCount = lowStock.filter(
    (p) => getStockStatus(p.stock, p.min_stock) === "LOW"
  ).length;
  const outStockCount = lowStock.filter((p) => p.stock <= 0).length;

  const displayName = profile?.fullName?.split(" ")[0] ?? "Admin";

  return (
    <div className="tx-page">
      {/* Header */}
      <div className="catalog-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuLayoutDashboard size={26} />
            </span>
            <span>Dashboard</span>
          </h1>
          <p className="header-subtitle">
            Selamat datang kembali, {displayName}. Ringkasan butik Firélle hari
            ini.
          </p>
        </div>
        <div className="header-actions">
          <Button
            variant="secondary"
            onClick={reload}
            disabled={loading}
            className="gap-2"
          >
            <LuRotateCcw size={16} />
            <span>Muat Ulang</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <LuTriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="tx-stat-grid">
        <KpiCard
          label="Penjualan Hari Ini"
          value={formatRupiah(todayStats.revenue)}
          icon={<LuShoppingCart size={15} />}
          tone="primary"
        />
        <KpiCard
          label="Transaksi Hari Ini"
          value={formatNumber(todayStats.count)}
          icon={<LuReceipt size={15} />}
        />
        <KpiCard
          label="Rata-rata / Transaksi"
          value={formatRupiah(todayStats.avg)}
          icon={<LuTrendingUp size={15} />}
        />
        <KpiCard
          label={isAdmin ? "Laba Bersih (Bulan Ini)" : "Produk Aktif"}
          value={
            isAdmin
              ? formatRupiah(summary?.netProfit ?? 0)
              : formatNumber(products.length)
          }
          icon={isAdmin ? <LuWallet size={15} /> : <LuPackage size={15} />}
          tone={
            isAdmin ? ((summary?.netProfit ?? 0) >= 0 ? "in" : "out") : undefined
          }
        />
      </div>

      {/* Admin cashflow strip */}
      {isAdmin && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <MiniStat
            label="Kas Masuk"
            value={summary?.totalIn ?? 0}
            tone="in"
          />
          <MiniStat
            label="Kas Keluar"
            value={summary?.totalOut ?? 0}
            tone="out"
          />
          <MiniStat
            label="Arus Kas Bersih"
            value={summary?.netCashflow ?? 0}
            tone={(summary?.netCashflow ?? 0) >= 0 ? "in" : "out"}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          href="/pos"
          label="Mulai Transaksi"
          hint="Buka layar kasir"
          icon={<LuShoppingCart size={18} />}
        />
        <QuickAction
          href="/transactions"
          label="Riwayat Transaksi"
          hint="Lihat & cetak struk"
          icon={<LuReceipt size={18} />}
        />
        <QuickAction
          href="/products"
          label="Kelola Produk"
          hint={
            lowStockCount > 0
              ? `${lowStockCount} produk menipis`
              : "Katalog & stok"
          }
          icon={<LuPackage size={18} />}
          highlight={lowStockCount > 0}
        />
        <QuickAction
          href="/clients"
          label="Data Klien"
          hint="Direktori pelanggan"
          icon={<LuUsers size={18} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent transactions */}
        <section className="rounded-xl border border-border bg-card shadow-warm">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
              <LuReceipt size={17} className="text-primary" />
              <span>Transaksi Terbaru</span>
            </h2>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Lihat semua
              <LuArrowRight size={13} />
            </Link>
          </header>

          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-11 rounded-lg" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                <LuReceipt size={40} />
              </div>
              <p>Belum ada transaksi tercatat.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentTransactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-foreground">
                        {t.invoice_number}
                      </span>
                      {t.status === "VOID" && (
                        <StatusBadge variant="void" className="text-[10px]" />
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {t.client_name} •{" "}
                      {PAYMENT_METHOD_LABELS[t.payment_method]} •{" "}
                      {t.created_at ? formatDateWIB(t.created_at) : "—"}
                    </div>
                  </div>
                  <MoneyText
                    value={t.total_amount}
                    className={cn(
                      "shrink-0 text-sm",
                      t.status === "VOID" && "text-muted-foreground line-through"
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock watchlist */}
        <section className="rounded-xl border border-border bg-card shadow-warm">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
              <LuTriangleAlert size={17} className="text-warning" />
              <span>Perlu Restok</span>
            </h2>
            {(lowStockCount > 0 || outStockCount > 0) && (
              <div className="flex items-center gap-1.5">
                {outStockCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {outStockCount} habis
                  </Badge>
                )}
                {lowStockCount > 0 && (
                  <Badge variant="warning" className="text-[10px]">
                    {lowStockCount} menipis
                  </Badge>
                )}
              </div>
            )}
          </header>

          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-11 rounded-lg" />
              ))}
            </div>
          ) : lowStock.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                <LuPackageSearch size={40} />
              </div>
              <p>Semua stok dalam kondisi aman.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.slice(0, 6).map((p) => {
                const status = getStockStatus(p.stock, p.min_stock);
                const thumb = getPrimaryImageUrl(p);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="product-thumb size-9 shrink-0">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
                        <img src={thumb} alt={p.name} loading="lazy" />
                      ) : (
                        <span className="product-thumb-empty" aria-hidden="true">
                          <LuPackage size={16} />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Stok {formatNumber(p.stock, 1)} {p.unit} • min{" "}
                        {formatNumber(p.min_stock, 0)}
                      </div>
                    </div>
                    <StockBadge status={status} className="shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Top stock (by quantity) */}
      {!loading && topProducts.length > 0 && (
        <section className="mt-5 rounded-xl border border-border bg-card shadow-warm">
          <header className="border-b border-border px-5 py-3.5">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
              <LuTrendingUp size={17} className="text-success" />
              <span>Stok Terbanyak</span>
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {topProducts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {p.name}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {p.sku || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatRupiah(p.selling_price)}
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {formatNumber(p.stock, 1)} {p.unit}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** WIB calendar day key (`YYYY-MM-DD`), matching `Asia/Jakarta`. */
function wibDateKey(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "primary" | "in" | "out";
}

function KpiCard({ label, value, icon, tone }: KpiCardProps) {
  return (
    <div className="tx-stat">
      <div className="tx-stat-label flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex",
            tone === "in" && "text-success",
            tone === "out" && "text-destructive",
            tone === "primary" && "text-primary",
            !tone && "text-muted-foreground"
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "tx-stat-value",
          tone === "in" && "text-success-foreground",
          tone === "out" && "text-destructive"
        )}
      >
        {value}
      </div>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: number;
  tone: "in" | "out";
}

function MiniStat({ label, value, tone }: MiniStatProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-warm-sm">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {tone === "in" ? (
          <LuTrendingUp size={13} className="text-success" />
        ) : (
          <LuTrendingDown size={13} className="text-destructive" />
        )}
        {label}
      </span>
      <MoneyText value={value} direction={tone} className="text-sm font-semibold" />
    </div>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function QuickAction({ href, label, hint, icon, highlight }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-warm-sm transition-all hover:-translate-y-0.5 hover:border-ring/45 hover:shadow-warm-md",
        highlight && "border-warning/40"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground",
          highlight && "bg-warning/12 text-warning-foreground"
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {hint}
        </span>
      </span>
    </Link>
  );
}