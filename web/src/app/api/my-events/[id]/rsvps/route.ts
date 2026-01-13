import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { resolveEffectiveDateKey, dateKeyErrorResponse } from "@/lib/events/dateKeyContract";

// GET - Get all RSVPs for an event (host view)
// Phase ABC7: Requires date_key to return occurrence-specific RSVPs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase ABC7: Get date_key from query params
  const url = new URL(request.url);
  const providedDateKey = url.searchParams.get("date_key");

  // Resolve effective date_key (required for per-occurrence RSVP list)
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Check if user is host or admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, session.user.id);

  if (!isAdmin) {
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .eq("invitation_status", "accepted")
      .maybeSingle();

    if (!hostEntry) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Phase ABC7: Filter RSVPs by (event_id, date_key) for per-occurrence results
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .order("status", { ascending: true })
    .order("waitlist_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profiles for all RSVP user_ids
  const rsvpUserIds = rsvps?.map(r => r.user_id) || [];
  let profileMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();

  if (rsvpUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", rsvpUserIds);

    profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
  }

  // Enrich RSVPs with profile data
  const enrichedRsvps = rsvps?.map(r => ({
    ...r,
    user: profileMap.get(r.user_id) || undefined
  })) || [];

  // Group by status
  const confirmed = enrichedRsvps.filter(r => r.status === "confirmed");
  const waitlist = enrichedRsvps.filter(r => r.status === "waitlist");
  const cancelled = enrichedRsvps.filter(r => r.status === "cancelled");

  // Phase ABC7: Include date_key in response for client awareness
  return NextResponse.json({
    confirmed,
    waitlist,
    cancelled,
    total_confirmed: confirmed.length,
    total_waitlist: waitlist.length,
    date_key: effectiveDateKey,
  });
}
