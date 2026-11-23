import type { StockAdjustmentReason } from "@/types/product";

/** Alasan penyesuaian stok (label UI). */
export const REASON_LABELS: Record<StockAdjustmentReason, string> = {
  RESTOCK: "Restok",
  DAMAGED: "Barang Rusak",
  LOST: "Hilang",
  STOCK_OPNAME: "Stok Opname",
  OTHER: "Lainnya",
};

/** Jenis pergerakan stok (label UI). */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Stok Awal",
  SALE: "Penjualan",
  VOID_RETURN: "Pengembalian Void",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
};
