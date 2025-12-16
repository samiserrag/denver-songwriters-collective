import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getRsvpConfirmationEmail } from "@/lib/emailTemplates";
import {
  processExpiredOffers,
  promoteNextWaitlistPerson,
  sendOfferNotifications,
  confirmOffer,
  calculateOfferExpiry,
  isOfferExpired,
} from "@/lib/waitlistOffer";

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

  // Process any expired offers for this event (opportunistic cleanup)
  await processExpiredOffers(supabase, eventId);

  const { data } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  // Check if user's offer has expired (in case processing missed it)
  if (data?.status === "offered" && isOfferExpired(data.offer_expires_at)) {
    // Their offer expired, process it now
    await processExpiredOffers(supabase, eventId);
    // Re-fetch to get updated status
    const { data: refreshedData } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .neq("status", "cancelled")
      .maybeSingle();
    return NextResponse.json(refreshedData);
  }

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

  // Get event - must be DSC event and active
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, capacity, is_dsc_event, status, event_date, start_time, venue_name, venue_address")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.is_dsc_event) {
    return NextResponse.json({ error: "RSVPs only available for DSC events" }, { status: 400 });
  }

  if (event.status !== "active") {
    return NextResponse.json({ error: "This event is no longer accepting RSVPs" }, { status: 400 });
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

  // Send RSVP confirmation email (don't fail if email fails)
  try {
    const userEmail = session.user.email;
    if (userEmail && event.title) {
      const emailData = getRsvpConfirmationEmail({
        eventTitle: event.title,
        eventDate: event.event_date || "TBA",
        eventTime: event.start_time || "TBA",
        venueName: event.venue_name || "TBA",
        venueAddress: event.venue_address || undefined,
        eventId,
        isWaitlist: status === "waitlist",
        waitlistPosition: waitlistPosition ?? undefined,
      });

      await sendEmail({
        to: userEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    }
  } catch (emailError) {
    console.error("Failed to send RSVP confirmation email:", emailError);
    // Don't fail the RSVP if email fails
  }

  return NextResponse.json(rsvp);
}

// DELETE - Cancel RSVP (or decline offer)
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

  // Track if we need to promote someone (confirmed or offered status opens a spot)
  const opensSpot = currentRsvp.status === "confirmed" || currentRsvp.status === "offered";

  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "cancelled",
      offer_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", currentRsvp.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Promote next waitlist person with 24-hour offer window
  if (opensSpot) {
    const promotedRsvpId = await promoteNextWaitlistPerson(supabase, eventId);

    if (promotedRsvpId) {
      // Get the promoted RSVP to get user_id and offer_expires_at
      const { data: promotedRsvp } = await supabase
        .from("event_rsvps")
        .select("user_id, offer_expires_at")
        .eq("id", promotedRsvpId)
        .single();

      if (promotedRsvp) {
        // Send notifications about the offer
        await sendOfferNotifications(
          supabase,
          eventId,
          promotedRsvp.user_id,
          promotedRsvp.offer_expires_at!
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}

// PATCH - Confirm an offered spot
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

  // Process any expired offers first
  await processExpiredOffers(supabase, eventId);

  // Try to confirm the offer
  const result = await confirmOffer(supabase, eventId, session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Get updated RSVP data
  const { data: rsvp } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .single();

  return NextResponse.json(rsvp);
}
