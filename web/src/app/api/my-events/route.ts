import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkHostStatus } from "@/lib/auth/adminAuth";

// GET - Get events where user is host/cohost
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get events where user is a host
  const { data: hostEntries, error: hostError } = await supabase
    .from("event_hosts")
    .select("event_id, role, invitation_status")
    .eq("user_id", session.user.id)
    .eq("invitation_status", "accepted");

  if (hostError) {
    return NextResponse.json({ error: hostError.message }, { status: 500 });
  }

  if (!hostEntries || hostEntries.length === 0) {
    return NextResponse.json([]);
  }

  const eventIds = hostEntries.map(h => h.event_id);

  // Get full event data
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(
        id, user_id, role, invitation_status,
        user:profiles(id, full_name, avatar_url)
      )
    `)
    .in("id", eventIds)
    .eq("is_dsc_event", true)
    .order("created_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Add RSVP counts
  const eventsWithCounts = await Promise.all(
    (events || []).map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const hostEntry = hostEntries.find(h => h.event_id === event.id);

      return {
        ...event,
        rsvp_count: count || 0,
        user_role: hostEntry?.role || "host"
      };
    })
  );

  return NextResponse.json(eventsWithCounts);
}

// POST - Create new DSC event
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is approved host or admin (admins are automatically hosts)
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);

  if (!isApprovedHost) {
    return NextResponse.json({
      error: "You must be an approved host to create events"
    }, { status: 403 });
  }

  const body = await request.json();

  // Validate required fields
  const required = ["title", "event_type", "venue_id", "start_time"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Create event (default to draft unless explicitly published)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      title: body.title,
      description: body.description || null,
      event_type: body.event_type,
      is_dsc_event: true,
      capacity: body.capacity || null,
      host_notes: body.host_notes || null,
      venue_id: body.venue_id,
      day_of_week: body.day_of_week || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      recurrence_rule: body.recurrence_rule || null,
      cover_image_url: body.cover_image_url || null,
      status: "active",
      is_published: body.is_published ?? false
    })
    .select()
    .single();

  if (eventError) {
    console.error("Event creation error:", eventError);
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  // Add creator as host
  const { error: hostError } = await supabase
    .from("event_hosts")
    .insert({
      event_id: event.id,
      user_id: session.user.id,
      role: "host",
      invitation_status: "accepted",
      invited_by: session.user.id,
      responded_at: new Date().toISOString()
    });

  if (hostError) {
    console.error("Host assignment error:", hostError);
    // Event was created, so don't fail completely
  }

  return NextResponse.json(event);
}
