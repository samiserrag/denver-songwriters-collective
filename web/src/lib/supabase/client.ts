import { createBrowserClient } from "@supabase/ssr";

/**
 * Singleton Supabase client for browser-side usage.
 *
 * Uses globalThis to persist across module reloads (HMR, code splitting).
 * This ensures only ONE GoTrueClient instance exists in the browser.
 */

// Extend globalThis type for our singleton
const globalForSupabase = globalThis as typeof globalThis & {
  __supabaseClient?: ReturnType<typeof createBrowserClient>;
};

export function createClient() {
  // Return existing client if available (persists across module reloads)
  if (globalForSupabase.__supabaseClient) {
    return globalForSupabase.__supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During static prerendering, env vars may not be available.
  // Return a proxy that will throw if actually used (queries shouldn't run at build time).
  if (!url || !key) {
    const handler: ProxyHandler<object> = {
      get(_, prop) {
        if (prop === "then") return undefined;
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
    return new Proxy({}, handler) as ReturnType<typeof createBrowserClient>;
  }

  // Create and store in globalThis for persistence
  globalForSupabase.__supabaseClient = createBrowserClient(url, key);
  return globalForSupabase.__supabaseClient;
}

// Alias for backwards compatibility
export const createSupabaseBrowserClient = createClient;
