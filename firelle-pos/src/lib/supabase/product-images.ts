import type { Database } from "@/types/database.types";
import type { ProductImage } from "@/types/product";
import { MAX_PRODUCT_IMAGES } from "@/types/product";
import { createClient } from "./client";

/** Storage bucket that holds every product photo. */
export const PRODUCT_IMAGES_BUCKET = "product-images";

type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];

/** Public URL for an object in the product-images bucket. */
export function productImagePublicUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(storagePath)
    .data.publicUrl;
}

export function mapProductImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    product_id: row.product_id,
    storage_path: row.storage_path,
    url: productImagePublicUrl(row.storage_path),
    alt_text: row.alt_text,
    position: row.position,
    is_primary: row.is_primary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Primary image first, then gallery order. `is_primary` is unique per product
 * in the DB, so at most one row can lead.
 */
export function sortProductImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Gallery rows for a set of products, keyed by product id. */
export async function listProductImages(
  productIds: string[]
): Promise<Map<string, ProductImage[]>> {
  const grouped = new Map<string, ProductImage[]>();
  if (productIds.length === 0) return grouped;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .in("product_id", productIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    const list = grouped.get(row.product_id) ?? [];
    list.push(mapProductImage(row));
    grouped.set(row.product_id, list);
  }

  for (const [id, list] of grouped) {
    grouped.set(id, sortProductImages(list));
  }

  return grouped;
}

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{2,5}$/.test(fromName)) return fromName;

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Upload one file and register it in the gallery. The storage object is
 * removed again if the row insert fails, so a rejected upload leaves nothing
 * behind.
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  options: { makePrimary: boolean; position: number }
): Promise<ProductImage> {
  const supabase = createClient();
  const path = `${productId}/${crypto.randomUUID()}.${fileExtension(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  // Only one primary row is allowed per product.
  if (options.makePrimary) {
    const { error: demoteError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId)
      .eq("is_primary", true);

    if (demoteError) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
      throw demoteError;
    }
  }

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      storage_path: path,
      position: options.position,
      is_primary: options.makePrimary,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    throw error;
  }

  return mapProductImage(data);
}

/** Fresh ordered gallery for one product. */
export async function listGallery(productId: string): Promise<ProductImage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return sortProductImages((data ?? []).map(mapProductImage));
}

/** Delete the gallery row first, then the storage object. Returns the surviving gallery. */
export async function deleteProductImage(
  image: ProductImage
): Promise<ProductImage[]> {
  const supabase = createClient();

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", image.id);

  if (error) throw error;

  // Best-effort file cleanup: the row is already gone, so the UI stays
  // consistent even when this throws.
  const { error: removeError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([image.storage_path]);

  if (removeError) throw removeError;

  // Losing the primary image promotes the next one in line.
  if (image.is_primary) {
    const { data } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);

    const next = data?.[0];
    if (next) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  return listGallery(image.product_id);
}

/** Promote an image to primary and demote the previous one. Returns the fresh gallery. */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<ProductImage[]> {
  const supabase = createClient();

  const { error: demoteError } = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .neq("id", imageId);

  if (demoteError) throw demoteError;

  const { error } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);

  if (error) throw error;

  return listGallery(productId);
}

/** True when the product cannot accept another upload. */
export function isGalleryFull(images: ProductImage[]): boolean {
  return images.length >= MAX_PRODUCT_IMAGES;
}