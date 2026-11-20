import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient<Database> | null = null;

/**
 * Browser-side Supabase client.
 * The session is stored in cookies so it can also be read by server code later.
 *
 * The URL and publishable key come exclusively from `NEXT_PUBLIC_*` env vars
 * (see `src/lib/env.ts`), so the `main` and `demo` branches can share one
 * codebase and differ only by `.env.local`.
 */
export function createClient(): SupabaseClient<Database> {
  if (client) return client;

  const { url, key } = getSupabaseEnv();

  client = createBrowserClient<Database>(url, key);
  return client;
}
