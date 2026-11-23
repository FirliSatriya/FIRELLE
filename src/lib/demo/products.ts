/**
 * Implementasi produk demo (in-memory) — padanan `src/lib/supabase/products.ts`.
 */
import type {
  CreateProductInput,
  Product,
  StockAdjustmentInput,
  StockMovement,
  UpdateProductInput,
} from "@/types/product";
import type { CurrentProfile } from "@/types/auth";
import { getDemoProfile } from "./auth";
import { imagesForProduct } from "./product-images";
import {
  clone,
  demoError,
  demoId,
  getDemoState,
  requireDemoAdmin,
} from "./state";

function nowIso(): string {
  return new Date().toISOString();
}

function findProduct(productId: string): Product {
  const product = getDemoState().products.find((row) => row.id === productId);
  if (!product) {
    throw demoError("FR013", "PRODUCT_NOT_FOUND", productId);
  }
  return product;
}

export async function getCurrentProfile(
  userId: string
): Promise<CurrentProfile | null> {
  return getDemoProfile(userId);
}

export async function listProducts(
  role: "ADMIN" | "CASHIER"
): Promise<Product[]> {
  const products = [...getDemoState().products]
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID"))
    .map((product) => {
      const copy = clone(product);
      copy.images = imagesForProduct(product.id);
      // View `products_cashier` tidak mengekspos harga modal.
      if (role === "CASHIER") copy.cost_price = 0;
      return copy;
    });
  return products;
}

export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  requireDemoAdmin();
  const createdAt = nowIso();
  const product: Product = {
    id: demoId("product"),
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    name: input.name.trim(),
    unit: input.unit,
    cost_price: input.cost_price,
    selling_price: input.selling_price,
    stock: input.stock,
    min_stock: input.min_stock,
    is_deleted: false,
    deleted_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    images: [],
  };

  getDemoState().products.push(product);
  return clone(product);
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput
): Promise<void> {
  requireDemoAdmin();
  const product = findProduct(productId);

  product.name = input.name.trim();
  product.sku = input.sku?.trim() || null;
  product.barcode = input.barcode?.trim() || null;
  product.unit = input.unit;
  product.cost_price = input.cost_price;
  product.selling_price = input.selling_price;
  product.min_stock = input.min_stock;
  product.updated_at = nowIso();
}

export async function archiveProduct(productId: string): Promise<void> {
  requireDemoAdmin();
  const product = findProduct(productId);
  product.is_deleted = true;
  product.deleted_at = nowIso();
  product.updated_at = product.deleted_at;
}

export async function restoreProduct(productId: string): Promise<void> {
  requireDemoAdmin();
  const product = findProduct(productId);
  product.is_deleted = false;
  product.deleted_at = null;
  product.updated_at = nowIso();
}

export async function deleteProductPermanently(
  productId: string
): Promise<void> {
  requireDemoAdmin();
  const state = getDemoState();
  const product = findProduct(productId);

  if (!product.is_deleted) {
    throw demoError(
      "FR027",
      "PRODUCT_NOT_ARCHIVED",
      `${product.name} must be archived before it can be purged.`
    );
  }

  const hasHistory =
    state.transactions.some((transaction) =>
      transaction.items.some((item) => item.product_id === productId)
    ) ||
    state.stockMovements.some(
      (movement) =>
        movement.product_id === productId && movement.transaction_id !== null
    );

  if (hasHistory) {
    throw demoError(
      "FR026",
      "PRODUCT_HAS_HISTORY",
      `${product.name} is referenced by transaction history.`
    );
  }

  // Hapus ledger & gambar milik produk itu sendiri, lalu produknya.
  state.stockMovements = state.stockMovements.filter(
    (movement) => movement.product_id !== productId
  );
  state.images = state.images.filter((image) => image.product_id !== productId);
  state.products = state.products.filter((row) => row.id !== productId);
}

export async function listStockMovements(
  productId: string
): Promise<StockMovement[]> {
  return getDemoState()
    .stockMovements.filter((movement) => movement.product_id === productId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((movement) => clone(movement));
}

export async function adjustStock(
  productId: string,
  input: StockAdjustmentInput
): Promise<void> {
  const admin = requireDemoAdmin();
  const state = getDemoState();
  const product = findProduct(productId);
  const delta = input.direction === "add" ? input.qty : -input.qty;

  if (!Number.isFinite(delta) || Math.round(delta * 1000) === 0) {
    throw demoError(
      "FR007",
      "INVALID_QUANTITY",
      "delta must not be zero (or round to zero)."
    );
  }

  if (product.is_deleted) {
    throw demoError(
      "FR002",
      "PRODUCT_ARCHIVED",
      `${product.name} (${product.sku}) is archived.`
    );
  }

  const stockAfter = Math.round((product.stock + delta) * 1000) / 1000;
  if (stockAfter < 0 && !state.settings.allow_negative_stock) {
    throw demoError(
      "FR001",
      "INSUFFICIENT_STOCK",
      `${product.name}: available=${product.stock} delta=${delta} result=${stockAfter} (negative stock disabled).`
    );
  }

  const createdAt = nowIso();
  product.stock = stockAfter;
  product.updated_at = createdAt;

  state.stockMovements.push({
    id: demoId("movement"),
    product_id: product.id,
    type: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    qty_change: delta,
    stock_after: stockAfter,
    reason: input.reason,
    note: input.note?.trim() || null,
    transaction_id: null,
    created_by: admin.id,
    created_by_name: admin.fullName,
    created_at: createdAt,
  });
}
