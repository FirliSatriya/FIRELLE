/**
 * Implementasi pelanggan demo (in-memory) — padanan `src/lib/supabase/clients.ts`.
 */
import type {
  Client,
  ClientInput,
  ClientSortField,
  SortDirection,
} from "@/types/client";
import type { Transaction } from "@/types/transaction";
import {
  clone,
  currentDemoUser,
  demoError,
  demoId,
  getDemoState,
  requireDemoAdmin,
} from "./state";

function nowIso(): string {
  return new Date().toISOString();
}

function isAdmin(): boolean {
  return currentDemoUser()?.role === "ADMIN";
}

export async function listClientsSorted(
  sortField: ClientSortField = "name",
  sortDir: SortDirection = "asc"
): Promise<Client[]> {
  const rows = getDemoState().clients.filter(
    // RLS: CASHIER hanya melihat pelanggan aktif; ADMIN boleh melihat arsip.
    (client) => isAdmin() || client.is_active
  );

  rows.sort((a, b) => {
    if (a.is_walk_in !== b.is_walk_in) return a.is_walk_in ? -1 : 1;
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    const cmp = String(av).localeCompare(String(bv), "id-ID");
    return sortDir === "asc" ? cmp : -cmp;
  });

  return rows.map((client) => clone(client));
}

export async function listClientTransactions(
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
  const user = currentDemoUser();
  if (!user) return [];

  return getDemoState()
    .transactions.filter(
      (transaction) =>
        transaction.client_id === clientId &&
        (user.role === "ADMIN" || transaction.created_by === user.id)
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((transaction) => ({
      id: transaction.id,
      invoice_number: transaction.invoice_number,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      status: transaction.status,
      void_reason: transaction.void_reason,
      created_at: transaction.created_at,
    }));
}

export async function createClientRecord(input: ClientInput): Promise<Client> {
  const user = currentDemoUser();
  if (!user) throw demoError("FR009", "UNAUTHENTICATED");

  const createdAt = nowIso();
  const client: Client = {
    id: demoId("client"),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    is_walk_in: false,
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt,
  };

  getDemoState().clients.push(client);
  return clone(client);
}

export async function updateClient(
  clientId: string,
  input: ClientInput
): Promise<void> {
  requireDemoAdmin();
  const client = getDemoState().clients.find((row) => row.id === clientId);
  if (!client) throw demoError("FR011", "CLIENT_NOT_FOUND", clientId);

  if (client.is_walk_in) {
    throw demoError("FR024", "WALK_IN_PROTECTED", client.name);
  }

  client.name = input.name.trim();
  client.phone = input.phone?.trim() || null;
  client.address = input.address?.trim() || null;
  client.updated_at = nowIso();
}

export async function archiveClient(clientId: string): Promise<void> {
  requireDemoAdmin();
  const client = getDemoState().clients.find((row) => row.id === clientId);
  if (!client) throw demoError("FR011", "CLIENT_NOT_FOUND", clientId);

  if (client.is_walk_in) {
    throw demoError("FR024", "WALK_IN_PROTECTED", client.name);
  }

  client.is_active = false;
  client.updated_at = nowIso();
}

export async function restoreClient(clientId: string): Promise<void> {
  requireDemoAdmin();
  const client = getDemoState().clients.find((row) => row.id === clientId);
  if (!client) throw demoError("FR011", "CLIENT_NOT_FOUND", clientId);

  client.is_active = true;
  client.updated_at = nowIso();
}
