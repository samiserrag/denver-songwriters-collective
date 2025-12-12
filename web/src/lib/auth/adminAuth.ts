import { SupabaseClient } from "@supabase/supabase-js";

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
