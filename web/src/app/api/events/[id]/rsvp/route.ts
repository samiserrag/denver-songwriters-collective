import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getRsvpConfirmationEmail } from "@/lib/emailTemplates";
import {
  processExpiredOffers,
  promoteNextWaitlistPerson,
  sendOfferNotifications,
  confirmOffer,
  isOfferExpired,
} from "@/lib/waitlistOffer";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getRsvpHostNotificationEmail } from "@/lib/email/templates/rsvpHostNotification";
import {
  validateDateKeyForWrite,
  resolveEffectiveDateKey,
  dateKeyErrorResponse,
  formatDateKeyShort,
  formatDateKeyForEmail,
} from "@/lib/events/dateKeyContract";
import { SITE_URL } from "@/lib/email/render";

// GET - Get current user's RSVP status for this event (per occurrence)
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

  // Phase ABC6: Get date_key from query params
  const url = new URL(request.url);
  const providedDateKey = url.searchParams.get("date_key");

  // Resolve effective date_key
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Process any expired offers for this event+date (opportunistic cleanup)
  await processExpiredOffers(supabase, eventId, effectiveDateKey);

  // Phase ABC6: Scope by (event_id, date_key, user_id)
  const { data } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  // Check if user's offer has expired (in case processing missed it)
  if (data?.status === "offered" && isOfferExpired(data.offer_expires_at)) {
    // Their offer expired, process it now
    await processExpiredOffers(supabase, eventId, effectiveDateKey);
    // Re-fetch to get updated status
    const { data: refreshedData } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .eq("date_key", effectiveDateKey)
      .eq("user_id", session.user.id)
      .neq("status", "cancelled")
      .maybeSingle();
    return NextResponse.json({ ...refreshedData, effective_date_key: effectiveDateKey });
  }

  return NextResponse.json({ ...data, effective_date_key: effectiveDateKey });
}

