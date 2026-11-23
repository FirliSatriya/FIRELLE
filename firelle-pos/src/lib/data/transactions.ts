/**
 * Fasad data transaksi & POS — Supabase (production) atau in-memory (demo).
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demo from "@/lib/demo/transactions";
import * as production from "@/lib/supabase/transactions";
import type {
  CheckoutInput,
  Client,
  Transaction,
  TransactionItem,
} from "@/types/transaction";

export function listClients(): Promise<Client[]> {
  return isDemoMode() ? demo.listClients() : production.listClients();
}

export function createClientRecord(input: {
  name: string;
  phone?: string;
}): Promise<Client> {
  return isDemoMode()
    ? demo.createClientRecord(input)
    : production.createClientRecord(input);
}

export function createTransaction(
  input: CheckoutInput,
  idempotencyKey: string
): Promise<Transaction> {
  return isDemoMode()
    ? demo.createTransaction(input, idempotencyKey)
    : production.createTransaction(input, idempotencyKey);
}

export function listTransactions(limit = 100): Promise<Transaction[]> {
  return isDemoMode()
    ? demo.listTransactions(limit)
    : production.listTransactions(limit);
}

export function listTransactionItems(
  transactionId: string
): Promise<TransactionItem[]> {
  return isDemoMode()
    ? demo.listTransactionItems(transactionId)
    : production.listTransactionItems(transactionId);
}

export function voidTransaction(
  transactionId: string,
  reason: string
): Promise<Transaction> {
  return isDemoMode()
    ? demo.voidTransaction(transactionId, reason)
    : production.voidTransaction(transactionId, reason);
}
