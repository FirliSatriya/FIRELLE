/**
 * Fasad galeri produk — Supabase Storage (production) atau object URL in-memory
 * (demo).
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demo from "@/lib/demo/product-images";
import * as production from "@/lib/supabase/product-images";
import type { ProductImage } from "@/types/product";

export { PRODUCT_IMAGES_BUCKET } from "@/lib/supabase/product-images";

export function productImagePublicUrl(storagePath: string): string {
  return isDemoMode()
    ? demo.productImagePublicUrl(storagePath)
    : production.productImagePublicUrl(storagePath);
}

export function sortProductImages(images: ProductImage[]): ProductImage[] {
  return isDemoMode()
    ? demo.sortProductImages(images)
    : production.sortProductImages(images);
}

export function listProductImages(
  productIds: string[]
): Promise<Map<string, ProductImage[]>> {
  return isDemoMode()
    ? demo.listProductImages(productIds)
    : production.listProductImages(productIds);
}

export function uploadProductImage(
  productId: string,
  file: File,
  options: { makePrimary: boolean; position: number }
): Promise<ProductImage> {
  return isDemoMode()
    ? demo.uploadProductImage(productId, file, options)
    : production.uploadProductImage(productId, file, options);
}

export function listGallery(productId: string): Promise<ProductImage[]> {
  return isDemoMode()
    ? demo.listGallery(productId)
    : production.listGallery(productId);
}

export function deleteProductImage(
  image: ProductImage
): Promise<ProductImage[]> {
  return isDemoMode()
    ? demo.deleteProductImage(image)
    : production.deleteProductImage(image);
}

export function setPrimaryProductImage(
  productId: string,
  imageId: string
): Promise<ProductImage[]> {
  return isDemoMode()
    ? demo.setPrimaryProductImage(productId, imageId)
    : production.setPrimaryProductImage(productId, imageId);
}

export function isGalleryFull(images: ProductImage[]): boolean {
  return isDemoMode()
    ? demo.isGalleryFull(images)
    : production.isGalleryFull(images);
}
