"use client";

import React from "react";
import {
  LuTriangleAlert,
  LuHistory,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuClock,
  LuPackage,
} from "react-icons/lu";
import {
  Product,
  StockMovement,
  formatRupiah,
  formatNumber,
  getStockStatus,
  calcMarginPercent,
  calcMarkupPercent,
  isDecimalUnit,
} from "@/types/product";
import { MOVEMENT_TYPE_LABELS, REASON_LABELS } from "@/lib/mock-data";
import { formatDateWIB, cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductDetailDrawerProps {
  product: Product;
  movements: StockMovement[];
  onClose: () => void;
}

export function ProductDetailDrawer({
  product,
  movements,
  onClose,
}: ProductDetailDrawerProps) {
  const status = getStockStatus(product.stock, product.min_stock);
  const margin = calcMarginPercent(product.selling_price, product.cost_price);
  const markup = calcMarkupPercent(product.selling_price, product.cost_price);
  const isDecimal = isDecimalUnit(product.unit);
  const isLoss = product.selling_price < product.cost_price;

  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-card border-l border-border"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border/80 bg-secondary/30">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LuPackage size={18} />
                </div>
                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                  {product.name}
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-muted-foreground">
                Detail produk, analitik margin profit, dan riwayat mutasi stok
              </SheetDescription>
            </div>
            <StockBadge status={status} />
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">SKU</span>
              <span className="text-xs font-semibold text-foreground font-mono mt-1 block">
                {product.sku || "—"}
              </span>
            </div>
            <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Barcode</span>
              <span className="text-xs font-semibold text-foreground font-mono mt-1 block truncate">
                {product.barcode || "—"}
              </span>
            </div>
            <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Satuan</span>
              <span className="text-xs font-semibold text-foreground mt-1 block">
                {product.unit}
              </span>
            </div>
            <div className="rounded-lg border border-border/70 bg-secondary/40 p-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">Min. Stok</span>
              <span className="text-xs font-semibold text-foreground font-mono mt-1 block">
                {formatNumber(product.min_stock, isDecimal ? 1 : 0)} {product.unit}
              </span>
            </div>
          </div>

          {/* Pricing & Margin Cards */}
          <Card className="border border-border/80 bg-secondary/20 shadow-none">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Harga & Profit Margin
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Harga Beli (HPP)</span>
                  <p className="text-sm font-semibold font-mono text-foreground">
                    {formatRupiah(product.cost_price)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Harga Jual</span>
                  <div className="flex items-center gap-1">
                    <p
                      className={cn(
                        "text-sm font-semibold font-mono",
                        isLoss ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {formatRupiah(product.selling_price)}
                    </p>
                    {isLoss && (
                      <LuTriangleAlert size={14} className="text-destructive" title="Harga jual di bawah HPP" />
                    )}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Margin</span>
                  <p
                    className={cn(
                      "text-sm font-semibold font-mono",
                      isLoss ? "text-destructive" : "text-success-foreground"
                    )}
                  >
                    {margin.toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Markup</span>
                  <p
                    className={cn(
                      "text-sm font-semibold font-mono",
                      isLoss ? "text-destructive" : "text-primary"
                    )}
                  >
                    {markup.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock Display Big Banner */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">Total Stok Fisik Saat Ini</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-semibold font-heading tabular-nums text-foreground tracking-tight">
                  {formatNumber(product.stock, isDecimal ? 1 : 0)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{product.unit}</span>
              </div>
            </div>
            <StockBadge status={status} />
          </div>

          {/* Stock Movements Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuHistory size={16} className="text-primary" />
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Riwayat Pergerakan Stok
                </h3>
              </div>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {sortedMovements.length} transaksi
              </Badge>
            </div>

            {sortedMovements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                Belum ada catatan mutasi pergerakan stok untuk produk ini.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMovements.map((m) => {
                  const isPositive = m.qty_change > 0;
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-1.5 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={isPositive ? "success" : "destructive"}
                          className="gap-1 text-[11px] font-normal"
                        >
                          {isPositive ? (
                            <LuArrowDownLeft size={12} />
                          ) : (
                            <LuArrowUpRight size={12} />
                          )}
                          <span>{MOVEMENT_TYPE_LABELS[m.type] || m.type}</span>
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatDateWIB(m.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span
                          className={cn(
                            "font-semibold font-mono text-sm",
                            isPositive ? "text-success-foreground" : "text-destructive"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {formatNumber(m.qty_change, isDecimal ? 1 : 0)} {product.unit}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          Sisa: <strong className="text-foreground">{formatNumber(m.stock_after, isDecimal ? 1 : 0)}</strong> {product.unit}
                        </span>
                      </div>

                      {m.reason && (
                        <p className="text-[11px] text-muted-foreground">
                          Alasan: <span className="text-foreground">{REASON_LABELS[m.reason] || m.reason}</span>
                        </p>
                      )}
                      {m.note && (
                        <p className="text-[11px] italic text-muted-foreground">
                          &quot;{m.note}&quot;
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/80">
                        Dicatat oleh: {m.created_by_name || m.created_by || "Sistem"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3.5 space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground pb-0.5">
              <LuClock size={13} className="text-muted-foreground" />
              <span>Jejak Waktu Sistem</span>
            </div>
            <p>Dibuat: {formatDateWIB(product.created_at)}</p>
            <p>Pembaruan Terakhir: {formatDateWIB(product.updated_at)}</p>
            {product.is_deleted && product.deleted_at && (
              <p className="text-destructive">Diarsipkan: {formatDateWIB(product.deleted_at)}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
