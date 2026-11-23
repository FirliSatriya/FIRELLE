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
 * (see `src/lib/env.ts`). In `APP_MODE=demo` this client is never called at
 * all; the data facades route to the in-memory demo store instead.
 */
export function createClient(): SupabaseClient<Database> {
  if (client) return client;

  const { url, key } = getSupabaseEnv();

  client = createBrowserClient<Database>(url, key);
  return client;
}
