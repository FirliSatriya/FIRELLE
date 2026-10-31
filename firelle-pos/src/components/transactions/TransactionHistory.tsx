"use client";

import React, { useMemo, useState } from "react";
import {
  LuReceipt,
  LuSearch,
  LuX,
  LuTriangleAlert,
  LuRotateCcw,
  LuChevronLeft,
  LuChevronRight,
  LuEye,
  LuBan,
  LuPrinter,
} from "react-icons/lu";
import {
  PAYMENT_METHOD_LABELS,
  type Transaction,
  type TransactionItem,
} from "@/types/transaction";
import { formatRupiah, formatNumber } from "@/types/product";
import { formatDateWIB, cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useDebouncedSearch, usePagination } from "@/lib/hooks";
import { useSession, useStoreSettings } from "@/lib/session";
import { useLiveQuery } from "@/lib/use-live-query";
import {
  listTransactions,
  listTransactionItems,
  voidTransaction,
} from "@/lib/supabase/transactions";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/components/ui/money-text";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Receipt } from "@/components/pos/PaymentDialog";

type StatusFilter = "ALL" | "COMPLETED" | "VOID";

export function TransactionHistory() {
  const { ready, role, userId } = useSession();
  const store = useStoreSettings();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useLiveQuery<Transaction[]>({
    queryKey: ["transactions", userId],
    enabled: ready && Boolean(userId),
    queryFn: () => listTransactions(200),
  });

  const transactions = useMemo(() => data ?? [], [data]);
  const loading = isLoading;
  const loadError = error ? getErrorMessage(error) : null;

  const [actionError, setActionError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const { searchTerm, setSearchTerm, debouncedTerm } = useDebouncedSearch(250);

  const [detail, setDetail] = useState<Transaction | null>(null);
  const [detailItems, setDetailItems] = useState<TransactionItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const canVoid = role === "ADMIN";

  const filtered = useMemo(() => {
    let result = transactions;

    if (statusFilter !== "ALL") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (debouncedTerm) {
      const q = debouncedTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.invoice_number.toLowerCase().includes(q) ||
          t.client_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [transactions, statusFilter, debouncedTerm]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
  } = usePagination(filtered.length, 20);

  const paged = filtered.slice(startIndex, endIndex);

  // ─── Summary stats (over the whole visible scope, ignoring search) ───
  const stats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === "COMPLETED");
    const voided = transactions.filter((t) => t.status === "VOID");
    const revenue = completed.reduce((sum, t) => sum + t.total_amount, 0);
    return {
      count: completed.length,
      revenue,
      voided: voided.length,
      avg: completed.length ? revenue / completed.length : 0,
    };
  }, [transactions]);

  const openDetail = async (transaction: Transaction) => {
    setDetail(transaction);
    setDetailItems([]);
    setDetailLoading(true);
    try {
      const items = await listTransactionItems(transaction.id);
      setDetailItems(items);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const updated = await voidTransaction(voidTarget.id, voidReason);
      // Refresh immediately so the void shows up without waiting for the next
      // 3s tick.
      await refetch();
      setVoidTarget(null);
      setVoidReason("");
      if (detail?.id === updated.id) setDetail(updated);
    } catch (err) {
      setVoidError(getErrorMessage(err));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="tx-page">
      {/* Header */}
      <div className="catalog-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuReceipt size={26} />
            </span>
            <span>Riwayat Transaksi</span>
          </h1>
          <p className="header-subtitle">
            {stats.count} transaksi selesai
            {stats.voided > 0 && (
              <span className="text-destructive">
                {" "}
                • {stats.voided} dibatalkan
              </span>
            )}
            {role === "CASHIER" && (
              <span className="text-muted"> • menampilkan transaksi Anda</span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <ButtonGroup aria-label="Aksi riwayat transaksi">
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <LuRotateCcw size={16} />
              <span>Muat Ulang</span>
            </Button>
          </ButtonGroup>
        </div>
      </div>

      {/* Stats */}
      <div className="tx-stat-grid">
        <div className="tx-stat">
          <div className="tx-stat-label">Total Pendapatan</div>
          <div className="tx-stat-value">
            {formatRupiah(stats.revenue)}
          </div>
        </div>
        <div className="tx-stat">
          <div className="tx-stat-label">Transaksi Selesai</div>
          <div className="tx-stat-value">{formatNumber(stats.count)}</div>
        </div>
        <div className="tx-stat">
          <div className="tx-stat-label">Rata-rata / Transaksi</div>
          <div className="tx-stat-value">{formatRupiah(stats.avg)}</div>
        </div>
        <div className="tx-stat">
          <div className="tx-stat-label">Dibatalkan</div>
          <div className="tx-stat-value text-destructive">
            {formatNumber(stats.voided)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="catalog-toolbar">
        <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
          <LuSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Cari no. invoice atau nama pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-11 bg-card"
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

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger
            className="h-11 w-full min-w-0 sm:w-auto sm:min-w-[9.5rem]"
            aria-label="Filter status transaksi"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua</SelectItem>
            <SelectItem value="COMPLETED">Selesai</SelectItem>
            <SelectItem value="VOID">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
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
              <th>No. Invoice</th>
              <th>Waktu</th>
              <th>Pelanggan</th>
              <th>Kasir</th>
              <th>Metode</th>
              <th className="text-right">Subtotal</th>
              <th className="text-right">Diskon</th>
              <th className="text-right">Total</th>
              <th>Status</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuReceipt size={44} />
                  </div>
                  <p>Memuat riwayat transaksi...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={10} className="empty-state">
                  <div className="empty-icon text-destructive" aria-hidden="true">
                    <LuTriangleAlert size={44} />
                  </div>
                  <p className="text-destructive">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => void refetch()}
                  >
                    <LuRotateCcw size={14} />
                    <span>Coba lagi</span>
                  </Button>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuReceipt size={44} />
                  </div>
                  <p>
                    {debouncedTerm
                      ? `Tidak ada transaksi cocok dengan "${debouncedTerm}"`
                      : "Belum ada transaksi tercatat."}
                  </p>
                </td>
              </tr>
            ) : (
              paged.map((t) => (
                <tr
                  key={t.id}
                  className={cn(
                    "product-row",
                    t.status === "VOID" && "archived-row"
                  )}
                >
                  <td className="font-mono text-xs font-medium">
                    {t.invoice_number}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {t.created_at ? formatDateWIB(t.created_at) : "—"}
                  </td>
                  <td>{t.client_name}</td>
                  <td className="text-xs">
                    {t.cashier_name || (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge variant="secondary" className="text-[11px]">
                      {PAYMENT_METHOD_LABELS[t.payment_method]}
                    </Badge>
                  </td>
                  <td className="text-right mono">
                    {formatRupiah(t.subtotal_amount)}
                  </td>
                  <td className="text-right mono">
                    {t.discount_amount > 0 ? (
                      <span className="text-destructive">
                        −{formatRupiah(t.discount_amount)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <MoneyText value={t.total_amount} />
                  </td>
                  <td>
                    <StatusBadge
                      variant={t.status === "VOID" ? "void" : "completed"}
                    />
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons flex items-center justify-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Lihat detail"
                        aria-label={`Detail ${t.invoice_number}`}
                        onClick={() => void openDetail(t)}
                      >
                        <LuEye size={15} />
                      </Button>
                      {canVoid && t.status === "COMPLETED" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Batalkan transaksi"
                          aria-label={`Batalkan ${t.invoice_number}`}
                          className="hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setVoidTarget(t);
                            setVoidReason("");
                            setVoidError(null);
                          }}
                        >
                          <LuBan size={15} />
                        </Button>
                      )}
                    </div>
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
            transaksi
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

      {/* Detail dialog */}
      {detail && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="gap-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="font-mono text-base">
                  {detail.invoice_number}
                </span>
                <StatusBadge
                  variant={detail.status === "VOID" ? "void" : "completed"}
                />
              </DialogTitle>
              <DialogDescription>
                {detail.created_at ? formatDateWIB(detail.created_at) : "—"} •{" "}
                {detail.client_name}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-card">
              {detailLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Memuat item...
                </div>
              ) : detailItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Tidak ada detail item.
                </div>
              ) : (
                <div className="receipt-print-area">
                  <Receipt
                    transaction={{
                      invoice_number: detail.invoice_number,
                      client_name: detail.client_name,
                      created_at: detail.created_at,
                      payment_method: detail.payment_method,
                      subtotal_amount: detail.subtotal_amount,
                      discount_amount: detail.discount_amount,
                      total_amount: detail.total_amount,
                      amount_paid: detail.amount_paid,
                      change_amount: detail.change_amount,
                      status: detail.status,
                      cashier_name: detail.cashier_name,
                    }}
                    items={detailItems.map((i) => ({
                      product_name: i.product_name,
                      qty: i.qty,
                      unit: i.unit,
                      selling_price: i.selling_price,
                      subtotal: i.subtotal,
                    }))}
                    store={store}
                  />
                </div>
              )}
            </div>

            {detail.status === "VOID" && detail.void_reason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <strong>Alasan pembatalan:</strong> {detail.void_reason}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                className="gap-1.5"
                onClick={() => window.print()}
              >
                <LuPrinter size={15} />
                <span>Cetak</span>
              </Button>
              {canVoid && detail.status === "COMPLETED" && (
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => {
                    setVoidTarget(detail);
                    setDetail(null);
                    setVoidReason("");
                    setVoidError(null);
                  }}
                >
                  <LuBan size={15} />
                  <span>Batalkan</span>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Void dialog */}
      {voidTarget && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !voiding) setVoidTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="gap-1.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
                  <LuBan size={19} />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    Batalkan Transaksi
                  </DialogTitle>
                  <DialogDescription>
                    {voidTarget.invoice_number} — stok akan dikembalikan dan
                    kas dicatat sebagai pengeluaran.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary-foreground">
                Alasan Pembatalan <span className="text-destructive">*</span>
              </label>
              <textarea
                className="min-h-20 w-full resize-none rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                value={voidReason}
                onChange={(e) => {
                  setVoidReason(e.target.value);
                  setVoidError(null);
                }}
                placeholder="Contoh: salah input produk, pelanggan membatalkan..."
                rows={3}
              />
            </div>

            {voidError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <LuTriangleAlert size={15} className="mt-0.5 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setVoidTarget(null)}
                disabled={voiding}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={voiding || voidReason.trim().length === 0}
                onClick={() => void handleVoid()}
                className="gap-1.5"
              >
                <LuBan size={15} />
                <span>{voiding ? "Membatalkan..." : "Batalkan Transaksi"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}