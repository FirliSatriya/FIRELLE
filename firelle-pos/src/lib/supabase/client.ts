import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Browser-side Supabase client.
 * The session is stored in cookies so it can also be read by server code later.
 */
export function createClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diatur di .env.local"
    );
  }

  client = createBrowserClient<Database>(url, key);
  return client;
}
