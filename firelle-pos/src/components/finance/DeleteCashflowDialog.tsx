"use client";

import React, { useState } from "react";
import { LuTriangleAlert, LuTrash2 } from "react-icons/lu";
import { formatRupiah } from "@/types/product";
import {
  cashflowCategoryLabel,
  type Cashflow,
} from "@/types/finance";
import { getErrorMessage } from "@/lib/errors";
import { formatDateWIB } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteCashflowDialogProps {
  entry: Cashflow;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

/** Confirmation dialog for deleting a manual entry (Module 6.4). */
export function DeleteCashflowDialog({
  entry,
  onClose,
  onConfirm,
}: DeleteCashflowDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(entry.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
              <LuTrash2 size={19} />
            </div>
            <div>
              <DialogTitle className="text-lg">Hapus Catatan Kas</DialogTitle>
              <DialogDescription>
                Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/50 p-3.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kategori</span>
            <span className="font-medium text-foreground">
              {cashflowCategoryLabel(entry.category)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tanggal</span>
            <span className="text-foreground">
              {formatDateWIB(entry.occurred_at)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nominal</span>
            <span className="font-mono font-semibold text-foreground">
              {entry.type === "IN" ? "+" : "−"}
              {formatRupiah(entry.amount)}
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <LuTriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            <LuTrash2 size={15} />
            <span>{deleting ? "Menghapus..." : "Hapus"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}