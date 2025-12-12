import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * CRITICAL SECURITY NOTE:
 * This client uses the Service Role Key which bypasses ALL Row Level Security (RLS).
 *
 * ONLY use this client in:
 * - Server-side API routes (app/api/*)
 * - Server components that need admin-level database access
 *
 * NEVER:
 * - Import this in client components
 * - Expose operations to unauthenticated users
 * - Use when the regular authenticated client would suffice
 *
 * Always verify the user is an admin BEFORE using this client.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase client with the Service Role Key.
 * This client bypasses RLS and should ONLY be used in serverless functions.
 *
 * @throws Error if environment variables are not configured
 */
export function createServiceRoleClient() {
  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
      "Please add it to your Vercel environment variables."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "Please add it to your Vercel environment variables (NOT prefixed with NEXT_PUBLIC_)."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Singleton instance for cases where you need a persistent client.
 * Prefer createServiceRoleClient() for most use cases to ensure
 * fresh connections in serverless environments.
 */
let _serviceRoleClient: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceRoleClient() {
  if (!_serviceRoleClient) {
    _serviceRoleClient = createServiceRoleClient();
  }
  return _serviceRoleClient;
}
