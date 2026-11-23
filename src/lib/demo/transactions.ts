/**
 * Implementasi transaksi & POS demo (in-memory).
 *
 * Aturan validasi meniru RPC `create_transaction` / `void_transaction`: kode
 * error FRxxx yang sama, sehingga `getErrorMessage()` menampilkan pesan yang
 * identik dengan mode production.
 */
import {
  round2,
  type CheckoutInput,
  type Client,
  type Transaction,
  type TransactionItem,
} from "@/types/transaction";
import {
  currentDemoUser,
  demoError,
  demoId,
  getDemoState,
  nextDemoInvoiceNumber,
  requireDemoAdmin,
} from "./state";
import type { DemoTransactionRecord } from "./seed";

function nowIso(): string {
  return new Date().toISOString();
}

function toTransaction(record: DemoTransactionRecord): Transaction {
  return {
    id: record.id,
    invoice_number: record.invoice_number,
    client_id: record.client_id,
    client_name: record.client_name,
    subtotal_amount: record.subtotal_amount,
    discount_amount: record.discount_amount,
    total_amount: record.total_amount,
    payment_method: record.payment_method,
    amount_paid: record.amount_paid,
    change_amount: record.change_amount,
    status: record.status,
    notes: record.notes,
    void_reason: record.void_reason,
    voided_at: record.voided_at,
    created_by: record.created_by,
    cashier_name: record.cashier_name,
    created_at: record.created_at,
  };
}

// ============================================================
// Clients (bentuk ringkas untuk POS)
// ============================================================

export async function listClients(): Promise<Client[]> {
  return getDemoState()
    .clients.filter((client) => client.is_active)
    .sort((a, b) => {
      if (a.is_walk_in !== b.is_walk_in) return a.is_walk_in ? -1 : 1;
      return a.name.localeCompare(b.name, "id-ID");
    })
    .map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      address: client.address,
      is_walk_in: client.is_walk_in,
      is_active: client.is_active,
    }));
}

/** Buat pelanggan cepat dari layar POS (CASHIER & ADMIN). */
export async function createClientRecord(input: {
  name: string;
  phone?: string;
}): Promise<Client> {
  const user = currentDemoUser();
  if (!user) throw demoError("FR009", "UNAUTHENTICATED");

  const createdAt = nowIso();
  const record = {
    id: demoId("client"),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: null,
    is_walk_in: false,
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt,
  };

  getDemoState().clients.push(record);

  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    address: record.address,
    is_walk_in: record.is_walk_in,
    is_active: record.is_active,
  };
}

// ============================================================
// Transactions
// ============================================================

