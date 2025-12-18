import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// GET - Get all RSVPs for an event (host view)
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

  // Note: event_rsvps.user_id references auth.users, not profiles
  // So we fetch RSVPs without profile join, then fetch profiles separately
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
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

  return NextResponse.json({
    confirmed,
    waitlist,
    cancelled,
    total_confirmed: confirmed.length,
    total_waitlist: waitlist.length
  });
}
