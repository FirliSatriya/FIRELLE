"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LuPackage,
  LuDownload,
  LuUpload,
  LuPlus,
  LuSearch,
  LuX,
  LuChevronsUpDown,
  LuArrowUp,
  LuArrowDown,
  LuTriangleAlert,
  LuPencil,
  LuBoxes,
  LuTrash2,
  LuRotateCcw,
  LuChevronLeft,
  LuChevronRight,
  LuPackageSearch,
} from "react-icons/lu";
import {
  Product,
  StockFilter,
  ProductSortField,
  SortDirection,
  CreateProductInput,
  StockAdjustmentInput,
  StockMovement,
  getStockStatus,
  formatRupiah,
  formatNumber,
  calcMarginPercent,
} from "@/types/product";
import { cn } from "@/lib/utils";
import { useDebouncedSearch, usePagination } from "@/lib/hooks";
import { getErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import {
  AppRole,
  adjustStock,
  archiveProduct,
  createProduct,
  getCurrentProfile,
  listProducts,
  listStockMovements,
  restoreProduct,
  updateProduct,
} from "@/lib/supabase/products";
import { StockBadge } from "./StockBadge";
import { CreateProductDialog } from "./CreateProductDialog";
import { EditProductDialog } from "./EditProductDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { ProductDetailDrawer } from "./ProductDetailDrawer";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: ProductSortField;
  sortField: ProductSortField;
  sortDir: SortDirection;
}) {
  if (sortField !== field) {
    return (
      <span className="sort-icon" aria-hidden="true">
        <LuChevronsUpDown size={14} />
      </span>
    );
  }
  return (
    <span className="sort-icon active" aria-hidden="true">
      {sortDir === "asc" ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />}
    </span>
  );
}

