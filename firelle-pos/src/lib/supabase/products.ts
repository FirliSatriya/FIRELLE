import type { Database } from "@/types/database.types";
import type {
  CreateProductInput,
  Product,
  StockAdjustmentInput,
  StockMovement,
  UpdateProductInput,
} from "@/types/product";
import { createClient } from "./client";

export type AppRole = "ADMIN" | "CASHIER";

export interface CurrentProfile {
  id: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}

type ProductAdminRow = Database["public"]["Views"]["products_admin"]["Row"];
type ProductCashierRow = Database["public"]["Views"]["products_cashier"]["Row"];

function toNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapProduct(row: ProductAdminRow | ProductCashierRow): Product {
  return {
    id: row.id ?? "",
    sku: row.sku,
    barcode: row.barcode,
    name: row.name ?? "",
    unit: row.unit ?? "Pcs",
    cost_price: toNumber("cost_price" in row ? row.cost_price : 0),
    selling_price: toNumber(row.selling_price),
    stock: toNumber(row.stock),
    min_stock: toNumber(row.min_stock),
    is_deleted: row.is_deleted ?? false,
    deleted_at: row.deleted_at,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

/** Read the signed-in user's profile (role + active flag). */
export async function getCurrentProfile(userId: string): Promise<CurrentProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role as AppRole,
    isActive: data.is_active,
  };
}

/**
 * Admins read `products_admin` (includes cost_price); cashiers read the
 * cashier-safe view, which has no cost column.
 */
export async function listProducts(role: AppRole): Promise<Product[]> {
  const supabase = createClient();

  if (role === "ADMIN") {
    const { data, error } = await supabase
      .from("products_admin")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapProduct);
  }

  const { data, error } = await supabase
    .from("products_cashier")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function createProduct(input: CreateProductInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("products").insert({
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    unit: input.unit,
    cost_price: input.cost_price,
    selling_price: input.selling_price,
    stock: input.stock,
    min_stock: input.min_stock,
  });

  if (error) throw error;
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      unit: input.unit,
      cost_price: input.cost_price,
      selling_price: input.selling_price,
      min_stock: input.min_stock,
    })
    .eq("id", productId);

  if (error) throw error;
}

/** Soft delete: keeps transaction history and stock ledger intact. */
export async function archiveProduct(productId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) throw error;
}

export async function restoreProduct(productId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", productId);

  if (error) throw error;
}

export async function listStockMovements(productId: string): Promise<StockMovement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Stock adjustments go through the atomic `adjust_stock` RPC. */
export async function adjustStock(
  productId: string,
  input: StockAdjustmentInput
): Promise<void> {
  const supabase = createClient();
  const delta = input.direction === "add" ? input.qty : -input.qty;
  const note = input.note?.trim();

  const { error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: input.reason,
    ...(note ? { p_note: note } : {}),
  });

  if (error) throw error;
}
