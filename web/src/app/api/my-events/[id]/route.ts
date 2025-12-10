import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Helper to check if user can manage event
async function canManageEvent(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
  // Check admin
  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.app_metadata?.role === "admin") return true;

  // Check host
  const { data: hostEntry } = await supabase
    .from("event_hosts")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!hostEntry;
}

// GET - Get single event with full details (for editing)
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

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(
        id, user_id, role, invitation_status,
        user:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("id", eventId)
    .eq("is_dsc_event", true)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ...event,
    rsvps: rsvps || []
  });
}

// PATCH - Update event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = [
    "title", "description", "event_type", "capacity", "host_notes",
    "venue_name", "day_of_week", "start_time",
    "end_time", "status"
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }
  // Map 'address' from form to 'venue_address' in database
  if (body.address !== undefined) {
    updates.venue_address = body.address;
  }

  const { data: event, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .eq("is_dsc_event", true)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event);
}

// DELETE - Cancel/hide event (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get event title and RSVPed users before cancelling
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  const { data: rsvpUsers } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist"]);

  // Soft delete - set status to cancelled
  const { error } = await supabase
    .from("events")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", eventId)
    .eq("is_dsc_event", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify all RSVPed users that the event was cancelled
  if (rsvpUsers && rsvpUsers.length > 0 && event?.title) {
    await Promise.all(
      rsvpUsers.map((rsvp) =>
        supabase.rpc("create_user_notification", {
          p_user_id: rsvp.user_id,
          p_type: "event_cancelled",
          p_title: "Event Cancelled",
          p_message: `"${event.title}" has been cancelled by the host.`,
          p_link: null
        })
      )
    );
  }

  return NextResponse.json({ success: true });
}
