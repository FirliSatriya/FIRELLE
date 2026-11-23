"use client";

import React, { useState } from "react";
import { LuTriangleAlert, LuUserPlus, LuPencil } from "react-icons/lu";
import type { Client, ClientInput } from "@/types/client";
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

interface ClientFormDialogProps {
  /** Present when editing; null when creating. */
  client?: Client | null;
  onClose: () => void;
  onSubmit: (input: ClientInput) => void | Promise<void>;
}

export function ClientFormDialog({
  client = null,
  onClose,
  onSubmit,
}: ClientFormDialogProps) {
  const isEdit = Boolean(client);

  const [form, setForm] = useState<ClientInput>({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    address: client?.address ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const updateField = <K extends keyof ClientInput>(
    key: K,
    value: ClientInput[K]
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
    if (!form.name.trim()) errs.name = "Nama pelanggan wajib diisi";
    if (form.phone && form.phone.trim() && form.phone.replace(/\D/g, "").length < 7) {
      errs.phone = "Nomor telepon tidak valid";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        phone: form.phone?.trim() || undefined,
        address: form.address?.trim() || undefined,
      });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isEdit ? <LuPencil size={18} /> : <LuUserPlus size={20} />}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                {isEdit ? "Ubah Data Pelanggan" : "Tambah Pelanggan Baru"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEdit
                  ? "Perbarui nama, nomor telepon, atau alamat pelanggan"
                  : "Simpan data pelanggan agar dapat dipilih saat transaksi POS"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Nama Pelanggan <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              className={cn(errors.name && "border-destructive ring-destructive/20")}
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Contoh: Ayu Lestari / Ibu Rahma"
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nomor Telepon</label>
            <Input
              type="tel"
              className={cn(errors.phone && "border-destructive ring-destructive/20")}
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="0812-3456-7890"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Alamat</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Jl. Mawar No. 12, Jakarta Selatan"
            />
            <p className="text-[11px] text-muted-foreground">
              Opsional — berguna untuk pengiriman atau catatan pesanan khusus.
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
              {isEdit ? <LuPencil size={16} /> : <LuUserPlus size={16} />}
              <span>{saving ? "Menyimpan..." : "Simpan"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}