/**
 * Fasad data pelanggan — Supabase (production) atau in-memory (demo).
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demo from "@/lib/demo/clients";
import * as production from "@/lib/supabase/clients";
import type {
  Client,
  ClientInput,
  ClientSortField,
  SortDirection,
} from "@/types/client";
import type { Transaction } from "@/types/transaction";

export function listClientsSorted(
  sortField: ClientSortField = "name",
  sortDir: SortDirection = "asc"
): Promise<Client[]> {
  return isDemoMode()
    ? demo.listClientsSorted(sortField, sortDir)
    : production.listClientsSorted(sortField, sortDir);
}

export function listClientTransactions(
  clientId: string,
  limit = 50
): Promise<
  Pick<
    Transaction,
    | "id"
    | "invoice_number"
    | "total_amount"
    | "payment_method"
    | "status"
    | "void_reason"
    | "created_at"
  >[]
> {
  return isDemoMode()
    ? demo.listClientTransactions(clientId, limit)
    : production.listClientTransactions(clientId, limit);
}

export function createClientRecord(input: ClientInput): Promise<Client> {
  return isDemoMode()
    ? demo.createClientRecord(input)
    : production.createClientRecord(input);
}

export function updateClient(
  clientId: string,
  input: ClientInput
): Promise<void> {
  return isDemoMode()
    ? demo.updateClient(clientId, input)
    : production.updateClient(clientId, input);
}

export function archiveClient(clientId: string): Promise<void> {
  return isDemoMode()
    ? demo.archiveClient(clientId)
    : production.archiveClient(clientId);
}

export function restoreClient(clientId: string): Promise<void> {
  return isDemoMode()
    ? demo.restoreClient(clientId)
    : production.restoreClient(clientId);
}