// POST - Create RSVP (with capacity check, per occurrence)
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
  const providedDateKey = body.date_key || null;

  // Phase ABC6: Validate date_key and check for cancelled occurrence
  const dateKeyResult = await validateDateKeyForWrite(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Phase ABC6: Check if already RSVP'd for this specific date
  const { data: existing } = await supabase
    .from("event_rsvps")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already RSVP'd to this occurrence" }, { status: 400 });
  }

  // Get event - must be active and published (Phase 4.43c: RSVP available for all events)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, capacity, is_dsc_event, status, is_published, event_date, start_time, venue_name, venue_address")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Phase 4.43c: Removed is_dsc_event check - RSVP available for all public events

  if (!event.is_published) {
    return NextResponse.json({ error: "This event is not yet published" }, { status: 400 });
  }

  if (event.status !== "active") {
    return NextResponse.json({ error: "This event is no longer accepting RSVPs" }, { status: 400 });
  }

  // Phase ABC6: Count current confirmed RSVPs for this specific date
  const { count: confirmedCount } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
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
      .eq("date_key", effectiveDateKey)
      .eq("status", "waitlist")
      .order("waitlist_position", { ascending: false })
      .limit(1)
      .maybeSingle();

    waitlistPosition = (lastWaitlist?.waitlist_position || 0) + 1;
  }

  // Phase ABC6: Create RSVP with date_key
  const { data: rsvp, error: insertError } = await supabase
    .from("event_rsvps")
    .insert({
      event_id: eventId,
      user_id: session.user.id,
      date_key: effectiveDateKey,
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

  // Phase ABC6: Include occurrence date in confirmation email
  const occurrenceDateDisplay = formatDateKeyShort(effectiveDateKey);

  // Send RSVP confirmation email (don't fail if email fails)
  try {
    const userEmail = session.user.email;
    if (userEmail && event.title) {
      const emailData = getRsvpConfirmationEmail({
        eventTitle: event.title,
        eventDate: formatDateKeyForEmail(effectiveDateKey),
        eventTime: event.start_time || "TBA",
        venueName: event.venue_name || "TBA",
        venueAddress: event.venue_address || undefined,
        eventId,
        eventSlug: event.slug,
        isWaitlist: status === "waitlist",
        waitlistPosition: waitlistPosition ?? undefined,
        dateKey: effectiveDateKey, // Phase ABC6: Pass date_key for URL
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

  // Phase 4.51a: Notify hosts/watchers about new RSVP (fire and forget)
  const { data: rsvpUserProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .single();

  notifyHostsOfRsvp(
    supabase,
    eventId,
    effectiveDateKey,
    session.user.id,
    rsvpUserProfile?.full_name || "A member",
    event.title || "Event",
    `/events/${event.slug || eventId}?date=${effectiveDateKey}`,
    status === "waitlist",
    occurrenceDateDisplay
  ).catch(err => console.error("Failed to notify hosts of RSVP:", err));

  return NextResponse.json({ ...rsvp, effective_date_key: effectiveDateKey });
}

// DELETE - Cancel RSVP (or decline offer) for specific occurrence
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

  // Phase ABC6: Get date_key from query params
  const url = new URL(request.url);
  const providedDateKey = url.searchParams.get("date_key");

  // Resolve effective date_key
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Phase ABC6: Find RSVP for this specific date
  const { data: currentRsvp } = await supabase
    .from("event_rsvps")
    .select("id, status, date_key")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .eq("user_id", session.user.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (!currentRsvp) {
    return NextResponse.json({ error: "No RSVP found for this occurrence" }, { status: 404 });
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

  // Phase ABC6: Promote next waitlist person for this specific date
  if (opensSpot) {
    const promotedRsvpId = await promoteNextWaitlistPerson(supabase, eventId, effectiveDateKey);

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
          promotedRsvp.offer_expires_at!,
          effectiveDateKey
        );
      }
    }
  }

  return NextResponse.json({ success: true, effective_date_key: effectiveDateKey });
}

// PATCH - Confirm an offered spot for specific occurrence
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

  // Phase ABC6: Get date_key from query params or body
  const url = new URL(request.url);
  let providedDateKey = url.searchParams.get("date_key");

  // Also check body for date_key
  if (!providedDateKey) {
    const body = await request.json().catch(() => ({}));
    providedDateKey = body.date_key || null;
  }

  // Resolve effective date_key
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Process any expired offers first for this specific date
  await processExpiredOffers(supabase, eventId, effectiveDateKey);

  // Try to confirm the offer for this specific date
  const result = await confirmOffer(supabase, eventId, session.user.id, effectiveDateKey);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Get updated RSVP data for this date
  const { data: rsvp } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .eq("user_id", session.user.id)
    .single();

  return NextResponse.json({ ...rsvp, effective_date_key: effectiveDateKey });
}

/**
 * Phase 4.51d: Notify hosts AND watchers about new RSVP
 * Phase ABC6: Now includes occurrence date in notifications
 * Fan-out: event_hosts ∪ events.host_id ∪ event_watchers (union with dedupe)
 * Watchers are always notified regardless of host existence (opt-in monitoring).
 */
async function notifyHostsOfRsvp(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  dateKey: string,
  rsvpUserId: string,
  rsvpUserName: string,
  eventTitle: string,
  eventUrl: string,
  isWaitlist: boolean,
  occurrenceDateDisplay: string
) {
  const notifiedUserIds = new Set<string>();

  // 1. Notify event_hosts (accepted)
  const { data: hosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("invitation_status", "accepted");

  if (hosts && hosts.length > 0) {
    for (const host of hosts) {
      if (host.user_id !== rsvpUserId && !notifiedUserIds.has(host.user_id)) {
        await notifyUserOfRsvp(supabase, host.user_id, rsvpUserName, eventTitle, eventUrl, isWaitlist, occurrenceDateDisplay);
        notifiedUserIds.add(host.user_id);
      }
    }
    // NO RETURN - continue to check host_id and watchers
  }

  // 2. Notify events.host_id (if not already notified)
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (event?.host_id && event.host_id !== rsvpUserId && !notifiedUserIds.has(event.host_id)) {
    await notifyUserOfRsvp(supabase, event.host_id, rsvpUserName, eventTitle, eventUrl, isWaitlist, occurrenceDateDisplay);
    notifiedUserIds.add(event.host_id);
    // NO RETURN - continue to check watchers
  }

  // 3. Also notify event_watchers (if not already notified)
  const { data: watchers } = await supabase
    .from("event_watchers")
    .select("user_id")
    .eq("event_id", eventId);

  if (watchers && watchers.length > 0) {
    for (const watcher of watchers) {
      if (watcher.user_id !== rsvpUserId && !notifiedUserIds.has(watcher.user_id)) {
        await notifyUserOfRsvp(supabase, watcher.user_id, rsvpUserName, eventTitle, eventUrl, isWaitlist, occurrenceDateDisplay);
        notifiedUserIds.add(watcher.user_id);
      }
    }
  }
}

/**
 * Send dashboard notification + email to a user about RSVP
 * Phase ABC6: Now includes occurrence date in message
 */
async function notifyUserOfRsvp(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  rsvpUserName: string,
  eventTitle: string,
  eventUrl: string,
  isWaitlist: boolean,
  occurrenceDateDisplay: string
) {
  const title = isWaitlist
    ? `${rsvpUserName} joined the waitlist for ${occurrenceDateDisplay}`
    : `${rsvpUserName} is going on ${occurrenceDateDisplay}`;

  const message = isWaitlist
    ? `${rsvpUserName} joined the waitlist for "${eventTitle}" on ${occurrenceDateDisplay}`
    : `${rsvpUserName} RSVP'd to "${eventTitle}" on ${occurrenceDateDisplay}`;

  // Get user's email
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  // Build email content (Phase ABC6: URL includes ?date=)
  const emailData = getRsvpHostNotificationEmail({
    eventTitle,
    eventUrl: `${SITE_URL}${eventUrl}`,
    rsvpUserName,
    isWaitlist,
    occurrenceDate: occurrenceDateDisplay,
  });

  // Send notification + email with preferences
  await sendEmailWithPreferences({
    supabase,
    userId,
    templateKey: "rsvpHostNotification",
    payload: userEmail ? {
      to: userEmail,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    } : {
      to: "",
      subject: "",
      html: "",
      text: "",
    },
    notification: {
      type: "event_rsvp",
      title,
      message,
      link: `${eventUrl}#attendees`,
    },
  });
}
