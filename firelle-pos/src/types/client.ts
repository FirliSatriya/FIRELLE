// ============================================================
// Client (Pelanggan) Types
// Based on PRD v2.0 — `clients` table (§4.A)
// ============================================================

/** Client entity — a named customer or the shared walk-in row. */
export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  /** The protected "Pelanggan Umum" fallback used when no client is chosen. */
  is_walk_in: boolean;
  /** Archived clients (`false`) are hidden from the POS picker. */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Form payload for creating or editing a client. */
export interface ClientInput {
  name: string;
  phone?: string;
  address?: string;
}

export type ClientSortField = "name" | "phone" | "created_at";
export type SortDirection = "asc" | "desc";

/** Filter over the active/archived lifecycle. */
export type ClientStatusFilter = "ALL" | "ACTIVE" | "ARCHIVED";

/** Initials for the avatar chip, e.g. "Ayu Lestari" → "AL". */
export function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}