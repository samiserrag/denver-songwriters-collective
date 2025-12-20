import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Super admin email - only this user can promote/demote other admins.
 * This is hardcoded for security - cannot be changed via database.
 */
export const SUPER_ADMIN_EMAIL = "sami.serrag@gmail.com";

/**
 * Checks if a user is the super admin by email.
 * Super admin can promote/demote other users to admin role.
 *
 * @param email - The user's email to check
 * @returns true if user is super admin, false otherwise
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  return email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Checks if a user has admin role by querying the profiles table.
 * This is the authoritative check - always use database, not JWT metadata.
 *
 * @param supabase - The Supabase server client
 * @param userId - The user's ID to check
 * @returns true if user has admin role, false otherwise
 */
export async function checkAdminRole(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return false;
  }

  return profile.role === "admin";
}

/**
 * Checks if a user can act as a host (create/manage events).
 * A user is a host if they are:
 * 1. An admin (admins are automatically hosts), OR
 * 2. In the approved_hosts table with status='active'
 *
 * This is the authoritative check - use this instead of app_metadata.
 *
 * @param supabase - The Supabase server client
 * @param userId - The user's ID to check
 * @returns true if user can act as host, false otherwise
 */
export async function checkHostStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  // First check if admin (admins are automatically hosts)
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) {
    return true;
  }

  // Check approved_hosts table
  const { data: hostStatus } = await supabase
    .from("approved_hosts")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return !!hostStatus;
}
