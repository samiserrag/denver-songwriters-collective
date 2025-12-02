import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * createSupabaseBrowserClient (client shim)
 *
 * This file provides the same browser-side helper previously located at
 * web/src/lib/supabase/browser.ts but under the "client" module name so code
 * can import from "@/lib/supabase/client".
 *
 * It intentionally returns a simple client using NEXT_PUBLIC_SUPABASE_* env vars.
 * Keep behavior minimal — consumers should handle missing env vars in server build.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) {
    return createClient("", "");
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
