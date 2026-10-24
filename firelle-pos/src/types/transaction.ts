// ============================================================
// POS / Transaction Types
// Based on PRD v2.0 — Database Schema §4.D/§4.E and the
// create_transaction / void_transaction RPC contracts.
// ============================================================

import type { Database } from "./database.types";

/** Payment methods (PRD BR-07) */
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "QRIS", "TRANSFER"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
};

/** Transaction status */
export type TransactionStatus = Database["public"]["Enums"]["txn_status"];

/** Client entity (PRD §4.A — `clients` table) */
export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  is_walk_in: boolean;
  is_active: boolean;
}

/** Cart line held in the POS screen, before it is sent to the RPC. */
export interface CartItem {
  product_id: string;
  name: string;
  unit: string;
  selling_price: number;
  /** Signed on-hand stock at the time the line was added (for the guard). */
  stock: number;
  /** Decimal unit (Kg/Liter/Meter) → qty may have decimals. */
  is_decimal: boolean;
  qty: number;
  /** Absolute Rupiah discount applied to this line. */
  discount_amount: number;
}

/**
 * One line of the payload sent to `create_transaction`. The RPC re-reads
 * prices and costs from `products`; `unit_price` is only an optimistic
 * concurrency guard (FR003 PRICE_CHANGED).
 */
export interface CheckoutItemInput {
  product_id: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
}

export interface CheckoutInput {
  client_id: string | null;
  items: CheckoutItemInput[];
  payment_method: PaymentMethod;
  amount_paid: number;
  discount_amount: number;
  notes?: string;
}

/** Transaction summary — the cashier-safe view returned by the RPC. */
export interface Transaction {
  id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
  status: TransactionStatus;
  notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  created_by: string | null;
  /** Full name of the cashier — resolved from the session or a users lookup. */
  cashier_name: string | null;
  created_at: string;
}

/** Immutable line snapshot (PRD §4.E — `transaction_items`). */
export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  qty: number;
  selling_price: number;
  subtotal: number;
}

/** Cart line with derived totals. */
export interface CartTotals {
  subtotal: number;
  lineDiscountTotal: number;
  discountTotal: number;
  total: number;
  itemCount: number;
  /** Total quantity across lines (may be fractional for Kg/Liter/Meter). */
  qtyTotal: number;
}

// ============================================================
// Utility functions
// ============================================================

/** Gross of a single line before its own discount. */
export function cartLineGross(item: CartItem): number {
  return round2(item.selling_price * item.qty);
}

/** Net of a single line after its own discount. */
export function cartLineNet(item: CartItem): number {
  return round2(cartLineGross(item) - item.discount_amount);
}

/** Roll up the cart into the totals the receipt and RPC agree on. */
export function calcCartTotals(
  items: CartItem[],
  headerDiscount: number
): CartTotals {
  let subtotal = 0;
  let lineDiscountTotal = 0;
  let qtyTotal = 0;

  for (const item of items) {
    subtotal += cartLineGross(item);
    lineDiscountTotal += item.discount_amount;
    qtyTotal += item.qty;
  }

  subtotal = round2(subtotal);
  lineDiscountTotal = round2(lineDiscountTotal);

  const discountTotal = round2(
    Math.min(lineDiscountTotal + Math.max(0, headerDiscount), subtotal)
  );

  return {
    subtotal,
    lineDiscountTotal,
    discountTotal,
    total: round2(subtotal - discountTotal),
    itemCount: items.length,
    qtyTotal: round3(qtyTotal),
  };
}

/** Round to 2 decimals, matching the numeric(14,2) money columns. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round to 3 decimals, matching the numeric(12,3) quantity columns. */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Suggested quick-cash denominations, ascending, ≥ total. */
export function quickCashSuggestions(total: number): number[] {
  const denominations = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
  const suggestions = new Set<number>();

  suggestions.add(total);
  for (const d of denominations) {
    suggestions.add(Math.ceil(total / d) * d);
  }
  // Common round-up notes.
  suggestions.add(Math.ceil(total / 50_000) * 50_000);
  suggestions.add(Math.ceil(total / 100_000) * 100_000);

  return [...suggestions]
    .filter((v) => v >= total && v > 0)
    .sort((a, b) => a - b)
    .slice(0, 6);
}