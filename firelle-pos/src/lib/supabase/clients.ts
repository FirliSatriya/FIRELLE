import type { Database } from "@/types/database.types";
import type { Client, ClientInput, ClientSortField, SortDirection } from "@/types/client";
import { createClient } from "./client";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    is_walk_in: row.is_walk_in,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Every client visible to the caller. RLS already scopes CASHIER to active
 * rows and lets ADMIN read archived ones (see `clients_select_scope`).
 */
export async function listClientsSorted(
  sortField: ClientSortField = "name",
  sortDir: SortDirection = "asc"
): Promise<Client[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    // Walk-in first so the shared "Pelanggan Umum" row stays pinned on top.
    .order("is_walk_in", { ascending: false })
    .order(sortField, { ascending: sortDir === "asc" });

  if (error) throw error;
  return (data ?? []).map(mapClient);
}

/** Transactions for one client, newest first. RLS already scopes the rows. */
export async function listClientTransactions(
  clientId: string,
  limit = 50
): Promise<
  Pick<
    import("@/types/transaction").Transaction,
    | "id"
    | "invoice_number"
    | "total_amount"
    | "payment_method"
    | "status"
    | "void_reason"
    | "created_at"
  >[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions_cashier")
    .select(
      "id, invoice_number, total_amount, payment_method, status, void_reason, created_at"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id ?? "",
    invoice_number: row.invoice_number ?? "",
    total_amount: row.total_amount ?? 0,
    payment_method: row.payment_method ?? "CASH",
    status: row.status ?? "COMPLETED",
    void_reason: row.void_reason,
    created_at: row.created_at ?? "",
  }));
}

export async function createClientRecord(input: ClientInput): Promise<Client> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      is_walk_in: false,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Gagal menyimpan data pelanggan.");
  return mapClient(data);
}

export async function updateClient(
  clientId: string,
  input: ClientInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
    })
    .eq("id", clientId);

  if (error) throw error;
}

/** Soft archive: keeps the client's transaction history intact (BR). */
export async function archiveClient(clientId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_active: false })
    .eq("id", clientId);

  if (error) throw error;
}

export async function restoreClient(clientId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_active: true })
    .eq("id", clientId);

  if (error) throw error;
}