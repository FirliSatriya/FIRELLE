"use client";

import React, { useState, useMemo } from "react";
import {
  LuPlus,
  LuList,
  LuTriangleAlert,
  LuCheck,
  LuPencil,
} from "react-icons/lu";
import {
  Product,
  UpdateProductInput,
  ALL_UNITS,
  calcMarginPercent,
  calcMarkupPercent,
  formatRupiah,
} from "@/types/product";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditProductDialogProps {
  product: Product;
  onClose: () => void;
  onSave: (updated: Product) => void | Promise<void>;
}

export function EditProductDialog({
  product,
  onClose,
  onSave,
}: EditProductDialogProps) {
  const [form, setForm] = useState<UpdateProductInput>({
    name: product.name,
    sku: product.sku || "",
    barcode: product.barcode || "",
    unit: product.unit,
    cost_price: product.cost_price,
    selling_price: product.selling_price,
    min_stock: product.min_stock,
  });
  const [customUnit, setCustomUnit] = useState("");
  const [useCustomUnit, setUseCustomUnit] = useState(
    !ALL_UNITS.includes(product.unit as typeof ALL_UNITS[number])
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const margin = useMemo(
    () => calcMarginPercent(form.selling_price, form.cost_price),
    [form.selling_price, form.cost_price]
  );
  const markup = useMemo(
    () => calcMarkupPercent(form.selling_price, form.cost_price),
    [form.selling_price, form.cost_price]
  );
  const isLoss = form.selling_price > 0 && form.selling_price < form.cost_price;

  const updateField = <K extends keyof UpdateProductInput>(
    key: K,
    value: UpdateProductInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Nama produk wajib diisi";
    const unit = useCustomUnit ? customUnit.trim() : form.unit;
    if (!unit) errs.unit = "Satuan wajib diisi";
    if (form.cost_price < 0) errs.cost_price = "Harga beli tidak boleh negatif";
    if (form.selling_price < 0) errs.selling_price = "Harga jual tidak boleh negatif";
    if (form.min_stock < 0) errs.min_stock = "Stok minimum tidak boleh negatif";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    const unit = useCustomUnit ? customUnit.trim() : form.unit;
    setSaving(true);
    try {
      await onSave({
        ...product,
        name: form.name.trim(),
        sku: form.sku?.trim() || null,
        barcode: form.barcode?.trim() || null,
        unit,
        cost_price: form.cost_price,
        selling_price: form.selling_price,
        min_stock: form.min_stock,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LuPencil size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Edit Produk
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ubah informasi nama, barcode, harga, atau ketentuan stok minimum
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Nama Produk <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              className={cn(errors.name && "border-destructive ring-destructive/20")}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* SKU & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">SKU</label>
              <Input
                type="text"
                value={form.sku}
                onChange={(e) => updateField("sku", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Barcode</label>
              <Input
                type="text"
                value={form.barcode}
                onChange={(e) => updateField("barcode", e.target.value)}
              />
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Satuan <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              {!useCustomUnit ? (
                <select
                  className="h-11 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  value={form.unit}
                  onChange={(e) => updateField("unit", e.target.value)}
                >
                  {ALL_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type="text"
                  className={cn("flex-1", errors.unit && "border-destructive")}
                  value={customUnit || form.unit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 px-3 shrink-0 gap-1.5"
                onClick={() => setUseCustomUnit(!useCustomUnit)}
              >
                {useCustomUnit ? (
                  <>
                    <LuList size={14} />
                    <span>Pilih Preset</span>
                  </>
                ) : (
                  <>
                    <LuPlus size={14} />
                    <span>Kustom</span>
                  </>
                )}
              </Button>
            </div>
            {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Harga Beli (HPP) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="number"
                  className={cn("pl-9 font-mono tabular-nums", errors.cost_price && "border-destructive")}
                  value={form.cost_price || ""}
                  onChange={(e) => updateField("cost_price", Number(e.target.value))}
                  min={0}
                  step="100"
                />
              </div>
              {errors.cost_price && <p className="text-xs text-destructive">{errors.cost_price}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Harga Jual <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="number"
                  className={cn("pl-9 font-mono tabular-nums", errors.selling_price && "border-destructive")}
                  value={form.selling_price || ""}
                  onChange={(e) => updateField("selling_price", Number(e.target.value))}
                  min={0}
                  step="100"
                />
              </div>
              {errors.selling_price && <p className="text-xs text-destructive">{errors.selling_price}</p>}
            </div>
          </div>

          {/* Margin preview */}
          {form.cost_price > 0 && form.selling_price > 0 && (
            <div
              className={cn(
                "rounded-lg border p-3 text-xs transition-colors",
                isLoss
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary/50 text-foreground"
              )}
            >
              {isLoss ? (
                <div className="flex items-start gap-2">
                  <LuTriangleAlert size={16} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-destructive">Perhatian:</strong> Harga jual di bawah harga beli! Rugi{" "}
                    <strong className="font-mono tabular-nums text-destructive">{formatRupiah(form.cost_price - form.selling_price)}</strong> per unit.
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Margin:</span>
                    <span className="font-semibold text-success font-mono tabular-nums">{margin.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-px bg-border/60" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Markup:</span>
                    <span className="font-semibold text-primary font-mono tabular-nums">{markup.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-px bg-border/60" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Profit/Unit:</span>
                    <span className="font-semibold text-success font-mono tabular-nums">
                      {formatRupiah(form.selling_price - form.cost_price)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Min Stock */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Stok Minimum</label>
            <Input
              type="number"
              className={cn(errors.min_stock && "border-destructive")}
              value={form.min_stock}
              onChange={(e) => updateField("min_stock", Number(e.target.value))}
              min={0}
            />
            <p className="text-[11px] text-muted-foreground">
              Stok saat ini: <strong className="text-foreground tabular-nums">{product.stock} {product.unit}</strong> (kelola melalui tombol &quot;Sesuaikan Stok&quot;)
            </p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <LuTriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-3">
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
              className="gap-1.5"
              disabled={saving}
            >
              <LuCheck size={16} />
              <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
