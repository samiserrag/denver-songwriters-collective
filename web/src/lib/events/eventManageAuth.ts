import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminRole } from "@/lib/auth/adminAuth";

/**
 * Shared authorization check for host-side event management routes.
 * Allows: admin OR event owner (events.host_id) OR accepted event host/cohost.
 */
export async function canManageEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
): Promise<boolean> {
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (event?.host_id === userId) return true;

  const { data: hostEntry } = await supabase
    .from("event_hosts")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!hostEntry;
}

/**
 * More restrictive visibility edit check:
 * admin OR event owner OR accepted primary host.
 */
export async function canEditEventVisibility(
  supabase: SupabaseClient,
  userId: string,
  eventId: string
): Promise<boolean> {
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return false;
  if (event.host_id === userId) return true;

  const { data: primaryHostEntry } = await supabase
    .from("event_hosts")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", "host")
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!primaryHostEntry;
}