export async function createTransaction(
  input: CheckoutInput,
  idempotencyKey: string
): Promise<Transaction> {
  const user = currentDemoUser();
  if (!user) throw demoError("FR009", "UNAUTHENTICATED");
  if (!idempotencyKey) {
    throw demoError("FR015", "INVALID_IDEMPOTENCY_KEY");
  }

  const state = getDemoState();

  // Replay idempotent: key yang sama mengembalikan transaksi yang sama.
  const replayId = state.idempotency.get(idempotencyKey);
  if (replayId) {
    const replay = state.transactions.find((row) => row.id === replayId);
    if (replay) return toTransaction(replay);
  }

  if (!input.items || input.items.length === 0) {
    throw demoError("FR008", "EMPTY_CART");
  }

  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.product_id)) {
      throw demoError(
        "FR012",
        "DUPLICATE_ITEM",
        "A product may only appear once per transaction."
      );
    }
    seen.add(item.product_id);
  }

  const client = state.clients.find(
    (row) => row.id === input.client_id && row.is_active
  );
  if (!client) {
    throw demoError(
      "FR017",
      "CLIENT_NOT_FOUND",
      input.client_id ?? "no active client"
    );
  }

  const allowNegative = state.settings.allow_negative_stock;
  const lines: Array<{
    product: (typeof state.products)[number];
    qty: number;
    discount: number;
    subtotal: number;
  }> = [];

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let totalCost = 0;

  for (const item of input.items) {
    const qty = Math.round(item.qty * 1000) / 1000;
    const discount = round2(item.discount_amount);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw demoError(
        "FR007",
        "INVALID_QUANTITY",
        `Product ${item.product_id} qty must be > 0.`
      );
    }

    if (!Number.isFinite(discount) || discount < 0) {
      throw demoError(
        "FR016",
        "INVALID_AMOUNT",
        "Line discount may not be negative."
      );
    }

    const product = state.products.find((row) => row.id === item.product_id);
    if (!product) {
      throw demoError("FR013", "PRODUCT_NOT_FOUND", item.product_id);
    }

    if (product.is_deleted) {
      throw demoError(
        "FR002",
        "PRODUCT_ARCHIVED",
        `${product.name} (${product.sku}) is archived.`
      );
    }

    if (!allowNegative && product.stock < qty) {
      throw demoError(
        "FR001",
        "INSUFFICIENT_STOCK",
        `${product.name}: available=${product.stock} requested=${qty}`
      );
    }

    if (
      item.unit_price != null &&
      round2(item.unit_price) !== round2(product.selling_price)
    ) {
      throw demoError(
        "FR003",
        "PRICE_CHANGED",
        `${product.name}: client=${item.unit_price} current=${product.selling_price}`
      );
    }

    const lineGross = round2(product.selling_price * qty);
    if (discount > lineGross) {
      throw demoError(
        "FR004",
        "DISCOUNT_EXCEEDS_SUBTOTAL",
        `Line discount exceeds line subtotal for ${product.name}.`
      );
    }

    subtotal = round2(subtotal + lineGross);
    lineDiscountTotal = round2(lineDiscountTotal + discount);
    totalCost = round2(totalCost + round2(product.cost_price * qty));
    lines.push({ product, qty, discount, subtotal: lineGross });
  }

  const headerDiscount = round2(input.discount_amount ?? 0);
  if (headerDiscount < 0) {
    throw demoError("FR016", "INVALID_AMOUNT", "Discount may not be negative.");
  }

  const discountTotal = round2(lineDiscountTotal + headerDiscount);
  if (discountTotal > subtotal) {
    throw demoError(
      "FR004",
      "DISCOUNT_EXCEEDS_SUBTOTAL",
      `discount=${discountTotal} subtotal=${subtotal}`
    );
  }

  const total = round2(subtotal - discountTotal);
  const paid = round2(input.amount_paid);

  if (!Number.isFinite(paid) || paid < 0) {
    throw demoError(
      "FR021",
      "INVALID_PAYMENT",
      "amount_paid may not be negative."
    );
  }

  if (paid < total) {
    if (input.payment_method === "CASH") {
      throw demoError(
        "FR005",
        "INSUFFICIENT_PAYMENT",
        `total=${total} paid=${paid}`
      );
    }
    throw demoError(
      "FR021",
      "INVALID_PAYMENT",
      `${input.payment_method} must be paid exactly (total=${total} paid=${paid}).`
    );
  }

  if (input.payment_method !== "CASH" && paid !== total) {
    throw demoError(
      "FR021",
      "INVALID_PAYMENT",
      `${input.payment_method} must be paid exactly (total=${total} paid=${paid}).`
    );
  }

  const createdAt = nowIso();
  const invoiceNumber = nextDemoInvoiceNumber(state, new Date());
  const transactionId = demoId("tx");

  const items: TransactionItem[] = lines.map((line, index) => ({
    id: `${transactionId}-item-${index + 1}`,
    transaction_id: transactionId,
    product_id: line.product.id,
    product_name: line.product.name,
    unit: line.product.unit,
    qty: line.qty,
    selling_price: line.product.selling_price,
    subtotal: line.subtotal,
  }));

  const record: DemoTransactionRecord = {
    id: transactionId,
    invoice_number: invoiceNumber,
    client_id: client.id,
    client_name: client.name,
    subtotal_amount: subtotal,
    discount_amount: discountTotal,
    total_amount: total,
    payment_method: input.payment_method,
    amount_paid: paid,
    change_amount: round2(paid - total),
    status: "COMPLETED",
    notes: input.notes?.trim() || null,
    void_reason: null,
    voided_at: null,
    created_by: user.id,
    cashier_name: user.fullName,
    created_at: createdAt,
    total_cost: totalCost,
    total_profit: round2(total - totalCost),
    items,
  };

  state.transactions.push(record);
  state.idempotency.set(idempotencyKey, record.id);

  // Snapshot stok + ledger SALE.
  lines.forEach((line, index) => {
    line.product.stock = round2(line.product.stock - line.qty);
    line.product.updated_at = createdAt;
    state.stockMovements.push({
      id: `${transactionId}-sm-${index + 1}`,
      product_id: line.product.id,
      type: "SALE",
      qty_change: -line.qty,
      stock_after: line.product.stock,
      reason: null,
      note: null,
      transaction_id: transactionId,
      created_by: user.id,
      created_by_name: user.fullName,
      created_at: createdAt,
    });
  });

  // Auto cashflow IN (immutable di production, di demo ikut state).
  if (total > 0) {
    state.cashflows.push({
      id: `${transactionId}-cf-in`,
      type: "IN",
      amount: total,
      category: "SALE",
      description: `Invoice ${invoiceNumber}`,
      is_manual: false,
      transaction_id: transactionId,
      occurred_at: createdAt,
      created_by: user.id,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return toTransaction(record);
}

export async function listTransactions(limit = 100): Promise<Transaction[]> {
  const user = currentDemoUser();
  if (!user) return [];

  // RLS: CASHIER hanya membaca transaksinya sendiri; ADMIN membaca semua.
  return [...getDemoState().transactions]
    .filter((row) => user.role === "ADMIN" || row.created_by === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(toTransaction);
}

export async function listTransactionItems(
  transactionId: string
): Promise<TransactionItem[]> {
  const user = currentDemoUser();
  if (!user) return [];

  const record = getDemoState().transactions.find(
    (row) => row.id === transactionId
  );
  if (!record) return [];
  if (user.role !== "ADMIN" && record.created_by !== user.id) return [];

  return record.items.map((item) => ({ ...item }));
}

export async function voidTransaction(
  transactionId: string,
  reason: string
): Promise<Transaction> {
  const admin = requireDemoAdmin();
  const state = getDemoState();
  const record = state.transactions.find((row) => row.id === transactionId);

  if (!record) {
    throw demoError("FR011", "TRANSACTION_NOT_FOUND", transactionId);
  }

  if (record.status !== "COMPLETED") {
    throw demoError("FR006", "ALREADY_VOID", record.invoice_number);
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    throw demoError("FR018", "VOID_REASON_REQUIRED");
  }

  const voidedAt = nowIso();

  // Kembalikan stok + ledger VOID_RETURN.
  record.items.forEach((item, index) => {
    if (!item.product_id) return;
    const product = state.products.find((row) => row.id === item.product_id);
    if (!product) return;

    product.stock = round2(product.stock + item.qty);
    product.updated_at = voidedAt;

    state.stockMovements.push({
      id: `${record.id}-void-${index + 1}`,
      product_id: product.id,
      type: "VOID_RETURN",
      qty_change: item.qty,
      stock_after: product.stock,
      reason: null,
      note: `Void ${record.invoice_number}`,
      transaction_id: record.id,
      created_by: admin.id,
      created_by_name: admin.fullName,
      created_at: voidedAt,
    });
  });

  record.status = "VOID";
  record.void_reason = trimmed;
  record.voided_at = voidedAt;

  if (record.total_amount > 0) {
    state.cashflows.push({
      id: `${record.id}-cf-void-${demoId("cf")}`,
      type: "OUT",
      amount: record.total_amount,
      category: "VOID",
      description: `Void ${record.invoice_number}`,
      is_manual: false,
      transaction_id: record.id,
      occurred_at: voidedAt,
      created_by: admin.id,
      created_at: voidedAt,
      updated_at: voidedAt,
    });
  }

  return toTransaction(record);
}
