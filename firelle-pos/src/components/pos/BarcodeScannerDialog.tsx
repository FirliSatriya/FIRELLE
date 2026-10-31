"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { BarcodeStringFormat } from "react-qr-barcode-scanner";
import { LuCamera, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The scanner touches `navigator.mediaDevices`, so it must never render on the
// server. `ssr: false` keeps it out of the initial bundle too.
const BarcodeScanner = dynamic(() => import("react-qr-barcode-scanner"), {
  ssr: false,
});

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once per detected barcode; `code` is the decoded text. */
  onDetected: (code: string) => void;
}

const SCAN_FORMATS = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "ITF",
  "QR_CODE",
] as BarcodeStringFormat[];

/**
 * Camera-based barcode/QR scanner, shown in a modal. Uses the device's rear
 * camera by default and only surfaces the last decoded value to the caller.
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: BarcodeScannerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* `key` remounts the scanner (and clears its transient state) on each
            open, so no reset effect is needed. */}
        {open && (
          <ScannerBody onDetected={onDetected} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScannerBody({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  // `react-webcam` freezes the browser if the video element is torn down while
  // the stream is live. We flip `stopStream` first, then close one tick later.
  const [stopStream, setStopStream] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const lastScanRef = React.useRef<{ text: string; at: number } | null>(null);

  const close = React.useCallback(() => {
    setStopStream(true);
    // Wait one tick so the stream is released before unmounting the video.
    window.setTimeout(onClose, 0);
  }, [onClose]);

  const handleUpdate = React.useCallback(
    (_error: unknown, result?: { getText: () => string }) => {
      if (!result) return;
      const text = result.getText()?.trim();
      if (!text) return;

      // Debounce duplicate frames of the same code (the scanner fires often).
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.text === text && now - last.at < 1500) return;
      lastScanRef.current = { text, at: now };

      onDetected(text);
      close();
    },
    [onDetected, close]
  );

  const handleError = React.useCallback((error: string | DOMException) => {
    const name = typeof error === "string" ? error : error.name;
    if (name === "NotAllowedError") {
      setCameraError(
        "Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi."
      );
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      setCameraError("Kamera tidak ditemukan pada perangkat ini.");
    } else {
      setCameraError(
        typeof error === "string" ? error : "Kamera gagal dibuka."
      );
    }
  }, []);

  const toggleTorch = React.useCallback(() => {
    setTorchOn((prev) => !prev);
  }, []);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LuCamera size={18} className="text-primary" />
          Pindai Barcode / QR
        </DialogTitle>
        <DialogDescription>
          Arahkan kamera ke barcode atau QR produk. Hasil pindai langsung
          ditambahkan ke keranjang.
        </DialogDescription>
      </DialogHeader>

      <div className="relative overflow-hidden rounded-lg border border-border bg-foreground/90">
        {!cameraError ? (
          <BarcodeScanner
            width="100%"
            height={280}
            facingMode="environment"
            delay={300}
            torch={torchOn}
            stopStream={stopStream}
            formats={SCAN_FORMATS}
            onUpdate={handleUpdate}
            onError={handleError}
          />
        ) : (
          <div className="flex h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
            <LuTriangleAlert size={28} className="text-destructive" />
            <p className="text-sm text-background/90">{cameraError}</p>
          </div>
        )}

        {/* Scan reticle */}
        {!cameraError && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-40 w-64 max-w-[80%] rounded-lg border-2 border-background/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTorch}
          title="Senter (jika didukung perangkat)"
        >
          {torchOn ? "Matikan Senter" : "Nyalakan Senter"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          Tutup
        </Button>
      </div>
    </>
  );
}
