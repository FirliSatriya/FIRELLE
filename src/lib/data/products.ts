/**
 * Fasad data produk — memilih implementasi Supabase (production) atau
 * in-memory demo berdasarkan `APP_MODE`.
 *
 * Komponen cukup mengimpor dari sini; tidak perlu tahu mode yang aktif.
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demo from "@/lib/demo/products";
import * as production from "@/lib/supabase/products";
import type {
  CreateProductInput,
  Product,
  StockAdjustmentInput,
  StockMovement,
  UpdateProductInput,
} from "@/types/product";
import type { AppRole, CurrentProfile } from "@/types/auth";

export type { AppRole, CurrentProfile };

export function getCurrentProfile(
  userId: string
): Promise<CurrentProfile | null> {
  return isDemoMode()
    ? demo.getCurrentProfile(userId)
    : production.getCurrentProfile(userId);
}

export function listProducts(role: AppRole): Promise<Product[]> {
  return isDemoMode()
    ? demo.listProducts(role)
    : production.listProducts(role);
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return isDemoMode()
    ? demo.createProduct(input)
    : production.createProduct(input);
}

export function updateProduct(
  productId: string,
  input: UpdateProductInput
): Promise<void> {
  return isDemoMode()
    ? demo.updateProduct(productId, input)
    : production.updateProduct(productId, input);
}

export function archiveProduct(productId: string): Promise<void> {
  return isDemoMode()
    ? demo.archiveProduct(productId)
    : production.archiveProduct(productId);
}

export function restoreProduct(productId: string): Promise<void> {
  return isDemoMode()
    ? demo.restoreProduct(productId)
    : production.restoreProduct(productId);
}

export function deleteProductPermanently(productId: string): Promise<void> {
  return isDemoMode()
    ? demo.deleteProductPermanently(productId)
    : production.deleteProductPermanently(productId);
}

export function listStockMovements(productId: string): Promise<StockMovement[]> {
  return isDemoMode()
    ? demo.listStockMovements(productId)
    : production.listStockMovements(productId);
}

export function adjustStock(
  productId: string,
  input: StockAdjustmentInput
): Promise<void> {
  return isDemoMode()
    ? demo.adjustStock(productId, input)
    : production.adjustStock(productId, input);
}
