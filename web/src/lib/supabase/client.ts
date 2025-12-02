import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * createSupabaseBrowserClient (client shim)
 *
 * This file provides the same browser-side helper previously located at
 * web/src/lib/supabase/browser.ts but under the "client" module name so code
 * can import from "@/lib/supabase/client".
 *
 * It intentionally returns a simple client using NEXT_PUBLIC_SUPABASE_* env vars.
 * During static build/prerender when env vars aren't available, returns a
 * dummy client that throws on method calls (build should not execute queries).
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static prerendering, env vars may not be available.
  // Return a proxy that will throw if actually used (queries shouldn't run at build time).
  if (!url || !key) {
    const handler: ProxyHandler<object> = {
      get(_, prop) {
        // Allow checking if it's a SupabaseClient
        if (prop === "then") return undefined;
        // Return a nested proxy for chained calls like supabase.auth.getUser()
        return new Proxy(() => {
          throw new Error(
            `Supabase client called during build without env vars. ` +
            `Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.`
          );
        }, handler);
      },
      apply() {
        throw new Error(
          `Supabase client called during build without env vars. ` +
          `Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.`
        );
      },
    };
    return new Proxy({} as SupabaseClient, handler);
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
