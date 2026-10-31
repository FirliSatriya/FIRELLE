"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LuSearch,
  LuX,
  LuShoppingCart,
  LuPlus,
  LuMinus,
  LuTrash2,
  LuPackageSearch,
  LuTriangleAlert,
  LuCamera,
  LuCreditCard,
  LuUserRound,
} from "react-icons/lu";
import {
  formatRupiah,
  formatNumber,
  getStockStatus,
  isDecimalUnit,
  getPrimaryImageUrl,
  type Product,
} from "@/types/product";
import {
  calcCartTotals,
  cartLineNet,
  round2,
  round3,
  type CartItem,
  type Client,
  type PaymentMethod,
  type TransactionItem,
} from "@/types/transaction";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useDebouncedSearch } from "@/lib/hooks";
import { useSession, useStoreSettings } from "@/lib/session";
import { listProducts } from "@/lib/supabase/products";
import {
  createClientRecord,
  createTransaction,
  listClients,
  listTransactionItems,
} from "@/lib/supabase/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StockBadge } from "@/components/products/StockBadge";
import { BarcodeScannerDialog } from "@/components/pos/BarcodeScannerDialog";
import {
  PaymentDialog,
  ReceiptDialog,
  type ReceiptProps,
} from "@/components/pos/PaymentDialog";

