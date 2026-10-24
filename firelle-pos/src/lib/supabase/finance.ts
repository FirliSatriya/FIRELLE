import type { Database } from "@/types/database.types";
import type { DateRange, Cashflow, CashflowInput } from "@/types/finance";
import { resolveDateRange } from "@/types/finance";
import { createClient } from "./client";

// ============================================================
// Cashflow module (PRD v2.0 — Module 6) — ADMIN only.
// Reads and manual writes go through the `cashflows` table; auto rows
// (is_manual = false) are locked by RLS + the immutability trigger.
// ============================================================

type CashflowRow = Database["public"]["Tables"]["cashflows"]["Row"];

function toNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCashflow(row: CashflowRow): Cashflow {
  return {
    id: row.id,
    type: row.type,
    amount: toNumber(row.amount),
    category: row.category,
    description: row.description,
    is_manual: row.is_manual,
    transaction_id: row.transaction_id,
    occurred_at: row.occurred_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * List cashflows within a date range, newest first. The caller (ADMIN) sees
 * every row; `start` is inclusive and `end` exclusive.
 */
export async function listCashflows(range?: DateRange): Promise<Cashflow[]> {
  const supabase = createClient();

  let query = supabase
    .from("cashflows")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (range?.start) {
    query = query.gte("occurred_at", range.start.toISOString());
  }
  if (range?.end) {
    query = query.lt("occurred_at", range.end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapCashflow);
}

/** Convenience wrapper: list using a preset instead of a resolved range. */
export async function listCashflowsForPreset(
  preset: Parameters<typeof resolveDateRange>[0],
  custom?: { start?: string; end?: string },
  now: Date = new Date()
): Promise<Cashflow[]> {
  return listCashflows(resolveDateRange(preset, custom, now));
}

/** Create a manual cashflow entry (Module 6.2). `created_by` is the session. */
export async function createCashflow(input: CashflowInput): Promise<Cashflow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cashflows")
    .insert({
      type: input.type,
      amount: input.amount,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      occurred_at: input.occurred_at,
      is_manual: true,
      transaction_id: null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Gagal menyimpan catatan kas.");
  return mapCashflow(data);
}

/** Update a manual entry. Auto rows are rejected by RLS and the DB trigger. */
export async function updateCashflow(
  id: string,
  input: CashflowInput
): Promise<Cashflow> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cashflows")
    .update({
      type: input.type,
      amount: input.amount,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      occurred_at: input.occurred_at,
    })
    .eq("id", id)
    .eq("is_manual", true)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Catatan kas tidak ditemukan atau bukan entri manual.");
  return mapCashflow(data);
}

/** Delete a manual entry only (BR-05). */
export async function deleteCashflow(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cashflows")
    .delete()
    .eq("id", id)
    .eq("is_manual", true);

  if (error) throw error;
}

// ============================================================
// Dashboard metrics (BR-06)
// ============================================================

export interface CashflowSummary {
  /** Σ IN over the range. */
  totalIn: number;
  /** Σ OUT over the range. */
  totalOut: number;
  /** totalIn − totalOut. */
  netCashflow: number;
  /** Gross Profit from COMPLETED sales in the range (stored on transactions). */
  grossProfit: number;
  /** Gross Profit − manual OUT in operating categories. */
  netProfit: number;
}

/**
 * Summarise a set of cashflows plus the Gross Profit of the matching sales.
 *
 * Gross Profit is read straight from `transactions.total_profit` (COMPLETED
 * only) because that column is a snapshot computed at sale time; recomputing it
 * client-side would risk drift (BR-06).
 */
export async function getCashflowSummary(
  range: DateRange
): Promise<CashflowSummary> {
  const supabase = createClient();

  const [cashflows, profitResult] = await Promise.all([
    listCashflows(range),
    (() => {
      let q = supabase
        .from("transactions_admin")
        .select("total_profit, status")
        .eq("status", "COMPLETED");
      if (range.start) q = q.gte("created_at", range.start.toISOString());
      if (range.end) q = q.lt("created_at", range.end.toISOString());
      return q;
    })(),
  ]);

  if (profitResult.error) throw profitResult.error;

  let totalIn = 0;
  let totalOut = 0;
  for (const row of cashflows) {
    if (row.type === "IN") totalIn += row.amount;
    else totalOut += row.amount;
  }

  const operatingOut = cashflows
    .filter(
      (row) =>
        row.type === "OUT" &&
        row.is_manual &&
        OPERATING_CATEGORY_SET.has(row.category)
    )
    .reduce((sum, row) => sum + row.amount, 0);

  const grossProfit = (profitResult.data ?? []).reduce(
    (sum, row) => sum + toNumber(row.total_profit),
    0
  );

  return {
    totalIn,
    totalOut,
    netCashflow: totalIn - totalOut,
    grossProfit,
    netProfit: grossProfit - operatingOut,
  };
}

const OPERATING_CATEGORY_SET = new Set([
  "Operational Expense",
  "Rent",
  "Utilities",
  "Salary",
]);