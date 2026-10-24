"use client";

import React from "react";
import { LuTriangleAlert, LuArchive } from "react-icons/lu";
import type { Client } from "@/types/client";
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

interface ArchiveClientDialogProps {
  client: Client;
  onClose: () => void;
  onArchive: (clientId: string) => void | Promise<void>;
}

export function ArchiveClientDialog({
  client,
  onClose,
  onArchive,
}: ArchiveClientDialogProps) {
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");

  const handleArchive = async () => {
    setSubmitError("");
    setSaving(true);
    try {
      await onArchive(client.id);
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
              Arsipkan Pelanggan
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            Apakah Anda yakin ingin mengarsipkan pelanggan{" "}
            <strong className="text-foreground font-semibold">
              &quot;{client.name}&quot;
            </strong>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p className="flex items-start gap-1.5">
            <span className="text-destructive font-bold">•</span>
            <span>Pelanggan tidak akan bisa dipilih di POS dan daftar utama.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-primary font-bold">•</span>
            <span>Riwayat transaksi atas nama pelanggan ini tetap tersimpan aman.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-success font-bold">•</span>
            <span>Dapat dipulihkan kapan saja melalui filter &quot;Arsip&quot;.</span>
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
            onClick={handleArchive}
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