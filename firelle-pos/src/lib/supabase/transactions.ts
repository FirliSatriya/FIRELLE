import type { Database } from "@/types/database.types";
import type {
  CheckoutInput,
  Client,
  Transaction,
  TransactionItem,
} from "@/types/transaction";
import { round2 } from "@/types/transaction";
import { createClient } from "./client";

// ============================================================
// Clients
// ============================================================

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    is_walk_in: row.is_walk_in,
    is_active: row.is_active,
  };
}

/** Active clients, walk-in first, then alphabetical. */
export async function listClients(): Promise<Client[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("is_active", true)
    .order("is_walk_in", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapClient);
}

/**
 * Create a named (non walk-in) client for a POS sale. Both CASHIER and ADMIN
 * may do this per the RLS matrix; walk-in rows are protected by a trigger.
 */
export async function createClientRecord(input: {
  name: string;
  phone?: string;
}): Promise<Client> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      is_walk_in: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Gagal menyimpan data pelanggan.");
  return mapClient(data);
}

// ============================================================
// Transactions
// ============================================================

function toNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The cashier-safe read shape, normalised from either the RPC return or the
 * `transactions_cashier` view (whose columns are nullable).
 */
interface CashierTransactionRow {
  id: string | null;
  invoice_number: string | null;
  client_id: string | null;
  client_name: string | null;
  subtotal_amount: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  payment_method: Database["public"]["Enums"]["payment_method"] | null;
  amount_paid: number | null;
  change_amount: number | null;
  status: Database["public"]["Enums"]["txn_status"] | null;
  notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  created_by: string | null;
  /** Full name of the cashier who made the sale (if known). */
  cashier_name?: string | null;
  created_at: string | null;
}

function mapTransaction(row: CashierTransactionRow): Transaction {
  return {
    id: row.id ?? "",
    invoice_number: row.invoice_number ?? "",
    client_id: row.client_id,
    client_name: row.client_name ?? "Pelanggan Umum",
    subtotal_amount: toNumber(row.subtotal_amount),
    discount_amount: toNumber(row.discount_amount),
    total_amount: toNumber(row.total_amount),
    payment_method: row.payment_method ?? "CASH",
    amount_paid: toNumber(row.amount_paid),
    change_amount: toNumber(row.change_amount),
    status: row.status ?? "COMPLETED",
    notes: row.notes,
    void_reason: row.void_reason,
    voided_at: row.voided_at,
    created_by: row.created_by,
    cashier_name: row.cashier_name ?? null,
    created_at: row.created_at ?? "",
  };
}

/**
 * Atomic, idempotent checkout. The RPC re-reads prices/costs server-side,
 * guards stock (BR-01), validates payment (BR-07) and writes the SALE
 * ledger plus the IN cashflow. Returns the cashier-safe receipt row.
 */
export async function createTransaction(
  input: CheckoutInput,
  idempotencyKey: string
): Promise<Transaction> {
  const supabase = createClient();

  const payload = input.items.map((item) => ({
    product_id: item.product_id,
    qty: item.qty,
    unit_price: item.unit_price,
    discount_amount: round2(item.discount_amount),
  }));

  const { data, error } = await supabase.rpc("create_transaction", {
    p_client_id: input.client_id,
    p_items: payload as unknown as never,
    p_payment_method: input.payment_method,
    p_amount_paid: round2(input.amount_paid),
    p_idempotency_key: idempotencyKey,
    p_discount_amount: round2(input.discount_amount),
    p_notes: input.notes?.trim() || undefined,
  } as never);

  if (error) throw error;
  if (!data) throw new Error("Transaksi gagal: tidak ada data struk yang dikembalikan.");

  return mapTransaction(data as unknown as CashierTransactionRow);
}

/** Transaction history. RLS scopes CASHIER to their own rows. */
export async function listTransactions(limit = 100): Promise<Transaction[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("transactions_cashier")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []).map(mapTransaction);

  // Resolve cashier names: CASHIER sees only their own rows (name = self),
  // ADMIN can look up every creator in one query.
  await attachCashierNames(supabase, rows, user?.id ?? null);

  return rows;
}

/**
 * Fill `cashier_name` on each transaction row. Rows created by the current
 * user take the caller's own full name; remaining unknown creators are
 * resolved with a single `users` lookup (ADMIN-only per RLS — CASHIER on
 * another's rows simply keeps `null`).
 */
async function attachCashierNames(
  supabase: ReturnType<typeof createClient>,
  rows: Transaction[],
  selfId: string | null
): Promise<void> {
  const unknownIds = new Set<string>();
  for (const row of rows) {
    if (row.created_by) unknownIds.add(row.created_by);
  }
  if (unknownIds.size === 0) return;

  let selfName: string | null = null;
  if (selfId) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("id", selfId)
      .maybeSingle();
    selfName = data?.full_name ?? null;
  }

  const names = new Map<string, string>();
  if (selfId && selfName) names.set(selfId, selfName);

  const missing = [...unknownIds].filter((id) => !names.has(id));
  if (missing.length > 0) {
    // ADMIN may read everyone; CASHIER hits RLS here and gets [] back.
    const { data } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", missing);
    for (const u of data ?? []) {
      if (u.full_name) names.set(u.id, u.full_name);
    }
  }

  for (const row of rows) {
    if (row.created_by && names.has(row.created_by)) {
      row.cashier_name = names.get(row.created_by) ?? null;
    }
  }
}

/** Immutable line snapshots for one transaction. */
export async function listTransactionItems(
  transactionId: string
): Promise<TransactionItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transaction_items_cashier")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id ?? "",
    transaction_id: row.transaction_id ?? "",
    product_id: row.product_id,
    product_name: row.product_name ?? "",
    unit: row.unit ?? "Pcs",
    qty: toNumber(row.qty),
    selling_price: toNumber(row.selling_price),
    subtotal: toNumber(row.subtotal),
  }));
}

/** ADMIN-only void: restores stock and writes a reversal cashflow. */
export async function voidTransaction(
  transactionId: string,
  reason: string
): Promise<Transaction> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("void_transaction", {
    p_transaction_id: transactionId,
    p_reason: reason.trim(),
  });

  if (error) throw error;
  if (!data) throw new Error("Pembatalan gagal: transaksi tidak ditemukan.");

  return mapTransaction(data as unknown as CashierTransactionRow);
}