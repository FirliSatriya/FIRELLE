/**
 * Implementasi galeri produk demo (in-memory).
 *
 * Tidak ada Storage: file diubah menjadi object URL (`URL.createObjectURL`)
 * dan hanya hidup selama tab terbuka. Karena itu galeri otomatis kosong lagi
 * setelah halaman dimuat ulang — sama seperti data demo lainnya.
 */
import type { ProductImage } from "@/types/product";
import { MAX_PRODUCT_IMAGES } from "@/types/product";
import {
  clone,
  demoError,
  demoId,
  getDemoState,
  requireDemoAdmin,
} from "./state";

export const PRODUCT_IMAGES_BUCKET = "product-images";

export function productImagePublicUrl(storagePath: string): string {
  return storagePath;
}

export function sortProductImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Galeri lengkap satu produk, primary lebih dulu. */
export function imagesForProduct(productId: string): ProductImage[] {
  return sortProductImages(
    getDemoState()
      .images.filter((image) => image.product_id === productId)
      .map((image) => clone(image))
  );
}

export async function listProductImages(
  productIds: string[]
): Promise<Map<string, ProductImage[]>> {
  const grouped = new Map<string, ProductImage[]>();
  for (const productId of productIds) {
    grouped.set(productId, imagesForProduct(productId));
  }
  return grouped;
}

export async function listGallery(productId: string): Promise<ProductImage[]> {
  return imagesForProduct(productId);
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

function createDemoObjectUrl(file: File): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }
  return "";
}

export async function uploadProductImage(
  productId: string,
  file: File,
  options: { makePrimary: boolean; position: number }
): Promise<ProductImage> {
  requireDemoAdmin();
  const state = getDemoState();
  const product = state.products.find((row) => row.id === productId);

  if (!product) {
    throw demoError("FR013", "PRODUCT_NOT_FOUND", productId);
  }

  const existing = state.images.filter(
    (image) => image.product_id === productId
  );
  if (existing.length >= MAX_PRODUCT_IMAGES) {
    throw demoError(
      "FR025",
      "TOO_MANY_PRODUCT_IMAGES",
      "A product may hold at most 8 images."
    );
  }

  if (options.makePrimary) {
    for (const image of existing) image.is_primary = false;
  }

  const createdAt = new Date().toISOString();
  const id = demoId("image");
  const image: ProductImage = {
    id,
    product_id: productId,
    storage_path: `demo/${productId}/${id}.${fileExtension(file)}`,
    url: createDemoObjectUrl(file),
    alt_text: null,
    position: options.position,
    is_primary: options.makePrimary,
    created_at: createdAt,
    updated_at: createdAt,
  };

  state.images.push(image);
  return clone(image);
}

export async function deleteProductImage(
  image: ProductImage
): Promise<ProductImage[]> {
  requireDemoAdmin();
  const state = getDemoState();
  const index = state.images.findIndex((row) => row.id === image.id);
  if (index < 0) return listGallery(image.product_id);

  const [removed] = state.images.splice(index, 1);

  if (
    removed.url.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(removed.url);
  }

  // Kehilangan gambar utama → promosikan yang berikutnya.
  if (removed.is_primary) {
    const remaining = state.images.filter(
      (row) => row.product_id === removed.product_id
    );
    const next = sortProductImages(remaining)[0];
    if (next) {
      next.is_primary = true;
      next.updated_at = new Date().toISOString();
    }
  }

  return listGallery(image.product_id);
}

export async function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<ProductImage[]> {
  requireDemoAdmin();
  const state = getDemoState();
  const updatedAt = new Date().toISOString();

  for (const image of state.images) {
    if (image.product_id !== productId) continue;
    image.is_primary = image.id === imageId;
    image.updated_at = updatedAt;
  }

  return listGallery(productId);
}

export function isGalleryFull(images: ProductImage[]): boolean {
  return images.length >= MAX_PRODUCT_IMAGES;
}
