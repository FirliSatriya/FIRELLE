"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  LuImagePlus,
  LuStar,
  LuTrash2,
  LuTriangleAlert,
  LuLoader,
} from "react-icons/lu";
import {
  type ProductImage,
  MAX_PRODUCT_IMAGES,
  validateProductImageFile,
} from "@/types/product";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import {
  deleteProductImage,
  setPrimaryProductImage,
  uploadProductImage,
} from "@/lib/supabase/product-images";
import { Button } from "@/components/ui/button";

interface ProductImageManagerProps {
  /** Null while a new product has not been created yet. */
  productId: string | null;
  images: ProductImage[];
  /** Called with the gallery after any successful add/remove/promote. */
  onChange: (images: ProductImage[]) => void;
  /**
   * When the product does not exist yet, files are queued and uploaded by the
   * parent right after the insert succeeds.
   */
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Gallery editor shared by the create and edit product dialogs.
 *
 * Existing products talk to Storage immediately. A brand-new product has no id
 * yet, so files are held in `pendingFiles` until the parent has inserted the
 * row and calls `uploadProductImage` for each of them.
 */
export function ProductImageManager({
  productId,
  images,
  onChange,
  pendingFiles = [],
  onPendingFilesChange,
  disabled = false,
}: ProductImageManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const total = images.length + pendingFiles.length;
  const full = total >= MAX_PRODUCT_IMAGES;

  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const rejected = incoming
        .map((file) => validateProductImageFile(file))
        .find((message): message is string => Boolean(message));

      if (rejected) {
        setError(rejected);
        return;
      }

      const room = MAX_PRODUCT_IMAGES - total;
      if (room <= 0) {
        setError(`Maksimal ${MAX_PRODUCT_IMAGES} gambar per produk.`);
        return;
      }

      const selected = incoming.slice(0, room);
      if (incoming.length > room) {
        setError(
          `Hanya ${room} gambar ditambahkan — batas ${MAX_PRODUCT_IMAGES} gambar per produk.`
        );
      }

      // No product row yet: queue the files for the parent to upload.
      if (!productId) {
        onPendingFilesChange?.([...pendingFiles, ...selected]);
        return;
      }

      void (async () => {
        setBusy(true);
        try {
          let next = [...images];
          for (const file of selected) {
            const created = await uploadProductImage(productId, file, {
              makePrimary: next.length === 0,
              position: next.length,
            });
            next = [...next, created];
          }
          onChange(next);
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          setBusy(false);
        }
      })();
    },
    [images, onChange, pendingFiles, productId, onPendingFilesChange, total]
  );

  const handleRemove = async (image: ProductImage) => {
    setError(null);
    setBusy(true);
    try {
      onChange(await deleteProductImage(image));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async (image: ProductImage) => {
    if (!productId || image.is_primary) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await setPrimaryProductImage(productId, image.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const locked = disabled || busy;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">
          Gambar Produk
        </label>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total}/{MAX_PRODUCT_IMAGES}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */}
            <img
              src={image.url}
              alt={image.alt_text || "Gambar produk"}
              className="size-full object-cover"
              loading="lazy"
            />
            {image.is_primary && (
              <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                <LuStar size={10} />
                <span>Utama</span>
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-foreground/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!image.is_primary && (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="secondary"
                  title="Jadikan gambar utama"
                  aria-label="Jadikan gambar utama"
                  disabled={locked}
                  onClick={() => void handlePromote(image)}
                >
                  <LuStar size={12} />
                </Button>
              )}
              <Button
                type="button"
                size="icon-xs"
                variant="destructive"
                title="Hapus gambar"
                aria-label="Hapus gambar"
                disabled={locked}
                onClick={() => void handleRemove(image)}
              >
                <LuTrash2 size={12} />
              </Button>
            </div>
          </div>
        ))}

        {pendingFiles.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="group relative aspect-square overflow-hidden rounded-lg border border-info/40 bg-info/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="size-full object-cover opacity-70"
            />
            <span className="absolute inset-x-0 bottom-0 bg-info/80 px-1 py-0.5 text-center text-[10px] font-medium text-white">
              Belum diunggah
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="destructive"
              className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
              title="Batalkan"
              aria-label="Batalkan gambar"
              disabled={locked}
              onClick={() =>
                onPendingFilesChange?.(
                  pendingFiles.filter((_, i) => i !== index)
                )
              }
            >
              <LuTrash2 size={12} />
            </Button>
          </div>
        ))}

        {!full && (
          <button
            type="button"
            disabled={locked}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!locked) acceptFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/20 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50",
              dragOver && "border-primary bg-primary/10 text-primary"
            )}
          >
            {busy ? (
              <LuLoader size={20} className="animate-spin" />
            ) : (
              <LuImagePlus size={20} />
            )}
            <span className="text-[10px] font-medium">Tambah</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) acceptFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-[11px] text-muted-foreground">
        JPG, PNG, atau WebP — maks 5 MB. Gambar &quot;Utama&quot; dipakai sebagai
        thumbnail di katalog dan kasir.
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <LuTriangleAlert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}