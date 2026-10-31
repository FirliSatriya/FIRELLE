"use client";

import React, { useState, useMemo } from "react";
import {
  LuPlus,
  LuMinus,
  LuCircleAlert,
  LuBoxes,
} from "react-icons/lu";
import {
  Product,
  StockAdjustmentInput,
  StockAdjustmentReason,
  formatNumber,
  isDecimalUnit,
} from "@/types/product";
import { REASON_LABELS } from "@/lib/mock-data";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface StockAdjustmentDialogProps {
  product: Product;
  onClose: () => void;
  onAdjust: (
    productId: string,
    input: StockAdjustmentInput
  ) => void | Promise<void>;
}

const REASONS: StockAdjustmentReason[] = [
  "RESTOCK",
  "DAMAGED",
  "LOST",
  "STOCK_OPNAME",
  "OTHER",
];

export function StockAdjustmentDialog({
  product,
  onClose,
  onAdjust,
}: StockAdjustmentDialogProps) {
  const [form, setForm] = useState<StockAdjustmentInput>({
    direction: "add",
    qty: 0,
    reason: "RESTOCK",
    note: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const resultingStock = useMemo(() => {
    return form.direction === "add"
      ? product.stock + form.qty
      : product.stock - form.qty;
  }, [product.stock, form.direction, form.qty]);

  const isNegativeResult = resultingStock < 0;
  const isDecimal = isDecimalUnit(product.unit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.qty <= 0) {
      setError("Jumlah harus lebih dari 0");
      return;
    }

    if (!isDecimal && !Number.isInteger(form.qty)) {
      setError(`Satuan ${product.unit} tidak mendukung desimal`);
      return;
    }

    if (isNegativeResult) {
      setError("Stok tidak boleh negatif. Kurangi jumlah penyesuaian.");
      return;
    }

    setSaving(true);
    try {
      await onAdjust(product.id, form);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LuBoxes size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Penyesuaian Stok
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Perbarui jumlah stok fisik dan catat alasan audit log
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Info Card */}
        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/50 px-3.5 py-2.5">
          <span className="font-medium text-sm text-foreground">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            Stok saat ini:{" "}
            <strong className="text-foreground font-mono">
              {formatNumber(product.stock, isDecimal ? 1 : 0)} {product.unit}
            </strong>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Direction */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Arah Penyesuaian
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.direction === "add" ? "default" : "outline"}
                className={cn(
                  "h-11 justify-center gap-2",
                  form.direction === "add" && "bg-success text-success-foreground hover:bg-success/90"
                )}
                onClick={() => setForm((p) => ({ ...p, direction: "add" }))}
              >
                <LuPlus size={16} />
                <span>Tambah (Masuk)</span>
              </Button>
              <Button
                type="button"
                variant={form.direction === "deduct" ? "default" : "outline"}
                className={cn(
                  "h-11 justify-center gap-2",
                  form.direction === "deduct" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => setForm((p) => ({ ...p, direction: "deduct" }))}
              >
                <LuMinus size={16} />
                <span>Kurangi (Keluar)</span>
              </Button>
            </div>
          </div>

          {/* Qty */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Jumlah ({product.unit}) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              value={form.qty || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, qty: Number(e.target.value) }))
              }
              min={0}
              step={isDecimal ? "0.1" : "1"}
              placeholder="0"
              autoFocus
            />
          </div>

          {/* Reason (BR-12) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Alasan <span className="text-destructive">*</span>
            </label>
            <Select
              value={form.reason}
              onValueChange={(value) =>
                setForm((p) => ({
                  ...p,
                  reason: value as StockAdjustmentReason,
                }))
              }
            >
              <SelectTrigger className="h-11 w-full bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Catatan (Opsional)
            </label>
            <textarea
              className="min-h-11 w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 resize-none"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Keterangan tambahan untuk audit trail..."
              rows={2}
            />
          </div>

          {/* Stock Preview */}
          <div
            className={cn(
              "rounded-lg border border-border/70 bg-card p-3.5 space-y-2 text-xs",
              isNegativeResult && "border-destructive/50 bg-destructive/5"
            )}
          >
            <div className="flex justify-between text-muted-foreground">
              <span>Stok saat ini</span>
              <span className="font-mono text-foreground">
                {formatNumber(product.stock, isDecimal ? 1 : 0)} {product.unit}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{form.direction === "add" ? "Ditambah" : "Dikurangi"}</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  form.direction === "add" ? "text-success-foreground" : "text-destructive"
                )}
              >
                {form.direction === "add" ? "+" : "−"}
                {formatNumber(form.qty, isDecimal ? 1 : 0)} {product.unit}
              </span>
            </div>
            <div className="border-t border-border/50 pt-2 flex justify-between font-semibold">
              <span className="text-foreground">Stok akhir yang diproyeksikan</span>
              <span
                className={cn(
                  "font-mono text-sm",
                  isNegativeResult ? "text-destructive" : "text-foreground"
                )}
              >
                {formatNumber(resultingStock, isDecimal ? 1 : 0)} {product.unit}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <LuCircleAlert size={16} className="shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={saving || isNegativeResult || form.qty <= 0}
              className="gap-1.5"
            >
              <LuBoxes size={16} />
              <span>{saving ? "Menyimpan..." : "Simpan Penyesuaian"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
