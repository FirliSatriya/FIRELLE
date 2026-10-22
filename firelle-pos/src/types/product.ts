// ============================================================
// Product & Stock Movement Types
// Based on PRD v2.0 — Database Schema §4.B and §4.C
// ============================================================

/** Stock movement type enum (PRD §4.C) */
export type StockMovementType =
  | "INITIAL"
  | "SALE"
  | "VOID_RETURN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT";

/** Stock adjustment reason enum (BR-12) */
export type StockAdjustmentReason =
  | "RESTOCK"
  | "DAMAGED"
  | "LOST"
  | "STOCK_OPNAME"
  | "OTHER";

/** Unit types — decimal-allowed vs integer-only */
export const DECIMAL_UNITS = ["Kg", "Liter", "Meter"] as const;
export const INTEGER_UNITS = ["Pcs", "Box", "Pack"] as const;
export const ALL_UNITS = [...INTEGER_UNITS, ...DECIMAL_UNITS] as const;
export type ProductUnit = (typeof ALL_UNITS)[number] | string;

/** Stock status badge */
export type StockStatus = "OUT" | "LOW" | "WARNING" | "OK";

/** Product entity (PRD §4.B — `products` table) */
export interface Product {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  unit: ProductUnit;
  cost_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Stock movement entity (PRD §4.C — `stock_movements` table) */
export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  qty_change: number;
  stock_after: number;
  reason: StockAdjustmentReason | null;
  note: string | null;
  transaction_id: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
}

/** Form data for creating a product */
export interface CreateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  unit: ProductUnit;
  cost_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
}

/** Form data for editing a product (stock NOT editable here per PRD) */
export interface UpdateProductInput {
  name: string;
  sku?: string;
  barcode?: string;
  unit: ProductUnit;
  cost_price: number;
  selling_price: number;
  min_stock: number;
}

/** Form data for stock adjustment */
export interface StockAdjustmentInput {
  direction: "add" | "deduct";
  qty: number;
  reason: StockAdjustmentReason;
  note?: string;
}

/** Stock filter options for product list */
export type StockFilter = "ALL" | "LOW" | "OUT";

/** Sort field options */
export type ProductSortField =
  | "name"
  | "sku"
  | "unit"
  | "cost_price"
  | "selling_price"
  | "stock"
  | "created_at";

export type SortDirection = "asc" | "desc";

// ============================================================
// Utility functions
// ============================================================

/** Calculate margin % = (selling − cost) / selling × 100 */
export function calcMarginPercent(
  sellingPrice: number,
  costPrice: number
): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

/** Calculate markup % = (selling − cost) / cost × 100 */
export function calcMarkupPercent(
  sellingPrice: number,
  costPrice: number
): number {
  if (costPrice <= 0) return 0;
  return ((sellingPrice - costPrice) / costPrice) * 100;
}

/** Determine stock status badge (PRD Module 2, item 2) */
export function getStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return "OUT";
  if (stock < minStock) return "LOW";
  if (stock <= minStock * 2) return "WARNING";
  return "OK";
}

/** Format currency to IDR Rupiah */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format number with locale */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Check if a unit allows decimal quantities */
export function isDecimalUnit(unit: string): boolean {
  return (DECIMAL_UNITS as readonly string[]).includes(unit);
}
