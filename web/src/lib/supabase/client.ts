import { createBrowserClient } from "@supabase/ssr";

/**
 * Singleton Supabase client for browser-side usage.
 *
 * This ensures only ONE GoTrueClient instance is created to avoid
 * "Multiple GoTrueClient instances" warnings and auth state conflicts.
 */

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

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

  client = createBrowserClient(url, key);
  return client;
}

// Alias for backwards compatibility
export const createSupabaseBrowserClient = createClient;
