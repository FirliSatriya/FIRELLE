import type { Database } from "@/types/database.types";
import { createClient } from "./client";

// ============================================================
// Store settings (singleton row) — Module 7.
// Active users may read; only ADMIN may update (RLS).
// ============================================================

export type StoreSettingsRow = Database["public"]["Tables"]["settings"]["Row"];
export type StoreSettingsUpdate = Database["public"]["Tables"]["settings"]["Update"];

export type ReceiptPaper = "58mm" | "80mm" | "A4";

export const RECEIPT_PAPER_OPTIONS: { value: ReceiptPaper; label: string }[] = [
  { value: "58mm", label: "58 mm — thermal kecil" },
  { value: "80mm", label: "80 mm — thermal lebar" },
  { value: "A4", label: "A4 — lembaran" },
];

/** Read the singleton settings row used by receipts and inventory defaults. */
export async function getStoreSettings(): Promise<StoreSettingsRow> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Pengaturan toko belum tersedia di database.");
  return data;
}

/** Update the singleton row. Only ADMIN passes the RLS update policy. */
export async function updateStoreSettings(
  input: StoreSettingsUpdate
): Promise<StoreSettingsRow> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("settings")
    .update(input)
    .eq("singleton", true)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Pengaturan toko gagal disimpan.");
  return data;
}
