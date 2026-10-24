"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuWallet,
  LuSearch,
  LuX,
  LuTriangleAlert,
  LuRotateCcw,
  LuChevronLeft,
  LuChevronRight,
  LuLock,
  LuPencil,
  LuTrash2,
  LuPlus,
  LuDownload,
  LuPrinter,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuScale,
} from "react-icons/lu";
import {
  DATE_RANGE_LABELS,
  cashflowCategoryLabel,
  resolveDateRange,
  isAutoCashflow,
  toWIBDateInput,
  type Cashflow,
  type CashflowInput,
  type CashflowType,
  type DateRangePreset,
} from "@/types/finance";
import { formatRupiah } from "@/types/product";
import { formatDateWIB, cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useDebouncedSearch, usePagination } from "@/lib/hooks";
import { useSession, useStoreSettings } from "@/lib/session";
import {
  createCashflow,
  deleteCashflow,
  getCashflowSummary,
  listCashflows,
  updateCashflow,
  type CashflowSummary,
} from "@/lib/supabase/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CashflowFormDialog } from "./CashflowFormDialog";
import { DeleteCashflowDialog } from "./DeleteCashflowDialog";

type TypeFilter = "ALL" | CashflowType;
type SourceFilter = "ALL" | "MANUAL" | "AUTO";

const DATE_PRESETS: DateRangePreset[] = [
  "TODAY",
  "THIS_WEEK",
  "THIS_MONTH",
  "CUSTOM",
];

/** Fixed operating-out categories used by the Net Profit tooltip (BR-06). */
interface ExpenseSlice {
  category: string;
  amount: number;
}

