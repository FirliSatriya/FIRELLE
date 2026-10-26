import type { Database } from "@/types/database.types";
import type {
  CreateProductInput,
  Product,
  ProductImage,
  StockAdjustmentInput,
  StockMovement,
  UpdateProductInput,
} from "@/types/product";
import { createClient } from "./client";
import { listGallery } from "./product-images";

export type AppRole = "ADMIN" | "CASHIER";

export interface CurrentProfile {
  id: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}

type ProductAdminRow = Database["public"]["Views"]["products_admin"]["Row"];
type ProductCashierRow = Database["public"]["Views"]["products_cashier"]["Row"];
type ImageRow = Database["public"]["Views"]["product_images_cashier"]["Row"];

const BUCKET = "product-images";

function toNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Public URL for a stored object path inside the gallery bucket. */
function imagePublicUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  return `${url}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function mapImage(row: ImageRow): ProductImage {
  const path = row.storage_path ?? "";
  return {
    id: row.id ?? "",
    product_id: row.product_id ?? "",
    storage_path: path,
    url: path ? imagePublicUrl(path) : "",
    alt_text: row.alt_text,
    position: row.position ?? 0,
    is_primary: row.is_primary ?? false,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function mapProduct(
  row: ProductAdminRow | ProductCashierRow,
  images: ProductImage[] = []
): Product {
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
    images,
  };
}

/** Primary-first ordering, matching `getPrimaryImageUrl`. */
function sortImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Load the gallery for a set of products and key it by product id. */
async function loadImagesByProduct(
  productIds: string[]
): Promise<Map<string, ProductImage[]>> {
  if (productIds.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_images_cashier")
    .select("*")
    .in("product_id", productIds);

  if (error) throw error;

  const grouped = new Map<string, ProductImage[]>();
  for (const row of data ?? []) {
    const image = mapImage(row);
    const list = grouped.get(image.product_id) ?? [];
    list.push(image);
    grouped.set(image.product_id, list);
  }

  for (const [id, list] of grouped) {
    grouped.set(id, sortImages(list));
  }
  return grouped;
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
    const rows = data ?? [];
    const images = await loadImagesByProduct(
      rows.map((r) => r.id).filter((id): id is string => Boolean(id))
    );
    return rows.map((row) => mapProduct(row, images.get(row.id ?? "") ?? []));
  }

  const { data, error } = await supabase
    .from("products_cashier")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  const images = await loadImagesByProduct(
    rows.map((r) => r.id).filter((id): id is string => Boolean(id))
  );
  return rows.map((row) => mapProduct(row, images.get(row.id ?? "") ?? []));
}

/** Insert a product and return it, including its (empty) gallery. */
export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      unit: input.unit,
      cost_price: input.cost_price,
      selling_price: input.selling_price,
      stock: input.stock,
      min_stock: input.min_stock,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    sku: data.sku,
    barcode: data.barcode,
    name: data.name,
    unit: data.unit,
    cost_price: toNumber(data.cost_price),
    selling_price: toNumber(data.selling_price),
    stock: toNumber(data.stock),
    min_stock: toNumber(data.min_stock),
    is_deleted: data.is_deleted,
    deleted_at: data.deleted_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    images: [],
  };
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

/**
 * Hard delete an archived product. Only allowed when no transaction references
 * it (enforced by the RPC); the gallery rows cascade, the Storage objects are
 * removed here after the row is gone.
 */
export async function deleteProductPermanently(
  productId: string
): Promise<void> {
  const supabase = createClient();

  // Read the gallery first: the rows cascade with the product, files do not.
  const images = await listGallery(productId);

  const { error } = await supabase.rpc("delete_product_permanently", {
    p_product_id: productId,
  });

  if (error) throw error;

  if (images.length > 0) {
    // Best-effort cleanup: the product row is already gone, so a failed
    // Storage call must not make the UI look like the delete failed.
    await supabase.storage
      .from(BUCKET)
      .remove(images.map((image) => image.storage_path));
  }
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
