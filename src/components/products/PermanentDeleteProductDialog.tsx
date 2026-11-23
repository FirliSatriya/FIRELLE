"use client";

import React from "react";
import { LuTriangleAlert, LuTrash2 } from "react-icons/lu";
import { Product } from "@/types/product";
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

interface PermanentDeleteProductDialogProps {
  product: Product;
  onClose: () => void;
  onDelete: (productId: string) => void | Promise<void>;
}

/**
 * Second, stronger confirmation for a hard delete. The product name has to be
 * typed out because this action cannot be undone from the UI.
 */
export function PermanentDeleteProductDialog({
  product,
  onClose,
  onDelete,
}: PermanentDeleteProductDialogProps) {
  const [confirmation, setConfirmation] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");

  const confirmed =
    confirmation.trim().toLowerCase() === product.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!confirmed) return;
    setSubmitError("");
    setSaving(true);
    try {
      await onDelete(product.id);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2.5 text-destructive">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <LuTriangleAlert size={20} />
            </div>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Hapus Permanen
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Produk{" "}
            <strong className="text-foreground font-semibold">
              &quot;{product.name}&quot;
            </strong>{" "}
            akan dihapus dari database beserta seluruh fotonya.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p className="flex items-start gap-1.5">
            <span className="text-destructive font-bold">•</span>
            <span>Tindakan ini permanen dan tidak dapat dibatalkan.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-destructive font-bold">•</span>
            <span>Data produk, galeri foto, dan riwayat penyesuaian stoknya ikut dihapus.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-primary font-bold">•</span>
            <span>
              Produk yang sudah pernah terjual tidak dapat dihapus permanen —
              gunakan arsip agar riwayat transaksi tetap utuh.
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="permanent-delete-confirmation"
            className="text-xs font-medium text-secondary-foreground"
          >
            Ketik <strong className="text-foreground">{product.name}</strong> untuk
            mengonfirmasi
          </label>
          <Input
            id="permanent-delete-confirmation"
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={product.name}
            autoFocus
            autoComplete="off"
            disabled={saving}
          />
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

        <DialogFooter className="gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="gap-1.5"
            disabled={saving || !confirmed}
          >
            <LuTrash2 size={16} />
            <span>{saving ? "Menghapus..." : "Hapus Permanen"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