export function ProductCatalog() {
  const router = useRouter();

  // ─── State ─────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const { searchTerm, setSearchTerm, debouncedTerm } = useDebouncedSearch(300);
  const [sortField, setSortField] = useState<ProductSortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const canManage = role === "ADMIN";

  // ─── Load session, profile, and products ───────
  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        if (!session) {
          router.replace("/login");
          return;
        }

        const profile = await getCurrentProfile(session.user.id);
        if (!active) return;

        if (!profile || !profile.isActive) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        setRole(profile.role);
        const data = await listProducts(profile.role);
        if (active) setProducts(data);
      } catch (err) {
        if (active) setLoadError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const refreshProducts = useCallback(async () => {
    if (!role) return;
    const data = await listProducts(role);
    setProducts(data);
  }, [role]);

  const openDetail = (product: Product) => {
    setMovements([]);
    setDetailProduct(product);
  };

  // Load the stock ledger for the selected product drawer.
  useEffect(() => {
    if (!detailProduct) return;

    let active = true;
    listStockMovements(detailProduct.id)
      .then((data) => {
        if (active) setMovements(data);
      })
      .catch((err) => {
        if (active) setActionError(getErrorMessage(err));
      });

    return () => {
      active = false;
    };
  }, [detailProduct]);

  // ─── Filtered & Sorted ─────────────────────────
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) =>
      showArchived ? p.is_deleted : !p.is_deleted
    );

    // Search by name, SKU, barcode
    if (debouncedTerm) {
      const q = debouncedTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }

    // Stock filter
    if (stockFilter === "LOW") {
      result = result.filter((p) => {
        const s = getStockStatus(p.stock, p.min_stock);
        return s === "LOW" || s === "WARNING";
      });
    } else if (stockFilter === "OUT") {
      result = result.filter((p) => p.stock <= 0);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const fa = a[sortField as keyof Product];
      const fb = b[sortField as keyof Product];
      if (typeof fa === "string" && typeof fb === "string") {
        cmp = fa.localeCompare(fb, "id-ID");
      } else if (typeof fa === "number" && typeof fb === "number") {
        cmp = fa - fb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [products, showArchived, debouncedTerm, stockFilter, sortField, sortDir]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
  } = usePagination(filteredProducts.length, 25);

  const pagedProducts = filteredProducts.slice(startIndex, endIndex);

  // ─── Handlers ──────────────────────────────────
  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleCreate = async (input: CreateProductInput) => {
    await createProduct(input);
    await refreshProducts();
    setCreateOpen(false);
  };

  const handleUpdate = async (updated: Product) => {
    await updateProduct(updated.id, {
      name: updated.name,
      sku: updated.sku ?? "",
      barcode: updated.barcode ?? "",
      unit: updated.unit,
      cost_price: updated.cost_price,
      selling_price: updated.selling_price,
      min_stock: updated.min_stock,
    });
    await refreshProducts();
    setEditProduct(null);
  };

  const handleAdjustStock = async (
    productId: string,
    input: StockAdjustmentInput
  ) => {
    await adjustStock(productId, input);
    await refreshProducts();
    setAdjustProduct(null);
  };

  const handleDelete = async (productId: string) => {
    await archiveProduct(productId);
    await refreshProducts();
    setDeleteProduct(null);
  };

  const handleRestore = async (productId: string) => {
    setActionError(null);
    try {
      await restoreProduct(productId);
      await refreshProducts();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  // ─── Stats ─────────────────────────────────────
  const activeProducts = products.filter((p) => !p.is_deleted);
  const lowStockCount = activeProducts.filter((p) => {
    const s = getStockStatus(p.stock, p.min_stock);
    return s === "LOW" || s === "OUT";
  }).length;

  return (
    <div className="product-catalog">
      {/* ── Header ── */}
      <div className="catalog-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuPackage size={26} />
            </span>
            <span>Katalog Produk</span>
          </h1>
          <p className="header-subtitle">
            {activeProducts.length} produk aktif
            {lowStockCount > 0 && (
              <span className="low-stock-alert">
                &nbsp;• {lowStockCount} stok rendah/habis
              </span>
            )}
            {role === "CASHIER" && (
              <span className="text-muted"> &nbsp;• mode kasir (hanya baca)</span>
            )}
          </p>
        </div>
        <div className="header-actions flex items-center gap-2">
          {canManage ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  alert("Fitur ekspor CSV akan diimplementasikan dengan koneksi backend.");
                }}
                className="gap-2"
              >
                <LuDownload size={16} />
                <span>Ekspor CSV</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  alert("Fitur impor CSV akan diimplementasikan dengan koneksi backend.");
                }}
                className="gap-2"
              >
                <LuUpload size={16} />
                <span>Impor CSV</span>
              </Button>
              <Button
                variant="default"
                onClick={() => setCreateOpen(true)}
                className="gap-2"
              >
                <LuPlus size={16} />
                <span>Tambah Produk</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="catalog-toolbar">
        <div className="relative flex-1 min-w-[240px]">
          <LuSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="text"
            placeholder="Cari nama, SKU, atau barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-12 bg-card border-border"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchTerm("")}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Hapus pencarian"
            >
              <LuX size={14} />
            </Button>
          )}
        </div>

        <div className="filter-group">
          <label className="filter-label text-xs font-medium text-muted-foreground">Stok:</label>
          <div className="filter-buttons flex gap-1">
            {(["ALL", "LOW", "OUT"] as StockFilter[]).map((f) => (
              <Button
                key={f}
                variant={stockFilter === f ? "default" : "secondary"}
                size="sm"
                className={cn(
                  "h-11 px-3 text-xs",
                  stockFilter !== f && "bg-secondary text-secondary-foreground hover:bg-accent border-border/60"
                )}
                onClick={() => setStockFilter(f)}
              >
                {f === "ALL" ? "Semua" : f === "LOW" ? "Rendah" : "Habis"}
              </Button>
            ))}
          </div>
        </div>

        <label className="toggle-archived flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="size-4 rounded border-border bg-secondary text-primary focus:ring-primary/40 cursor-pointer"
          />
          <span className="toggle-label">Tampilkan arsip</span>
        </label>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <span className="flex items-start gap-2">
            <LuTriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={() => setActionError(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className="sortable">
                Nama <SortIcon sortField={sortField} sortDir={sortDir} field="name" />
              </th>
              <th onClick={() => handleSort("sku")} className="sortable">
                SKU <SortIcon sortField={sortField} sortDir={sortDir} field="sku" />
              </th>
              <th onClick={() => handleSort("unit")} className="sortable">
                Satuan <SortIcon sortField={sortField} sortDir={sortDir} field="unit" />
              </th>
              <th
                onClick={() => handleSort("cost_price")}
                className="sortable text-right"
              >
                Harga Beli <SortIcon sortField={sortField} sortDir={sortDir} field="cost_price" />
              </th>
              <th
                onClick={() => handleSort("selling_price")}
                className="sortable text-right"
              >
                Harga Jual <SortIcon sortField={sortField} sortDir={sortDir} field="selling_price" />
              </th>
              <th className="text-right">Margin</th>
              <th
                onClick={() => handleSort("stock")}
                className="sortable text-right"
              >
                Stok <SortIcon sortField={sortField} sortDir={sortDir} field="stock" />
              </th>
              <th>Status</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuPackageSearch size={44} />
                  </div>
                  <p>Memuat produk dari Supabase...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  <div className="empty-icon text-destructive" aria-hidden="true">
                    <LuTriangleAlert size={44} />
                  </div>
                  <p className="text-destructive">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => window.location.reload()}
                  >
                    <LuRotateCcw size={14} />
                    <span>Coba lagi</span>
                  </Button>
                </td>
              </tr>
            ) : pagedProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuPackageSearch size={44} />
                  </div>
                  <p>
                    {debouncedTerm
                      ? `Tidak ada produk yang cocok dengan "${debouncedTerm}"`
                      : showArchived
                      ? "Tidak ada produk yang diarsipkan"
                      : canManage
                      ? "Belum ada produk. Klik \"Tambah Produk\" untuk memulai."
                      : "Belum ada produk aktif."}
                  </p>
                </td>
              </tr>
            ) : (
              pagedProducts.map((product) => {
                const margin = calcMarginPercent(
                  product.selling_price,
                  product.cost_price
                );
                const status = getStockStatus(product.stock, product.min_stock);
                const isLoss = product.selling_price < product.cost_price;

                return (
                  <tr
                    key={product.id}
                    className={cn(
                      "product-row",
                      product.is_deleted && "archived-row"
                    )}
                  >
                    <td>
                      <button
                        className="product-name-link font-medium text-left"
                        onClick={() => openDetail(product)}
                      >
                        {product.name}
                      </button>
                      {product.barcode && (
                        <span className="barcode-label">{product.barcode}</span>
                      )}
                    </td>
                    <td className="sku-cell">
                      {product.sku || (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{product.unit}</td>
                    <td className="text-right mono">
                      {formatRupiah(product.cost_price)}
                    </td>
                    <td className="text-right mono">
                      {formatRupiah(product.selling_price)}
                      {isLoss && (
                        <span className="loss-warning" title="Harga jual di bawah harga beli (BR-08)">
                          <LuTriangleAlert size={14} className="loss-warning-icon text-loss" />
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "text-right mono font-medium",
                        isLoss ? "text-loss" : "text-profit"
                      )}
                    >
                      {margin.toFixed(1)}%
                    </td>
                    <td className="text-right mono">
                      {formatNumber(product.stock, product.unit === "Kg" || product.unit === "Liter" || product.unit === "Meter" ? 1 : 0)}
                    </td>
                    <td>
                      <StockBadge status={status} />
                    </td>
                    <td className="actions-cell">
                      {!canManage ? (
                        <span className="text-muted">—</span>
                      ) : product.is_deleted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(product.id)}
                          className="gap-1.5 text-success-foreground border-success/30 hover:bg-success/10"
                        >
                          <LuRotateCcw size={14} />
                          <span>Pulihkan</span>
                        </Button>
                      ) : (
                        <div className="action-buttons flex items-center justify-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Edit"
                            onClick={() => setEditProduct(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            <LuPencil size={15} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Sesuaikan Stok"
                            onClick={() => setAdjustProduct(product)}
                            aria-label={`Sesuaikan stok ${product.name}`}
                          >
                            <LuBoxes size={15} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Arsipkan"
                            onClick={() => setDeleteProduct(product)}
                            aria-label={`Arsipkan ${product.name}`}
                            className="hover:text-destructive hover:bg-destructive/10"
                          >
                            <LuTrash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filteredProducts.length > 0 && (
        <div className="pagination flex items-center justify-between pt-4">
          <span className="page-info text-xs text-muted-foreground">
            Menampilkan <strong className="text-foreground">{startIndex + 1}–{endIndex}</strong> dari{" "}
            <strong className="text-foreground">{filteredProducts.length}</strong> produk
          </span>
          <div className="page-controls flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 1}
              onClick={prevPage}
              aria-label="Halaman sebelumnya"
            >
              <LuChevronLeft size={16} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "size-11 p-0 text-sm",
                    currentPage === page && "shadow-sm"
                  )}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === totalPages}
              onClick={nextPage}
              aria-label="Halaman selanjutnya"
            >
              <LuChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      {createOpen && canManage && (
        <CreateProductDialog
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {editProduct && canManage && (
        <EditProductDialog
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={handleUpdate}
        />
      )}

      {adjustProduct && canManage && (
        <StockAdjustmentDialog
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onAdjust={handleAdjustStock}
        />
      )}

      {detailProduct && (
        <ProductDetailDrawer
          product={detailProduct}
          movements={movements}
          onClose={() => setDetailProduct(null)}
        />
      )}

      {deleteProduct && canManage && (
        <DeleteProductDialog
          product={deleteProduct}
          onClose={() => setDeleteProduct(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
