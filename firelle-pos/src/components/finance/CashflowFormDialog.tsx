"use client";

import React, { useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import {
  CASHFLOW_TYPE_LABELS,
  MANUAL_CATEGORY_PRESETS,
  cashflowCategoryLabel,
  toWIBDateInput,
  type Cashflow,
  type CashflowInput,
  type CashflowType,
} from "@/types/finance";
import { formatRupiah } from "@/types/product";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface CashflowFormDialogProps {
  /** Existing manual entry when editing, or null when creating. */
  entry: Cashflow | null;
  onClose: () => void;
  onSubmit: (input: CashflowInput) => Promise<void>;
}

/**
 * Create/edit a manual cashflow entry (Module 6.2 / 6.3). Amount must be > 0,
 * a date is required (defaults to today WIB) and backdating is allowed.
 */
export function CashflowFormDialog({
  entry,
  onClose,
  onSubmit,
}: CashflowFormDialogProps) {
  const isEdit = entry !== null;

  const [type, setType] = useState<CashflowType>(entry?.type ?? "OUT");
  const [category, setCategory] = useState(entry?.category ?? "Operational Expense");
  const [customCategory, setCustomCategory] = useState(
    entry && !MANUAL_CATEGORY_PRESETS.includes(entry.category)
      ? entry.category
      : ""
  );
  const [useCustom, setUseCustom] = useState(
    entry !== null && !MANUAL_CATEGORY_PRESETS.includes(entry.category)
  );
  const [amountText, setAmountText] = useState(
    entry ? String(entry.amount) : ""
  );
  // Resolved once, when the dialog mounts: the dialog only ever renders on the
  // client (after a user action), so this must not read the clock during the
  // page prerender.
  const [dateInput, setDateInput] = useState(() =>
    entry
      ? toWIBDateInput(new Date(entry.occurred_at))
      : toWIBDateInput(new Date())
  );
  const [description, setDescription] = useState(entry?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Clear a stale error as soon as the user edits anything that feeds
  // validation. Tracked with a render-time fingerprint instead of an effect so
  // the reset does not trigger a second render pass (react-hooks/set-state-in-effect).
  const inputFingerprint = [type, category, customCategory, amountText, dateInput, useCustom].join("\u0000");
  const [lastFingerprint, setLastFingerprint] = useState(inputFingerprint);
  if (lastFingerprint !== inputFingerprint) {
    setLastFingerprint(inputFingerprint);
    setError("");
  }

  const amount = Number(amountText);
  const resolvedCategory = useCustom ? customCategory.trim() : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!resolvedCategory) {
      setError("Kategori wajib diisi");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nominal harus lebih dari 0");
      return;
    }
    if (!dateInput) {
      setError("Tanggal wajib diisi");
      return;
    }

    setSaving(true);
    try {
      // A backdated manual entry keeps the chosen WIB day at 12:00 (midday),
      // which sidesteps DST-free offset assumptions while staying on that day.
      const occurredAt =
        entry && dateInput === toWIBDateInput(new Date(entry.occurred_at))
          ? entry.occurred_at
          : new Date(`${dateInput}T12:00:00+07:00`).toISOString();

      await onSubmit({
        type,
        category: resolvedCategory,
        amount,
        occurred_at: occurredAt,
        description,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                type === "IN"
                  ? "bg-success/12 text-success-foreground"
                  : "bg-destructive/12 text-destructive"
              )}
            >
              <span className="text-sm font-bold">
                {type === "IN" ? "↓" : "↑"}
              </span>
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isEdit ? "Ubah Catatan Kas" : "Catat Kas Manual"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEdit
                  ? "Entri manual dapat diubah; baris otomatis terkunci."
                  : "Tambahkan pemasukan atau pengeluaran kas manual."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Jenis <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={type === "IN" ? "default" : "outline"}
                className={cn(
                  "h-11 justify-center gap-2",
                  type === "IN" &&
                    "bg-success text-success-foreground hover:bg-success/90"
                )}
                onClick={() => setType("IN")}
              >
                ↓ {CASHFLOW_TYPE_LABELS.IN}
              </Button>
              <Button
                type="button"
                variant={type === "OUT" ? "default" : "outline"}
                className={cn(
                  "h-11 justify-center gap-2",
                  type === "OUT" &&
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => setType("OUT")}
              >
                ↑ {CASHFLOW_TYPE_LABELS.OUT}
              </Button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-secondary-foreground">
                Kategori <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                className="text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setUseCustom((v) => !v)}
              >
                {useCustom ? "Pilih dari daftar" : "Kategori kustom"}
              </button>
            </div>
            {useCustom ? (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Contoh: Perbaikan Peralatan"
                autoFocus
              />
            ) : (
              <Select
                value={category}
                onValueChange={(value) => setCategory(value ?? "")}
              >
                <SelectTrigger className="h-11 w-full bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_CATEGORY_PRESETS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {cashflowCategoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary-foreground">
                Nominal (Rp) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step="1"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0"
              />
              {Number.isFinite(amount) && amount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {formatRupiah(amount)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-secondary-foreground">
                Tanggal (WIB) <span className="text-destructive">*</span>
              </label>
              <DatePicker
                value={dateInput}
                onChange={setDateInput}
                placeholder="Pilih tanggal"
                max={toWIBDateInput(new Date())}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Keterangan (Opsional)
            </label>
            <textarea
              className="min-h-16 w-full resize-none rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail singkat untuk audit trail..."
              rows={2}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <LuTriangleAlert size={16} className="shrink-0" />
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
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Catatan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}