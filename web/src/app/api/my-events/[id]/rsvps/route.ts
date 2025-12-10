import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  // Check if user is host or admin
  const { data: user } = await supabase.auth.getUser();
  const isAdmin = user?.user?.app_metadata?.role === "admin";

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

  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .eq("event_id", eventId)
    .order("status", { ascending: true })
    .order("waitlist_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by status
  const confirmed = rsvps?.filter(r => r.status === "confirmed") || [];
  const waitlist = rsvps?.filter(r => r.status === "waitlist") || [];
  const cancelled = rsvps?.filter(r => r.status === "cancelled") || [];

  return NextResponse.json({
    confirmed,
    waitlist,
    cancelled,
    total_confirmed: confirmed.length,
    total_waitlist: waitlist.length
  });
}
