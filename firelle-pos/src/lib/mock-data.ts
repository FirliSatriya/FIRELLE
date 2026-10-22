import {
  Product,
  StockMovement,
  StockAdjustmentReason,
} from "@/types/product";

// ============================================================
// In-memory data store (frontend only — belum terhubung backend)
// Dikosongkan supaya katalog mulai dari nol dan diisi produk sendiri.
// ============================================================

export const MOCK_PRODUCTS: Product[] = [];

export const MOCK_STOCK_MOVEMENTS: StockMovement[] = [];

/** Reason labels in Indonesian */
export const REASON_LABELS: Record<StockAdjustmentReason, string> = {
  RESTOCK: "Restok",
  DAMAGED: "Barang Rusak",
  LOST: "Hilang",
  STOCK_OPNAME: "Stok Opname",
  OTHER: "Lainnya",
};

/** Movement type labels */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Stok Awal",
  SALE: "Penjualan",
  VOID_RETURN: "Pengembalian Void",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
};
