"use client";

import React from "react";
import { LuX, LuUsers, LuPhone, LuMapPin, LuReceipt, LuTriangleAlert } from "react-icons/lu";
import type { Client } from "@/types/client";
import type { Transaction } from "@/types/transaction";
import { formatRupiah } from "@/types/product";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/types/transaction";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ClientDetailDrawerProps {
  client: Client;
  transactions: Transaction[];
  loadingTransactions: boolean;
  onClose: () => void;
}

export function ClientDetailDrawer({
  client,
  transactions,
  loadingTransactions,
  onClose,
}: ClientDetailDrawerProps) {
  const totalSpent = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((sum, t) => sum + (t.total_amount ?? 0), 0);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="flex-row items-center justify-between border-b border-border/60 px-5 py-4">
          <SheetTitle className="text-base font-semibold text-foreground">
            Detail Pelanggan
          </SheetTitle>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Tutup detail"
          >
            <LuX size={18} />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* ── Identity ── */}
          <div className="flex items-start gap-3.5">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-heading text-xl font-semibold">
              {(client.name.trim().charAt(0) || "?").toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-heading text-lg font-semibold text-foreground truncate">
                {client.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {client.is_walk_in ? (
                  <Badge variant="secondary" className="text-[11px]">
                    Pelanggan Umum
                  </Badge>
                ) : client.is_active ? (
                  <Badge className="bg-success/15 text-success-foreground border-success/30 text-[11px]">
                    Aktif
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Diarsipkan
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kontak & Alamat
            </h3>
            <div className="flex items-center gap-2.5 text-sm">
              <LuPhone size={16} className="shrink-0 text-muted-foreground" />
              <span className="font-mono tabular-nums text-foreground">
                {client.phone || <span className="text-muted font-sans">Belum ada nomor</span>}
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-sm">
              <LuMapPin size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-foreground">
                {client.address || <span className="text-muted">Belum ada alamat</span>}
              </span>
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ringkasan Belanja
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total transaksi</span>
              <span className="font-semibold text-foreground font-mono tabular-nums">
                {transactions.length}×
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total belanja</span>
              <span className="font-semibold text-primary font-mono tabular-nums">
                {formatRupiah(totalSpent)}
              </span>
            </div>
          </div>

          {/* ── History ── */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <LuReceipt size={16} className="text-muted-foreground" />
              Riwayat Transaksi
            </h3>

            {loadingTransactions ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-muted/60"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <LuUsers size={28} className="mx-auto text-muted" aria-hidden="true" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Belum ada transaksi atas nama pelanggan ini.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border/60 bg-card p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-foreground">
                        {t.invoice_number}
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          t.status === "VOID" ? "text-destructive" : "text-success-foreground"
                        )}
                      >
                        {t.status === "VOID" ? "Dibatalkan" : "Selesai"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-muted-foreground">
                      <span>
                        {new Date(t.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        • {PAYMENT_METHOD_LABELS[t.payment_method]}
                        {t.void_reason && (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            {" "}• <LuTriangleAlert size={12} /> {t.void_reason}
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatRupiah(t.total_amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}