export function CashflowReport() {
  const router = useRouter();
  const { ready, role } = useSession();
  const store = useStoreSettings();

  const [rows, setRows] = useState<Cashflow[]>([]);
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [preset, setPreset] = useState<DateRangePreset>("THIS_MONTH");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const { searchTerm, setSearchTerm, debouncedTerm } = useDebouncedSearch(250);

  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Cashflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cashflow | null>(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [reconPrintedAt, setReconPrintedAt] = useState<string | null>(null);

  const isAdmin = role === "ADMIN";

  // ─── Redirect non-admins (UI gate; RLS is the real fence — AC-4) ───
  useEffect(() => {
    if (!ready) return;
    if (!role) {
      router.replace("/login");
      return;
    }
    if (role !== "ADMIN") {
      router.replace("/pos");
    }
  }, [ready, role, router]);

  const reload = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setReloadTick((n) => n + 1);
  }, []);

  // ─── Load cashflows + summary for the selected range ───
  // The range is resolved inside the effect (never during render) so the
  // prerender never reads the wall clock — Cache Components rejects that.
  useEffect(() => {
    if (!ready || !isAdmin) return;
    let active = true;

    const range = resolveDateRange(
      preset,
      { start: customStart, end: customEnd },
      new Date()
    );

    void (async () => {
      try {
        const [cashflows, sums] = await Promise.all([
          listCashflows(range),
          getCashflowSummary(range),
        ]);
        if (!active) return;
        setRows(cashflows);
        setSummary(sums);
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
  }, [ready, isAdmin, preset, customStart, customEnd, reloadTick]);

  // ─── Categories present in the current rows (for the filter dropdown) ───
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) set.add(row.category);
    return [...set].sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [rows]);

  // ─── Filtered table (cards stay on the full range — AC-5) ───
  const filtered = useMemo(() => {
    let result = rows;

    if (typeFilter !== "ALL") {
      result = result.filter((r) => r.type === typeFilter);
    }
    if (sourceFilter !== "ALL") {
      result = result.filter((r) =>
        sourceFilter === "AUTO" ? isAutoCashflow(r) : r.is_manual
      );
    }
    if (categoryFilter !== "ALL") {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (debouncedTerm) {
      const q = debouncedTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.category.toLowerCase().includes(q) ||
          cashflowCategoryLabel(r.category).toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [rows, typeFilter, sourceFilter, categoryFilter, debouncedTerm]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
  } = usePagination(filtered.length, 20);

  const paged = filtered.slice(startIndex, endIndex);

  // ─── Expenses-by-category breakdown for the chart (OUT only) ───
  const expenseBreakdown = useMemo<ExpenseSlice[]>(() => {
    const byCategory = new Map<string, number>();
    for (const row of rows) {
      if (row.type !== "OUT") continue;
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
    }
    return [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  const maxExpense = expenseBreakdown[0]?.amount ?? 0;

  // ─── Cash-drawer reconciliation (Module 6.5) ───
  const cashDrawer = useMemo(() => {
    const cashIn = rows
      .filter((r) => r.type === "IN" && r.category === "SALE")
      .reduce((sum, r) => sum + r.amount, 0);
    const cashOut = rows
      .filter((r) => r.type === "OUT")
      .reduce((sum, r) => sum + r.amount, 0);
    return { cashIn, cashOut, net: cashIn - cashOut };
  }, [rows]);

  // ─── Manual CRUD handlers ───
  const handleCreate = async (input: CashflowInput) => {
    await createCashflow(input);
    reload();
  };

  const handleUpdate = async (input: CashflowInput) => {
    if (!editEntry) return;
    await updateCashflow(editEntry.id, input);
    reload();
  };

  const handleDelete = async (id: string) => {
    await deleteCashflow(id);
    reload();
  };

  // ─── CSV export of the filtered rows (Module 6.1) ───
  const exportCsv = () => {
    const header = [
      "Tanggal",
      "Jenis",
      "Kategori",
      "Keterangan",
      "Nominal",
      "Sumber",
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        formatDateWIB(r.occurred_at),
        r.type === "IN" ? "Masuk" : "Keluar",
        cashflowCategoryLabel(r.category),
        r.description ?? "",
        String(r.amount),
        r.is_manual ? "Manual" : "Otomatis",
      ]
        .map((cell) => escape(String(cell)))
        .join(",")
    );

    const csv = [header.map(escape).join(","), ...lines].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `keuangan-${toWIBDateInput(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rangeLabel = DATE_RANGE_LABELS[preset];

  return (
    <div className="tx-page">
      {/* Header */}
      <div className="catalog-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuWallet size={26} />
            </span>
            <span>Keuangan</span>
          </h1>
          <p className="header-subtitle">
            Ringkasan arus kas, laba, dan pencatatan manual — {rangeLabel}
          </p>
        </div>
        <div className="header-actions flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={reload}
            disabled={loading}
            className="gap-2"
          >
            <LuRotateCcw size={16} />
            <span>Muat Ulang</span>
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <LuDownload size={16} />
            <span>Ekspor CSV</span>
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setEditEntry(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <LuPlus size={16} />
            <span>Catat Kas</span>
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="tx-stat-grid">
        <StatCard
          label="Total Kas Masuk"
          value={summary?.totalIn ?? 0}
          tone="in"
        />
        <StatCard
          label="Total Kas Keluar"
          value={summary?.totalOut ?? 0}
          tone="out"
        />
        <StatCard
          label="Arus Kas Bersih"
          value={summary?.netCashflow ?? 0}
          tone={(summary?.netCashflow ?? 0) >= 0 ? "in" : "out"}
        />
        <StatCard
          label="Laba Kotor (Penjualan)"
          value={summary?.grossProfit ?? 0}
          tone="neutral"
        />
        <StatCard
          label="Laba Bersih"
          value={summary?.netProfit ?? 0}
          tone={(summary?.netProfit ?? 0) >= 0 ? "in" : "out"}
          hint="Laba Kotor − biaya operasional manual (Operasional, Sewa, Utilitas, Gaji). Pembelian stok tidak dihitung karena sudah masuk HPP."
        />
      </div>

      {/* Filters */}
      <div className="catalog-toolbar flex-wrap">
        <div className="filter-buttons flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p}
              variant={preset === p ? "default" : "secondary"}
              size="sm"
              className="h-11 px-3 text-xs"
              onClick={() => setPreset(p)}
            >
              {DATE_RANGE_LABELS[p]}
            </Button>
          ))}
        </div>

        {preset === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-11 w-auto bg-card"
              aria-label="Tanggal mulai"
            />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-11 w-auto bg-card"
              aria-label="Tanggal akhir"
            />
          </div>
        )}

        <div className="relative min-w-[240px] flex-1">
          <LuSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Cari kategori atau keterangan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card pl-10 pr-11"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hapus pencarian"
              onClick={() => setSearchTerm("")}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <LuX size={14} />
            </Button>
          )}
        </div>

        <select
          className="h-11 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          aria-label="Filter jenis"
        >
          <option value="ALL">Semua Jenis</option>
          <option value="IN">Kas Masuk</option>
          <option value="OUT">Kas Keluar</option>
        </select>

        <select
          className="h-11 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          aria-label="Filter sumber"
        >
          <option value="ALL">Semua Sumber</option>
          <option value="MANUAL">Manual</option>
          <option value="AUTO">Otomatis</option>
        </select>

        <select
          className="h-11 max-w-[200px] rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter kategori"
        >
          <option value="ALL">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {cashflowCategoryLabel(c)}
            </option>
          ))}
        </select>

        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => {
            setReconPrintedAt(new Date().toISOString());
            setReconOpen(true);
          }}
        >
          <LuScale size={16} />
          <span>Kas Harian</span>
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <span className="flex items-start gap-2">
            <LuTriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={() => setActionError(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Kategori</th>
              <th>Keterangan</th>
              <th className="text-right">Nominal</th>
              <th>Sumber</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuWallet size={44} />
                  </div>
                  <p>Memuat data keuangan...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  <div className="empty-icon text-destructive" aria-hidden="true">
                    <LuTriangleAlert size={44} />
                  </div>
                  <p className="text-destructive">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={reload}
                  >
                    <LuRotateCcw size={14} />
                    <span>Coba lagi</span>
                  </Button>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuWallet size={44} />
                  </div>
                  <p>
                    {debouncedTerm
                      ? `Tidak ada catatan cocok dengan "${debouncedTerm}"`
                      : "Belum ada catatan kas pada rentang ini."}
                  </p>
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.id} className="product-row">
                  <td className="text-xs text-muted-foreground">
                    {formatDateWIB(row.occurred_at)}
                  </td>
                  <td>
                    <StatusBadge
                      variant={row.type === "IN" ? "in" : "out"}
                      label={row.type === "IN" ? "Masuk" : "Keluar"}
                    />
                  </td>
                  <td className="font-medium">
                    {cashflowCategoryLabel(row.category)}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {row.description || <span className="text-muted">—</span>}
                  </td>
                  <td className="text-right">
                    <MoneyText
                      value={row.type === "IN" ? row.amount : -row.amount}
                      direction={row.type === "IN" ? "in" : "out"}
                      showSign
                    />
                  </td>
                  <td>
                    {row.is_manual ? (
                      <Badge variant="secondary" className="text-[11px]">
                        Manual
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="gap-1 text-[11px]">
                        <LuLock size={11} aria-hidden="true" />
                        Otomatis
                      </Badge>
                    )}
                  </td>
                  <td className="actions-cell text-center">
                    {row.is_manual ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Ubah catatan"
                          aria-label="Ubah catatan manual"
                          onClick={() => {
                            setEditEntry(row);
                            setFormOpen(true);
                          }}
                        >
                          <LuPencil size={15} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Hapus catatan"
                          aria-label="Hapus catatan manual"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <LuTrash2 size={15} />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                        title="Baris otomatis terkunci (BR-05)"
                      >
                        <LuLock size={13} aria-hidden="true" />
                        Terkunci
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="pagination flex items-center justify-between pt-4">
          <span className="page-info text-xs text-muted-foreground">
            Menampilkan{" "}
            <strong className="text-foreground">
              {startIndex + 1}–{endIndex}
            </strong>{" "}
            dari <strong className="text-foreground">{filtered.length}</strong>{" "}
            catatan
          </span>
          <div className="page-controls flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 1}
              onClick={prevPage}
              aria-label="Halaman sebelumnya"
            >
              <LuChevronLeft size={16} />
            </Button>
            <span className="px-3 text-xs text-muted-foreground">
              Halaman {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === totalPages}
              onClick={nextPage}
              aria-label="Halaman selanjutnya"
            >
              <LuChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Expenses by category */}
      {expenseBreakdown.length > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-warm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Pengeluaran per Kategori
          </h2>
          <ul className="space-y-3">
            {expenseBreakdown.map((slice) => {
              const pct = maxExpense > 0 ? (slice.amount / maxExpense) * 100 : 0;
              return (
                <li key={slice.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {cashflowCategoryLabel(slice.category)}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatRupiah(slice.amount)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-destructive/70"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Manual create/edit dialog */}
      {formOpen && (
        <CashflowFormDialog
          entry={editEntry}
          onClose={() => {
            setFormOpen(false);
            setEditEntry(null);
          }}
          onSubmit={editEntry ? handleUpdate : handleCreate}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteCashflowDialog
          entry={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Daily cash-drawer closing report */}
      {reconOpen && (
        <Dialog open onOpenChange={(open) => !open && setReconOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="gap-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <LuScale size={18} />
                <span>Kas Harian</span>
              </DialogTitle>
              <DialogDescription>
                Rekap arus kas tunai untuk rentang {rangeLabel}.
              </DialogDescription>
            </DialogHeader>

            <div className="receipt-print-area">
              <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-xs">
                <div className="mb-2 text-center">
                  <div className="receipt-store-name font-heading text-base font-semibold">
                    {store?.store_name ?? "Firelle"}
                  </div>
                  <div className="text-muted-foreground">
                    Laporan Kas — {rangeLabel}
                  </div>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">
                    Kas masuk (penjualan)
                  </span>
                  <span className="font-mono text-success-foreground">
                    {formatRupiah(cashDrawer.cashIn)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Kas keluar (semua)
                  </span>
                  <span className="font-mono text-destructive">
                    −{formatRupiah(cashDrawer.cashOut)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Saldo kas bersih</span>
                  <span
                    className={cn(
                      "font-mono",
                      cashDrawer.net >= 0
                        ? "text-foreground"
                        : "text-destructive"
                    )}
                  >
                    {formatRupiah(cashDrawer.net)}
                  </span>
                </div>
                <div className="pt-2 text-[10px] text-muted-foreground">
                  Dicetak:{" "}
                  {reconPrintedAt ? formatDateWIB(reconPrintedAt) : "—"}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setReconOpen(false)}
              >
                Tutup
              </Button>
              <Button
                className="gap-1.5"
                onClick={() => window.print()}
              >
                <LuPrinter size={15} />
                <span>Cetak</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  tone: "in" | "out" | "neutral";
  hint?: string;
}

function StatCard({ label, value, tone, hint }: StatCardProps) {
  return (
    <div className="tx-stat" title={hint}>
      <div className="tx-stat-label flex items-center gap-1.5">
        {tone === "in" && <LuArrowDownLeft size={13} className="text-success" />}
        {tone === "out" && <LuArrowUpRight size={13} className="text-destructive" />}
        {tone === "neutral" && <LuWallet size={13} className="text-muted-foreground" />}
        <span>{label}</span>
        {hint && <span className="text-muted-foreground">ⓘ</span>}
      </div>
      <div
        className={cn(
          "tx-stat-value",
          tone === "in" && "text-success-foreground",
          tone === "out" && "text-destructive"
        )}
      >
        {formatRupiah(value)}
      </div>
    </div>
  );
}