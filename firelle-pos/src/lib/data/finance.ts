/**
 * Fasad data keuangan — Supabase (production) atau in-memory (demo).
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demoFinance from "@/lib/demo/finance";
import * as production from "@/lib/supabase/finance";
import type {
  Cashflow,
  CashflowInput,
  DateRange,
  DateRangePreset,
} from "@/types/finance";

export type { CashflowSummary } from "@/lib/supabase/finance";

export function listCashflows(range?: DateRange): Promise<Cashflow[]> {
  return isDemoMode()
    ? demoFinance.listCashflows(range)
    : production.listCashflows(range);
}

export function listCashflowsForPreset(
  preset: DateRangePreset,
  custom?: { start?: string; end?: string },
  now: Date = new Date()
): Promise<Cashflow[]> {
  return isDemoMode()
    ? demoFinance.listCashflowsForPreset(preset, custom, now)
    : production.listCashflowsForPreset(preset, custom, now);
}

export function createCashflow(input: CashflowInput): Promise<Cashflow> {
  return isDemoMode()
    ? demoFinance.createCashflow(input)
    : production.createCashflow(input);
}

export function updateCashflow(
  id: string,
  input: CashflowInput
): Promise<Cashflow> {
  return isDemoMode()
    ? demoFinance.updateCashflow(id, input)
    : production.updateCashflow(id, input);
}

export function deleteCashflow(id: string): Promise<void> {
  return isDemoMode()
    ? demoFinance.deleteCashflow(id)
    : production.deleteCashflow(id);
}

export function getCashflowSummary(
  range: DateRange
): Promise<import("@/lib/supabase/finance").CashflowSummary> {
  return isDemoMode()
    ? demoFinance.getCashflowSummary(range)
    : production.getCashflowSummary(range);
}
