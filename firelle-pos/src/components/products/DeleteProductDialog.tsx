"use client";

import React from "react";
import { LuTriangleAlert, LuArchive } from "react-icons/lu";
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

interface DeleteProductDialogProps {
  product: Product;
  onClose: () => void;
  onDelete: (productId: string) => void | Promise<void>;
}

export function DeleteProductDialog({
  product,
  onClose,
  onDelete,
}: DeleteProductDialogProps) {
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");

  const handleDelete = async () => {
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
              Arsipkan Produk
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Apakah Anda yakin ingin mengarsipkan produk{" "}
            <strong className="text-foreground font-semibold">
              &quot;{product.name}&quot;
            </strong>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p className="flex items-start gap-1.5">
            <span className="text-destructive font-bold">•</span>
            <span>Produk tidak akan muncul di POS dan daftar produk utama.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-primary font-bold">•</span>
            <span>Riwayat transaksi dan pergerakan stok yang terkait tetap tersimpan aman.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-success font-bold">•</span>
            <span>Dapat dipulihkan kapan saja melalui filter &quot;Tampilkan arsip&quot;.</span>
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

        <DialogFooter className="gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="gap-1.5"
            disabled={saving}
          >
            <LuArchive size={16} />
            <span>{saving ? "Mengarsipkan..." : "Ya, Arsipkan"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
