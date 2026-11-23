/**
 * Implementasi kas & laporan demo (in-memory) — padanan `src/lib/supabase/finance.ts`.
 */
import {
  OPERATING_CATEGORIES,
  resolveDateRange,
  type Cashflow,
  type CashflowInput,
  type DateRange,
  type DateRangePreset,
} from "@/types/finance";
import {
  clone,
  demoError,
  demoId,
  getDemoState,
  requireDemoAdmin,
} from "./state";

export interface CashflowSummary {
  totalIn: number;
  totalOut: number;
  netCashflow: number;
  grossProfit: number;
  netProfit: number;
}

const OPERATING_CATEGORY_SET = new Set(OPERATING_CATEGORIES);

function inRange(iso: string, range?: DateRange): boolean {
  if (!range) return true;
  const time = new Date(iso).getTime();
  if (range.start && time < range.start.getTime()) return false;
  if (range.end && time >= range.end.getTime()) return false;
  return true;
}

export async function listCashflows(range?: DateRange): Promise<Cashflow[]> {
  return getDemoState()
    .cashflows.filter((row) => inRange(row.occurred_at, range))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((row) => clone(row));
}

export async function listCashflowsForPreset(
  preset: DateRangePreset,
  custom?: { start?: string; end?: string },
  now: Date = new Date()
): Promise<Cashflow[]> {
  return listCashflows(resolveDateRange(preset, custom, now));
}

export async function createCashflow(
  input: CashflowInput
): Promise<Cashflow> {
  const admin = requireDemoAdmin();
  const createdAt = new Date().toISOString();

  const row: Cashflow = {
    id: demoId("cf"),
    type: input.type,
    amount: input.amount,
    category: input.category.trim(),
    description: input.description?.trim() || null,
    is_manual: true,
    transaction_id: null,
    occurred_at: input.occurred_at,
    created_by: admin.id,
    created_at: createdAt,
    updated_at: createdAt,
  };

  getDemoState().cashflows.push(row);
  return clone(row);
}

export async function updateCashflow(
  id: string,
  input: CashflowInput
): Promise<Cashflow> {
  requireDemoAdmin();
  const row = getDemoState().cashflows.find((item) => item.id === id);

  if (!row) {
    throw demoError("FR011", "CASHFLOW_NOT_FOUND", id);
  }
  if (!row.is_manual) {
    throw new Error("Catatan kas tidak ditemukan atau bukan entri manual.");
  }

  row.type = input.type;
  row.amount = input.amount;
  row.category = input.category.trim();
  row.description = input.description?.trim() || null;
  row.occurred_at = input.occurred_at;
  row.updated_at = new Date().toISOString();

  return clone(row);
}

export async function deleteCashflow(id: string): Promise<void> {
  requireDemoAdmin();
  const state = getDemoState();
  const row = state.cashflows.find((item) => item.id === id);

  if (!row) return;
  if (!row.is_manual) {
    throw new Error("Catatan kas otomatis tidak dapat dihapus.");
  }

  state.cashflows = state.cashflows.filter((item) => item.id !== id);
}

export async function getCashflowSummary(
  range: DateRange
): Promise<CashflowSummary> {
  const state = getDemoState();
  const cashflows = state.cashflows.filter((row) =>
    inRange(row.occurred_at, range)
  );

  let totalIn = 0;
  let totalOut = 0;
  let operatingOut = 0;

  for (const row of cashflows) {
    if (row.type === "IN") {
      totalIn += row.amount;
    } else {
      totalOut += row.amount;
      if (row.is_manual && OPERATING_CATEGORY_SET.has(row.category)) {
        operatingOut += row.amount;
      }
    }
  }

  const grossProfit = state.transactions
    .filter(
      (transaction) =>
        transaction.status === "COMPLETED" &&
        inRange(transaction.created_at, range)
    )
    .reduce((sum, transaction) => sum + transaction.total_profit, 0);

  return {
    totalIn,
    totalOut,
    netCashflow: totalIn - totalOut,
    grossProfit,
    netProfit: grossProfit - operatingOut,
  };
}
