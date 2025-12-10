import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Get current user's RSVP status for this event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(null);
  }

  const { data } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  return NextResponse.json(data);
}

// POST - Create RSVP (with capacity check)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const notes = body.notes || null;

  // Check if already RSVP'd
  const { data: existing } = await supabase
    .from("event_rsvps")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already RSVP'd to this event" }, { status: 400 });
  }

  // Get event capacity
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, capacity")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Count current confirmed RSVPs
  const { count: confirmedCount } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  // Determine if confirmed or waitlist
  let status: "confirmed" | "waitlist" = "confirmed";
  let waitlistPosition: number | null = null;

  if (event.capacity !== null && (confirmedCount || 0) >= event.capacity) {
    status = "waitlist";

    const { data: lastWaitlist } = await supabase
      .from("event_rsvps")
      .select("waitlist_position")
      .eq("event_id", eventId)
      .eq("status", "waitlist")
      .order("waitlist_position", { ascending: false })
      .limit(1)
      .maybeSingle();

    waitlistPosition = (lastWaitlist?.waitlist_position || 0) + 1;
  }

  // Create RSVP
  const { data: rsvp, error: insertError } = await supabase
    .from("event_rsvps")
    .insert({
      event_id: eventId,
      user_id: session.user.id,
      status,
      waitlist_position: waitlistPosition,
      notes
    })
    .select()
    .single();

  if (insertError) {
    console.error("RSVP insert error:", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(rsvp);
}

// DELETE - Cancel RSVP
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

  const { data: currentRsvp } = await supabase
    .from("event_rsvps")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!currentRsvp) {
    return NextResponse.json({ error: "No RSVP found" }, { status: 404 });
  }

  const wasConfirmed = currentRsvp.status === "confirmed";

  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", currentRsvp.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Auto-promote from waitlist if someone cancels
  if (wasConfirmed) {
    const { data: nextInLine } = await supabase
      .from("event_rsvps")
      .select("id, user_id")
      .eq("event_id", eventId)
      .eq("status", "waitlist")
      .order("waitlist_position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextInLine) {
      // Promote the next person in line
      await supabase
        .from("event_rsvps")
        .update({
          status: "confirmed",
          waitlist_position: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", nextInLine.id);

      // Get event title for notification
      const { data: eventData } = await supabase
        .from("events")
        .select("title")
        .eq("id", eventId)
        .single();

      // Send notification to promoted user (using SECURITY DEFINER function)
      if (eventData?.title) {
        await supabase.rpc("create_user_notification", {
          p_user_id: nextInLine.user_id,
          p_type: "waitlist_promotion",
          p_title: "You're In!",
          p_message: `A spot opened up for "${eventData.title}" and you've been confirmed!`,
          p_link: `/events/${eventId}`,
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