interface CompletedSale {
  transaction: ReceiptProps["transaction"];
  items: ReceiptProps["items"];
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — still a valid UUID v4 shape.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function PosTerminal() {
  const router = useRouter();
  const { role, ready, profile } = useSession();
  const store = useStoreSettings();

  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { searchTerm, setSearchTerm, debouncedTerm } = useDebouncedSearch(200);
  const [category, setCategory] = useState<string>("Semua");
  const [scannerOpen, setScannerOpen] = useState(false);

  // ─── Load catalogue + clients once the session is ready ───
  // The initial values are already set at mount (loading starts true), so the
  // effect body only fires when auth becomes ready — no cascading renders.
  useEffect(() => {
    if (!ready) return;
    if (!role) {
      // Session resolved but no role (signed out / deactivated) → gatekeeper.
      router.replace("/login");
      return;
    }

    let active = true;

    void (async () => {
      try {
        const [productList, clientList] = await Promise.all([
          listProducts(role),
          listClients(),
        ]);
        if (!active) return;
        setProducts(productList.filter((p) => !p.is_deleted));
        setClients(clientList);
      } catch (err) {
        if (active) setLoadError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [ready, role, router]);

  const selectedClient = useMemo(() => {
    if (clientId) return clients.find((c) => c.id === clientId) ?? null;
    return null;
  }, [clientId, clients]);

  /** Typed name that does not match any saved client → will be created. */
  const isNewClientName = useMemo(() => {
    const name = clientName.trim().toLowerCase();
    if (!name) return false;
    return !clients.some(
      (c) =>
        c.name.trim().toLowerCase() === name ||
        (c.phone && c.phone.trim().toLowerCase() === name)
    );
  }, [clientName, clients]);

  /** Name shown on the receipt / payment dialog. */
  const displayClientName =
    clientName.trim() || selectedClient?.name || "Pelanggan";

  /** Every sale requires a customer; a typed-but-new name counts too. */
  const hasClient = clientName.trim().length > 0;

  // ─── Categories derived from the catalogue ───
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.unit) set.add(p.unit);
    }
    return ["Semua", ...[...set].sort((a, b) => a.localeCompare(b, "id-ID"))];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = debouncedTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "Semua" && p.unit !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, category, debouncedTerm]);

  // ─── Cart helpers ───
  const cartQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) map.set(item.product_id, item.qty);
    return map;
  }, [cart]);

  const addToCart = useCallback(
    (product: Product) => {
      setActionError(null);

      if (product.stock <= 0 && !store?.allow_negative_stock) {
        setActionError(`Stok ${product.name} habis.`);
        return;
      }

      setCart((prev) => {
        const existing = prev.find((i) => i.product_id === product.id);
        if (existing) {
          const step = isDecimalUnit(product.unit) ? 1 : 1;
          const nextQty = round3(existing.qty + step);
          if (!store?.allow_negative_stock && nextQty > product.stock) {
            setActionError(
              `Stok ${product.name} hanya ${formatNumber(product.stock, 1)} ${product.unit}.`
            );
            return prev;
          }
          return prev.map((i) =>
            i.product_id === product.id ? { ...i, qty: nextQty } : i
          );
        }

        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            unit: product.unit,
            selling_price: product.selling_price,
            stock: product.stock,
            is_decimal: isDecimalUnit(product.unit),
            qty: 1,
            discount_amount: 0,
          },
        ];
      });
    },
    [store?.allow_negative_stock]
  );

  /**
   * A decoded barcode/QR from the camera scanner. Matches against barcode then
   * SKU; on a hit the product goes straight into the cart, otherwise we fall
   * back to seeding the search box with the raw code.
   */
  const handleScan = useCallback(
    (code: string) => {
      const needle = code.trim().toLowerCase();
      if (!needle) return;

      const match = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === needle) ||
          (p.sku && p.sku.trim().toLowerCase() === needle)
      );

      if (match) {
        addToCart(match);
        setSearchTerm("");
        return;
      }

      setActionError(`Barcode "${code}" tidak cocok dengan produk mana pun.`);
      setSearchTerm(code);
    },
    [products, addToCart, setSearchTerm]
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.product_id !== productId) return item;
          const max = store?.allow_negative_stock
            ? Infinity
            : item.stock;
          if (qty <= 0) return { ...item, qty: item.is_decimal ? 0.001 : 1 };
          if (qty > max) {
            setActionError(
              `Stok ${item.name} hanya ${formatNumber(item.stock, 1)} ${item.unit}.`
            );
            return { ...item, qty: max };
          }
          return { ...item, qty: round3(qty) };
        })
      );
    },
    [store?.allow_negative_stock]
  );

  const stepQty = useCallback(
    (productId: string, delta: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.product_id !== productId) return item;
          const step = item.is_decimal ? 0.1 : 1;
          const next = round3(item.qty + delta * step);
          const max = store?.allow_negative_stock ? Infinity : item.stock;
          if (next > max) return { ...item, qty: max };
          if (next <= 0) return { ...item, qty: step };
          return { ...item, qty: next };
        })
      );
    },
    [store?.allow_negative_stock]
  );

  const setLineDiscount = useCallback(
    (productId: string, discount: number) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.product_id !== productId) return item;
          const gross = round2(item.selling_price * item.qty);
          return { ...item, discount_amount: Math.min(Math.max(0, discount), gross) };
        })
      );
    },
    []
  );

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setHeaderDiscount(0);
    setClientId(null);
    setClientName("");
    setClientError(null);
    setActionError(null);
  }, []);

  const totals = useMemo(
    () => calcCartTotals(cart, headerDiscount),
    [cart, headerDiscount]
  );

  // ─── Checkout ───
  const handleSubmitPayment = async (payload: {
    payment_method: PaymentMethod;
    amount_paid: number;
  }) => {
    setSubmitting(true);
    setPayError(null);
    setClientError(null);

    try {
      // Resolve the customer: an existing saved client, a freshly typed name
      // (saved here so it appears in future sales). Every sale needs one.
      let resolvedClientId: string | null = clientId;

      if (!resolvedClientId && isNewClientName) {
        try {
          const created = await createClientRecord({
            name: clientName.trim(),
          });
          resolvedClientId = created.id;
          setClients((prev) => [...prev, created]);
          setClientId(created.id);
        } catch (err) {
          setClientError(
            `Nama pelanggan gagal disimpan: ${getErrorMessage(err)}`
          );
          throw err;
        }
      }

      if (!resolvedClientId) {
        setClientError("Pilih atau ketik nama pelanggan terlebih dahulu.");
        return;
      }

      const transaction = await createTransaction(
        {
          client_id: resolvedClientId,
          items: cart.map((item) => ({
            product_id: item.product_id,
            qty: item.qty,
            unit_price: item.selling_price,
            discount_amount: item.discount_amount,
          })),
          payment_method: payload.payment_method,
          amount_paid: payload.amount_paid,
          discount_amount: headerDiscount,
        },
        newIdempotencyKey()
      );

      // Prefer the immutable line snapshots the RPC wrote.
      let receiptItems: TransactionItem[] = [];
      try {
        receiptItems = await listTransactionItems(transaction.id);
      } catch {
        receiptItems = [];
      }

      const fallbackItems: ReceiptProps["items"] = cart.map((item) => ({
        product_name: item.name,
        qty: item.qty,
        unit: item.unit,
        selling_price: item.selling_price,
        subtotal: cartLineNet(item),
      }));

      setCompleted({
        transaction: {
          invoice_number: transaction.invoice_number,
          client_name: transaction.client_name,
          created_at: transaction.created_at,
          payment_method: transaction.payment_method,
          subtotal_amount: transaction.subtotal_amount,
          discount_amount: transaction.discount_amount,
          total_amount: transaction.total_amount,
          amount_paid: transaction.amount_paid,
          change_amount: transaction.change_amount,
          status: transaction.status,
          cashier_name:
            transaction.cashier_name ?? profile?.fullName ?? null,
        },
        items: receiptItems.length
          ? receiptItems.map((i) => ({
              product_name: i.product_name,
              qty: i.qty,
              unit: i.unit,
              selling_price: i.selling_price,
              subtotal: i.subtotal,
            }))
          : fallbackItems,
      });

      setPaymentOpen(false);
      clearCart();

      // Refresh stock so the grid reflects the sale immediately.
      if (role) {
        const fresh = await listProducts(role);
        setProducts(fresh.filter((p) => !p.is_deleted));
      }
    } catch (err) {
      setPayError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewTransaction = () => {
    setCompleted(null);
    setSearchTerm("");
  };

  return (
    <div className="pos-page">
      {/* ── Catalogue ── */}
      <section className="pos-page-catalog">
        <div className="pos-catalog">
          <div className="pos-search">
            <LuSearch
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              autoFocus
              placeholder="Cari atau scan nama, SKU, barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pos-search-input bg-card"
            />
            {searchTerm ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus pencarian"
                onClick={() => setSearchTerm("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <LuX size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Pindai barcode dengan kamera"
                title="Pindai barcode"
                onClick={() => setScannerOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary hover:text-primary"
              >
                <LuCamera size={18} />
              </Button>
            )}
          </div>

          <div className="pos-category-strip">
            <Select
              value={category}
              onValueChange={(value) => setCategory(value ?? "Semua")}
            >
              <SelectTrigger
                className="h-11 w-full min-w-0 sm:w-auto sm:min-w-[9.5rem]"
                aria-label="Filter satuan"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "Semua" ? "Semua Satuan" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {actionError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg border border-warning/30 bg-warning/12 p-2.5 text-xs text-warning-foreground"
            >
              <span className="flex items-start gap-2">
                <LuTriangleAlert size={15} className="mt-0.5 shrink-0" />
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

          <div className="pos-grid">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton h-32 rounded-lg"
                  aria-hidden="true"
                />
              ))
            ) : loadError ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center text-sm text-destructive">
                <LuTriangleAlert size={32} />
                <p>{loadError}</p>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <LuPackageSearch size={36} />
                <p>
                  {debouncedTerm
                    ? `Tidak ada produk cocok dengan "${debouncedTerm}"`
                    : "Belum ada produk untuk dijual."}
                </p>
              </div>
            ) : (
              visibleProducts.map((product) => {
                const inCart = cartQty.get(product.id) ?? 0;
                const status = getStockStatus(product.stock, product.min_stock);
                const out = product.stock <= 0;
                const isDecimal = isDecimalUnit(product.unit);

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={out && !store?.allow_negative_stock}
                    onClick={() => addToCart(product)}
                    className={cn("pos-card", inCart > 0 && "is-in-cart")}
                    aria-label={`Tambah ${product.name} ke keranjang`}
                  >
                    {inCart > 0 && (
                      <span className="pos-cart-badge">
                        {formatNumber(inCart, isDecimal ? 1 : 0)}
                      </span>
                    )}
                    {getPrimaryImageUrl(product) ? (
                      <span className="pos-card-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL */}
                        <img
                          src={getPrimaryImageUrl(product) as string}
                          alt={product.name}
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <span className="pos-card-thumb is-placeholder" aria-hidden="true">
                        <LuPackageSearch size={22} />
                      </span>
                    )}
                    <span className="pos-card-name">{product.name}</span>
                    <span className="pos-card-meta">
                      {product.sku || "—"}
                    </span>
                    <span className="pos-card-price">
                      {formatRupiah(product.selling_price)}
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "pos-card-stock",
                          out && "is-out"
                        )}
                      >
                        Stok {formatNumber(product.stock, isDecimal ? 1 : 0)}{" "}
                        {product.unit}
                      </span>
                      {!out && status !== "OK" && (
                        <StockBadge status={status} />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ── Cart ── */}
      <aside className="pos-cart" aria-label="Keranjang belanja">
        <div className="pos-cart-head">
          <span className="pos-cart-title">
            <LuShoppingCart size={19} />
            <span>Keranjang</span>
          </span>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={clearCart}
              className="gap-1 text-muted-foreground hover:text-destructive"
            >
              <LuTrash2 size={13} />
              Kosongkan
            </Button>
          )}
        </div>

        {/* Client field: pick existing OR type a free-text name */}
        <div className="pos-client-select">
          <LuUserRound size={16} className="shrink-0 text-muted-foreground" />
          <div className="relative w-full">
            <Input
              type="text"
              aria-label="Nama pelanggan"
              placeholder="Pilih atau ketik nama pelanggan..."
              value={clientName}
              list="pos-client-options"
              autoComplete="off"
              onChange={(e) => {
                const value = e.target.value;
                setClientName(value);
                setClientId(null);

                // Selecting an existing client from the datalist.
                const match = clients.find(
                  (c) => c.name.toLowerCase() === value.trim().toLowerCase()
                );
                setClientId(match ? match.id : null);
              }}
              className="h-9 bg-card pr-8 text-xs"
            />
            {clientName.trim() && (
              <button
                type="button"
                aria-label="Kosongkan nama pelanggan"
                onClick={() => {
                  setClientName("");
                  setClientId(null);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <LuX size={14} />
              </button>
            )}
            <datalist id="pos-client-options">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
        </div>

        {clientName.trim() && isNewClientName && (
          <div className="px-4 pb-2 text-[11px] text-info-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-info/12 px-2 py-0.5">
              <LuPlus size={11} />
              Pelanggan baru &quot;{clientName.trim()}&quot; akan disimpan
            </span>
          </div>
        )}

        {clientError && (
          <div className="px-4 pb-2 text-[11px] text-destructive">
            {clientError}
          </div>
        )}

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <LuShoppingCart size={34} className="text-muted-foreground/50" />
              <p>Keranjang kosong.</p>
              <p className="text-xs">
                Pilih produk di kiri untuk menambahkan.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="pos-line">
                <div className="pos-line-top">
                  <div className="min-w-0">
                    <div className="pos-line-name">{item.name}</div>
                    <div className="pos-line-unit">
                      {formatRupiah(item.selling_price)} / {item.unit}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Hapus ${item.name}`}
                    onClick={() => removeLine(item.product_id)}
                    className="pos-qty-btn text-muted-foreground hover:text-destructive"
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>

                <div className="pos-line-controls">
                  <div className="pos-qty">
                    <button
                      type="button"
                      className="pos-qty-btn"
                      aria-label="Kurangi jumlah"
                      onClick={() => stepQty(item.product_id, -1)}
                    >
                      <LuMinus size={13} />
                    </button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      aria-label={`Jumlah ${item.name}`}
                      className="pos-qty-input"
                      min={0}
                      step={item.is_decimal ? "0.1" : "1"}
                      value={item.qty}
                      onChange={(e) =>
                        setQty(item.product_id, Number(e.target.value))
                      }
                    />
                    <button
                      type="button"
                      className="pos-qty-btn"
                      aria-label="Tambah jumlah"
                      onClick={() => stepQty(item.product_id, 1)}
                    >
                      <LuPlus size={13} />
                    </button>
                  </div>
                  <span className="pos-line-net">
                    {formatRupiah(cartLineNet(item))}
                  </span>
                </div>

                <label className="pos-line-discount">
                  Diskon
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="any"
                    aria-label={`Diskon untuk ${item.name}`}
                    className="pos-line-discount-input"
                    value={item.discount_amount || ""}
                    placeholder="0"
                    onChange={(e) =>
                      setLineDiscount(
                        item.product_id,
                        Number(e.target.value)
                      )
                    }
                  />
                </label>
              </div>
            ))
          )}
        </div>

        <div className="pos-summary">
          <div className="pos-summary-row">
            <span>
              Subtotal • {totals.itemCount} item (
              {formatNumber(totals.qtyTotal, 3)} unit)
            </span>
            <strong>{formatRupiah(totals.subtotal)}</strong>
          </div>

          <div className="pos-summary-row">
            <label htmlFor="header-discount">Diskon Tambahan</label>
            <Input
              id="header-discount"
              type="number"
              inputMode="numeric"
              min={0}
              step="any"
              value={headerDiscount || ""}
              placeholder="0"
              onChange={(e) =>
                setHeaderDiscount(Math.max(0, Number(e.target.value) || 0))
              }
              className="h-8 w-28 text-right font-mono text-xs"
            />
          </div>

          {totals.discountTotal > 0 && (
            <div className="pos-summary-row">
              <span>Total Diskon</span>
              <strong className="text-destructive">
                −{formatRupiah(totals.discountTotal)}
              </strong>
            </div>
          )}

          <div className="pos-summary-total">
            <span>Total</span>
            <span className="pos-summary-total-value">
              {formatRupiah(totals.total)}
            </span>
          </div>

          {cart.length > 0 && !hasClient && (
            <p className="text-center text-[11px] text-destructive">
              Pilih atau ketik nama pelanggan sebelum membayar.
            </p>
          )}

          <Button
            variant="default"
            className="pos-pay-btn w-full gap-2"
            disabled={
              cart.length === 0 || totals.total <= 0 || submitting || !hasClient
            }
            onClick={() => {
              setPayError(null);
              setPaymentOpen(true);
            }}
          >
            <LuCreditCard size={18} />
            <span>Bayar Sekarang</span>
          </Button>
        </div>
      </aside>

      {paymentOpen && (
        <PaymentDialog
          items={cart}
          headerDiscount={headerDiscount}
          clientName={displayClientName}
          submitting={submitting}
          error={payError}
          onClose={() => {
            if (submitting) return;
            setPaymentOpen(false);
          }}
          onSubmit={handleSubmitPayment}
        />
      )}

      {completed && (
        <ReceiptDialog
          transaction={completed.transaction}
          items={completed.items}
          store={store}
          onClose={() => setCompleted(null)}
          onNewTransaction={handleNewTransaction}
        />
      )}

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScan}
      />
    </div>
  );
}