/**
 * Implementasi pengaturan toko demo (in-memory) — padanan
 * `src/lib/supabase/settings.ts`.
 */
import type { Database } from "@/types/database.types";
import {
  clone,
  getDemoState,
  requireDemoAdmin,
  type StoreSettingsRow,
} from "./state";

export type StoreSettingsUpdate =
  Database["public"]["Tables"]["settings"]["Update"];

export type ReceiptPaper = "58mm" | "80mm" | "A4";

export const RECEIPT_PAPER_OPTIONS: { value: ReceiptPaper; label: string }[] = [
  { value: "58mm", label: "58 mm — thermal kecil" },
  { value: "80mm", label: "80 mm — thermal lebar" },
  { value: "A4", label: "A4 — lembaran" },
];

export async function getStoreSettings(): Promise<StoreSettingsRow> {
  return clone(getDemoState().settings);
}

export async function updateStoreSettings(
  input: StoreSettingsUpdate
): Promise<StoreSettingsRow> {
  requireDemoAdmin();
  const settings = getDemoState().settings;

  // Salin hanya field yang dikirim, seperti UPDATE parsial Supabase.
  if (input.store_name !== undefined) settings.store_name = input.store_name;
  if (input.store_address !== undefined) {
    settings.store_address = input.store_address;
  }
  if (input.store_phone !== undefined) settings.store_phone = input.store_phone;
  if (input.receipt_footer !== undefined) {
    settings.receipt_footer = input.receipt_footer;
  }
  if (input.receipt_paper !== undefined) {
    settings.receipt_paper = input.receipt_paper;
  }
  if (input.allow_negative_stock !== undefined) {
    settings.allow_negative_stock = input.allow_negative_stock;
  }
  if (input.low_stock_default !== undefined) {
    settings.low_stock_default = input.low_stock_default;
  }

  settings.updated_at = new Date().toISOString();
  return clone(settings);
}
