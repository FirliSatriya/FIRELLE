"use client";

import React, { useMemo, useState } from "react";
import {
  LuBanknote,
  LuQrCode,
  LuLandmark,
  LuTriangleAlert,
  LuCircleCheck,
  LuPrinter,
  LuPlus,
} from "react-icons/lu";
import {
  calcCartTotals,
  quickCashSuggestions,
  round2,
  type CartItem,
  type PaymentMethod,
} from "@/types/transaction";
import { formatRupiah } from "@/types/product";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/components/ui/money-text";
import { StatusBadge } from "@/components/ui/status-badge";

const METHODS: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  { value: "CASH", label: "Tunai", hint: "Uang fisik", icon: <LuBanknote size={16} /> },
  { value: "QRIS", label: "QRIS", hint: "Scan kode", icon: <LuQrCode size={16} /> },
  {
    value: "TRANSFER",
    label: "Transfer",
    hint: "Bank / e-wallet",
    icon: <LuLandmark size={16} />,
  },
];

export interface PaymentDialogProps {
  items: CartItem[];
  headerDiscount: number;
  clientName: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    payment_method: PaymentMethod;
    amount_paid: number;
  }) => void | Promise<void>;
}

export function PaymentDialog({
  items,
  headerDiscount,
  clientName,
  submitting,
  error,
  onClose,
  onSubmit,
}: PaymentDialogProps) {
  const totals = useMemo(
    () => calcCartTotals(items, headerDiscount),
    [items, headerDiscount]
  );

  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [paidInput, setPaidInput] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);

  const paid = useMemo(() => {
    const parsed = Number(paidInput);
    return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : 0;
  }, [paidInput]);

  const change = round2(paid - totals.total);
  const isCash = method === "CASH";
  const isShort = isCash && paid > 0 && change < 0;
  const canSubmit = isCash
    ? paid >= totals.total
    : paid === totals.total || paidInput === "";

  const suggestions = useMemo(
    () => quickCashSuggestions(totals.total),
    [totals.total]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (totals.total <= 0) {
      setLocalError("Total transaksi harus lebih dari Rp 0.");
      return;
    }

    if (isCash && paid < totals.total) {
      setLocalError("Uang tunai kurang dari total tagihan.");
      return;
    }

    const finalPaid = isCash ? paid : totals.total;
    await onSubmit({ payment_method: method, amount_paid: finalPaid });
  };

  const shownError = localError ?? error;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-lg">Pembayaran</DialogTitle>
          <DialogDescription>
            {clientName} • {totals.itemCount} item
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Due summary */}
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">
              Total Tagihan
            </span>
            <MoneyText
              value={totals.total}
              className="text-xl font-bold text-primary"
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-secondary-foreground">
              Metode Pembayaran
            </label>
            <Select
              value={method}
              onValueChange={(value) => {
                setMethod(value as PaymentMethod);
                setPaidInput("");
                setLocalError(null);
              }}
              disabled={submitting}
            >
              <SelectTrigger className="h-11 w-full" aria-label="Metode Pembayaran">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      {m.icon}
                      <span>{m.label}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {m.hint}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cash input + quick amounts */}
          {isCash ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary-foreground">
                Uang Diterima
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step="any"
                value={paidInput}
                onChange={(e) => {
                  setPaidInput(e.target.value);
                  setLocalError(null);
                }}
                placeholder={String(totals.total)}
                autoFocus
                className="h-12 font-mono text-lg"
              />
              <div className="pos-cash-quick">
                {suggestions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setPaidInput(String(amount));
                      setLocalError(null);
                    }}
                    className={cn(
                      "pos-cash-chip",
                      paid === amount && "active"
                    )}
                  >
                    {amount === totals.total
                      ? "Uang Pas"
                      : formatRupiah(amount).replace("Rp", "Rp ")}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-xs text-info-foreground">
              <LuCircleCheck size={15} className="mt-0.5 shrink-0" />
              <span>
                Pembayaran {method === "QRIS" ? "QRIS" : "transfer"} harus tepat
                sebesar <strong>{formatRupiah(totals.total)}</strong>.
              </span>
            </div>
          )}

          {/* Change */}
          {isCash && paid > 0 && (
            <div className={cn("pos-change-banner", isShort && "is-short")}>
              <span className="text-xs font-medium">
                {isShort ? "Kurang" : "Kembalian"}
              </span>
              <span
                className={cn(
                  "pos-change-value",
                  isShort ? "text-destructive" : "text-success-foreground"
                )}
              >
                {formatRupiah(Math.abs(change))}
              </span>
            </div>
          )}

          {shownError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <LuTriangleAlert size={15} className="mt-0.5 shrink-0" />
              <span>{shownError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting || !canSubmit || totals.total <= 0}
              className="gap-1.5"
            >
              <LuCircleCheck size={16} />
              <span>{submitting ? "Memproses..." : "Bayar & Cetak Struk"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ReceiptProps {
  transaction: {
    invoice_number: string;
    client_name: string;
    created_at: string;
    payment_method: PaymentMethod;
    subtotal_amount: number;
    discount_amount: number;
    total_amount: number;
    amount_paid: number;
    change_amount: number;
    status: "COMPLETED" | "VOID";
    /** Cashier who handled the sale; falls back to a neutral label. */
    cashier_name?: string | null;
  };
  items: {
    product_name: string;
    qty: number;
    unit: string;
    selling_price: number;
    subtotal: number;
  }[];
  store: {
    store_name: string;
    store_address: string | null;
    store_phone: string | null;
    receipt_footer: string | null;
  } | null;
}

const METHOD_LABELS_RECEIPT: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
};

export function Receipt({ transaction, items, store }: ReceiptProps) {
  const date = new Date(transaction.created_at);
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const qtyLabel = (qty: number, unit: string) =>
    `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(qty)} ${unit}`;

  return (
    <div className="receipt">
      <div className="receipt-head">
        <div className="receipt-store-name">
          {store?.store_name || "Firelle"}
        </div>
        {store?.store_address && (
          <div className="receipt-store-meta">{store.store_address}</div>
        )}
        {store?.store_phone && (
          <div className="receipt-store-meta">Telp. {store.store_phone}</div>
        )}
      </div>

      <hr className="receipt-rule" />

      <div className="receipt-row">
        <span>No. Invoice</span>
        <span>{transaction.invoice_number}</span>
      </div>
      <div className="receipt-row">
        <span>Tanggal</span>
        <span>
          {dateLabel} {timeLabel}
        </span>
      </div>
      <div className="receipt-row">
        <span>Pelanggan</span>
        <span>{transaction.client_name}</span>
      </div>
      <div className="receipt-row">
        <span>Kasir</span>
        <span>{transaction.cashier_name || "—"}</span>
      </div>

      <hr className="receipt-rule" />

      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={index}>
            <div className="receipt-item-name">{item.product_name}</div>
            <div className="receipt-row">
              <span>
                {qtyLabel(item.qty, item.unit)} ×{" "}
                {formatRupiah(item.selling_price)}
              </span>
              <span>{formatRupiah(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <hr className="receipt-rule" />

      <div className="receipt-row">
        <span>Subtotal</span>
        <span>{formatRupiah(transaction.subtotal_amount)}</span>
      </div>
      {transaction.discount_amount > 0 && (
        <div className="receipt-row">
          <span>Diskon</span>
          <span>−{formatRupiah(transaction.discount_amount)}</span>
        </div>
      )}

      <hr className="receipt-rule" />

      <div className="receipt-total-row">
        <span>TOTAL</span>
        <span>{formatRupiah(transaction.total_amount)}</span>
      </div>

      <hr className="receipt-rule" />

      <div className="receipt-row">
        <span>{METHOD_LABELS_RECEIPT[transaction.payment_method]}</span>
        <span>{formatRupiah(transaction.amount_paid)}</span>
      </div>
      <div className="receipt-row">
        <span>Kembalian</span>
        <span>{formatRupiah(transaction.change_amount)}</span>
      </div>

      {transaction.status === "VOID" && (
        <>
          <hr className="receipt-rule" />
          <div className="text-center font-bold">*** DIBATALKAN ***</div>
        </>
      )}

      <hr className="receipt-rule" />

      <div className="receipt-foot">
        <p>{store?.receipt_footer || "Terima kasih telah berbelanja."}</p>
        <p className="mt-1">Barang yang sudah dibeli tidak dapat ditukar</p>
      </div>
    </div>
  );
}

export interface ReceiptDialogProps {
  transaction: ReceiptProps["transaction"];
  items: ReceiptProps["items"];
  store: ReceiptProps["store"];
  onClose: () => void;
  onNewTransaction: () => void;
}

export function ReceiptDialog({
  transaction,
  items,
  store,
  onClose,
  onNewTransaction,
}: ReceiptDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-success/15 text-success-foreground">
            <LuCircleCheck size={24} />
          </div>
          <DialogTitle className="text-lg">Transaksi Berhasil</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge
              variant={transaction.status === "VOID" ? "void" : "completed"}
              label={transaction.status === "VOID" ? "Dibatalkan" : "Selesai"}
            />
            <span className="font-mono text-[11px]">
              {transaction.invoice_number}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border bg-card">
          <div className="receipt-print-area">
            <Receipt transaction={transaction} items={items} store={store} />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="default"
            className="w-full gap-1.5"
            onClick={() => window.print()}
          >
            <LuPrinter size={16} />
            <span>Cetak Struk</span>
          </Button>
          <Button
            variant="secondary"
            className="w-full gap-1.5"
            onClick={onNewTransaction}
          >
            <LuPlus size={16} />
            <span>Transaksi Baru</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}