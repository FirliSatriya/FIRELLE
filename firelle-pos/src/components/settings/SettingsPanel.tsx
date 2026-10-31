"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuBoxes,
  LuCheck,
  LuReceipt,
  LuRotateCcw,
  LuSettings,
  LuStore,
  LuTriangleAlert,
} from "react-icons/lu";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import {
  getStoreSettings,
  updateStoreSettings,
  RECEIPT_PAPER_OPTIONS,
  type ReceiptPaper,
  type StoreSettingsRow,
} from "@/lib/supabase/settings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsForm {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  receiptPaper: ReceiptPaper;
  allowNegativeStock: boolean;
  lowStockDefault: string;
}

function toForm(row: StoreSettingsRow): SettingsForm {
  return {
    storeName: row.store_name,
    storeAddress: row.store_address ?? "",
    storePhone: row.store_phone ?? "",
    receiptFooter: row.receipt_footer ?? "",
    receiptPaper: row.receipt_paper as ReceiptPaper,
    allowNegativeStock: row.allow_negative_stock,
    lowStockDefault: String(row.low_stock_default),
  };
}

export function SettingsPanel() {
  const router = useRouter();
  const { ready, role } = useSession();
  const isAdmin = role === "ADMIN";

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [savedForm, setSavedForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // ─── Settings is ADMIN-only; cashiers fall back to the POS (AC-4). ───
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

  // ─── Load the singleton row ───
  useEffect(() => {
    if (!ready || !isAdmin) return;
    let active = true;

    void (async () => {
      try {
        const row = await getStoreSettings();
        if (!active) return;
        setForm(toForm(row));
        setSavedForm(toForm(row));
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
  }, [ready, isAdmin, reloadTick]);

  // Let the "saved" confirmation fade out on its own.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setReloadTick((n) => n + 1);
  }, []);

  const dirty = useMemo(() => {
    if (!form || !savedForm) return false;
    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFormError(null);
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;

    const storeName = form.storeName.trim();
    if (!storeName) {
      setFormError("Nama toko wajib diisi.");
      return;
    }

    const lowStockDefault = Number(form.lowStockDefault);
    if (!Number.isFinite(lowStockDefault) || lowStockDefault < 0) {
      setFormError("Batas stok minimum harus berupa angka 0 atau lebih.");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const row = await updateStoreSettings({
        store_name: storeName,
        store_address: form.storeAddress.trim() || null,
        store_phone: form.storePhone.trim() || null,
        receipt_footer: form.receiptFooter.trim() || null,
        receipt_paper: form.receiptPaper,
        allow_negative_stock: form.allowNegativeStock,
        low_stock_default: lowStockDefault,
      });
      const next = toForm(row);
      setForm(next);
      setSavedForm(next);
      setSaved(true);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!savedForm) return;
    setForm(savedForm);
    setFormError(null);
    setSaved(false);
  };

  return (
    <div className="tx-page">
      <div className="catalog-header mx-auto max-w-3xl">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuSettings size={26} />
            </span>
            <span>Pengaturan</span>
          </h1>
          <p className="header-subtitle">
            Identitas toko, struk, dan preferensi inventori.
          </p>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mx-auto max-w-3xl rounded-xl border border-destructive/25 bg-card p-6 shadow-warm"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <LuTriangleAlert size={18} />
            <span>Pengaturan gagal dimuat</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={reload}
            className="mt-4 gap-2"
          >
            <LuRotateCcw size={16} />
            <span>Coba Lagi</span>
          </Button>
        </div>
      ) : loading || !form || !savedForm ? (
        <SettingsSkeleton />
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
          <Section
            icon={<LuStore size={18} />}
            title="Identitas Toko"
            description="Nama dan kontak yang tampil pada struk serta laporan."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nama Toko"
                htmlFor="store-name"
                required
                className="sm:col-span-2"
              >
                <Input
                  id="store-name"
                  value={form.storeName}
                  onChange={(e) => update("storeName", e.target.value)}
                  placeholder="Firelle"
                  autoComplete="organization"
                  maxLength={120}
                />
              </Field>

              <Field label="Nomor Telepon" htmlFor="store-phone">
                <Input
                  id="store-phone"
                  type="tel"
                  value={form.storePhone}
                  onChange={(e) => update("storePhone", e.target.value)}
                  placeholder="0812 3456 7890"
                  autoComplete="tel"
                  maxLength={40}
                />
              </Field>

              <Field label="Alamat" htmlFor="store-address">
                <Input
                  id="store-address"
                  value={form.storeAddress}
                  onChange={(e) => update("storeAddress", e.target.value)}
                  placeholder="Jl. Contoh No. 1, Jakarta"
                  autoComplete="street-address"
                  maxLength={200}
                />
              </Field>
            </div>
          </Section>

          <Section
            icon={<LuReceipt size={18} />}
            title="Struk"
            description="Atur kertas dan catatan penutup pada struk pembayaran."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ukuran Kertas"
                htmlFor="receipt-paper"
                className="sm:col-span-2"
              >
                <Select
                  value={form.receiptPaper}
                  onValueChange={(value) =>
                    update("receiptPaper", value as ReceiptPaper)
                  }
                >
                  <SelectTrigger id="receipt-paper" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIPT_PAPER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Catatan Penutup"
                htmlFor="receipt-footer"
                hint="Contoh: Terima kasih telah berbelanja."
                className="sm:col-span-2"
              >
                <textarea
                  id="receipt-footer"
                  value={form.receiptFooter}
                  onChange={(e) => update("receiptFooter", e.target.value)}
                  placeholder="Terima kasih telah berbelanja."
                  rows={3}
                  maxLength={300}
                  className="min-h-20 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </Field>
            </div>
          </Section>

          <Section
            icon={<LuBoxes size={18} />}
            title="Inventori"
            description="Preferensi default untuk pengelolaan stok produk."
          >
            <div className="space-y-4">
              <Field
                label="Batas Stok Minimum Default"
                htmlFor="low-stock-default"
                hint="Dipakai sebagai ambang peringatan stok rendah pada produk baru."
              >
                <Input
                  id="low-stock-default"
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  value={form.lowStockDefault}
                  onChange={(e) => update("lowStockDefault", e.target.value)}
                  className="max-w-40"
                />
              </Field>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3">
                <div>
                  <p
                    id="allow-negative-stock-label"
                    className="text-xs font-medium text-foreground"
                  >
                    Izinkan Stok Minus
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Kasir dapat menjual melebihi stok tersedia. Biarkan mati
                    untuk mencegahnya.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.allowNegativeStock}
                  aria-labelledby="allow-negative-stock-label"
                  onClick={() =>
                    update("allowNegativeStock", !form.allowNegativeStock)
                  }
                  className={cn(
                    "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
                    form.allowNegativeStock
                      ? "border-primary bg-primary"
                      : "border-border bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow-warm transition-transform",
                      form.allowNegativeStock && "translate-x-5"
                    )}
                  />
                </button>
              </div>
            </div>
          </Section>

          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <LuTriangleAlert size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {saved && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/12 p-3 text-xs text-success-foreground"
            >
              <LuCheck size={16} className="shrink-0" />
              <span>Pengaturan tersimpan.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {dirty && !saved && (
              <span className="mr-auto text-xs text-warning-foreground">
                Perubahan belum disimpan.
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              disabled={!dirty || saving}
              className="gap-2"
            >
              <LuRotateCcw size={16} />
              <span>Batalkan</span>
            </Button>
            <Button
              type="submit"
              disabled={!dirty || saving}
              className="gap-2"
            >
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-warm">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-secondary-foreground"
      >
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5 shadow-warm"
        >
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        </div>
      ))}
    </div>
  );
}
