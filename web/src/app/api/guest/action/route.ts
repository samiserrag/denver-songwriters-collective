import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
} from "@/lib/guest-verification/config";
import { verifyActionToken, createActionToken, endOfEventDayDenver } from "@/lib/guest-verification/crypto";
import { sendEmail, getWaitlistOfferEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/siteUrl";
import { formatDateKeyForEmail } from "@/lib/events/dateKeyContract";
import { getGuestCancellationConfirmationEmail } from "@/lib/email/templates/guestCancellationConfirmation";

interface ActionBody {
  token: string;
  action: "confirm" | "cancel" | "cancel_rsvp";
}

function formatTimeForEmail(time: string | null | undefined): string | null {
  if (!time) return null;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * POST /api/guest/action
 *
 * Perform an action (confirm or cancel) on a guest claim using a signed token.
 * Token is validated for signature, expiry, and single-use.
 */
export async function POST(request: NextRequest) {
  // Emergency kill switch only (guest verification is always enabled)
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as ActionBody;
    const { token, action } = body;

    // Validate required fields
    if (!token || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["confirm", "cancel", "cancel_rsvp"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    // Verify token signature and expiry
    const payload = await verifyActionToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Verify action matches token
    if (payload.action !== action) {
      return NextResponse.json(
        { error: "Token action mismatch" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if token has been used (single-use)
    const { data: verification, error: verificationError } = await supabase
      .from("guest_verifications")
      .select("id, token_used, claim_id, rsvp_id")
      .eq("id", payload.verification_id)
      .single();

    if (verificationError || !verification) {
      return NextResponse.json(
        { error: "Verification not found" },
        { status: 404 }
      );
    }

    if (verification.token_used) {
      return NextResponse.json(
        { error: "Token has already been used" },
        { status: 400 }
      );
    }

    // Handle RSVP cancellation (different from timeslot actions)
    if (action === "cancel_rsvp") {
      if (!payload.rsvp_id) {
        return NextResponse.json(
          { error: "Invalid RSVP cancellation token" },
          { status: 400 }
        );
      }
      return await handleCancelRsvp(supabase, payload.rsvp_id, payload.email, verification.id);
    }

    // Timeslot claim actions require claim_id
    if (!payload.claim_id) {
      return NextResponse.json(
        { error: "Invalid claim token" },
        { status: 400 }
      );
    }

    // Fetch the claim
    const { data: claim, error: claimError } = await supabase
      .from("timeslot_claims")
      .select("*, event_timeslots!inner(event_id)")
      .eq("id", payload.claim_id)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // Verify email matches
    if (claim.guest_email !== payload.email) {
      return NextResponse.json(
        { error: "Token does not match claim" },
        { status: 403 }
      );
    }

    // Execute the action
    if (action === "confirm") {
      return await handleConfirm(supabase, claim, verification.id);
    } else {
      return await handleCancel(supabase, claim, verification.id);
    }
  } catch (error) {
    console.error("Guest action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle confirm action - confirm an offered slot
 */
async function handleConfirm(
  supabase: ReturnType<typeof createServiceRoleClient>,
  claim: { id: string; status: string; offer_expires_at: string | null },
  verificationId: string
): Promise<NextResponse> {
  // Can only confirm if status is 'offered'
  if (claim.status !== "offered") {
    if (claim.status === "confirmed") {
      return NextResponse.json(
        { error: "Slot is already confirmed" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Slot is not in offered status" },
      { status: 400 }
    );
  }

  // Check if offer has expired
  if (
    claim.offer_expires_at &&
    new Date(claim.offer_expires_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "Offer has expired" },
      { status: 400 }
    );
  }

  // Update claim to confirmed
  const { error: updateError } = await supabase
    .from("timeslot_claims")
    .update({
      status: "confirmed",
      offer_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claim.id);

  if (updateError) {
    console.error("Confirm update error:", updateError);
    return NextResponse.json(
      { error: "Failed to confirm slot" },
      { status: 500 }
    );
  }

  // Mark token as used
  await supabase
    .from("guest_verifications")
    .update({ token_used: true })
    .eq("id", verificationId);

  return NextResponse.json({
    success: true,
    message: "Slot confirmed",
  });
}

/**
 * Handle cancel action - cancel a claim and promote waitlist
 */
async function handleCancel(
  supabase: ReturnType<typeof createServiceRoleClient>,
  claim: {
    id: string;
    status: string;
    guest_name: string | null;
    guest_email: string | null;
    timeslot_id: string;
    event_timeslots: { event_id: string; date_key?: string };
  },
  verificationId: string
): Promise<NextResponse> {
  // Can cancel confirmed, offered, or waitlist claims
  if (!["confirmed", "offered", "waitlist"].includes(claim.status)) {
    return NextResponse.json(
      { error: "Claim cannot be cancelled" },
      { status: 400 }
    );
  }

  const wasConfirmedOrOffered = ["confirmed", "offered"].includes(claim.status);

  // Update claim to cancelled
  const { error: updateError } = await supabase
    .from("timeslot_claims")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", claim.id);

  if (updateError) {
    console.error("Cancel update error:", updateError);
    return NextResponse.json(
      { error: "Failed to cancel claim" },
      { status: 500 }
    );
  }

  // Mark token as used
  await supabase
    .from("guest_verifications")
    .update({ token_used: true })
    .eq("id", verificationId);

  // Send cancellation confirmation to guest (best effort, non-blocking)
  const { data: eventForEmail } = await supabase
    .from("events")
    .select("id, title, slug, event_date, start_time, venue_name, venue_address, slot_offer_window_minutes")
    .eq("id", claim.event_timeslots.event_id)
    .maybeSingle();

  if (claim.guest_email) {
    const baseUrl = getSiteUrl();
    const eventIdentifier = eventForEmail?.slug || eventForEmail?.id || claim.event_timeslots.event_id;
    const dateKey = claim.event_timeslots.date_key;
    const dateParam = dateKey ? `?date=${dateKey}` : "";
    const eventUrl = `${baseUrl}/events/${eventIdentifier}${dateParam}`;
    const eventDate = dateKey
      ? formatDateKeyForEmail(dateKey)
      : eventForEmail?.event_date
        ? formatDateKeyForEmail(eventForEmail.event_date)
        : null;

    const cancellationEmail = getGuestCancellationConfirmationEmail({
      guestName: claim.guest_name,
      eventTitle: eventForEmail?.title || "Open Mic",
      eventDate,
      eventTime: formatTimeForEmail(eventForEmail?.start_time),
      venueName: eventForEmail?.venue_name,
      venueAddress: eventForEmail?.venue_address,
      eventUrl,
      kind: "timeslot",
    });

    try {
      await sendEmail({
        to: claim.guest_email,
        subject: cancellationEmail.subject,
        html: cancellationEmail.html,
        text: cancellationEmail.text,
      });
    } catch (error) {
      console.error("Failed to send guest timeslot cancellation confirmation email:", error);
    }
  }

  // If this was a confirmed/offered claim, promote from waitlist
  if (wasConfirmedOrOffered) {
    const offerWindowMinutes = eventForEmail?.slot_offer_window_minutes || 120;

    // Call the promote function
    await supabase.rpc("promote_timeslot_waitlist", {
      p_timeslot_id: claim.timeslot_id,
      p_offer_window_minutes: offerWindowMinutes,
    });

    // Check if someone was promoted and send them an offer email
    const { data: promotedClaim } = await supabase
      .from("timeslot_claims")
      .select("id, guest_email, guest_name, offer_expires_at, guest_verification_id")
      .eq("timeslot_id", claim.timeslot_id)
      .eq("status", "offered")
      .maybeSingle();

    if (promotedClaim?.guest_email && promotedClaim?.offer_expires_at && promotedClaim?.guest_verification_id) {
      // Build action URLs for the promoted guest
      const baseUrl = getSiteUrl();

      // Create new action tokens for the promoted guest — valid until end of event day
      const promotedExpiresAt = claim.event_timeslots.date_key
        ? endOfEventDayDenver(claim.event_timeslots.date_key)
        : undefined;

      const confirmToken = await createActionToken(
        {
          email: promotedClaim.guest_email,
          claim_id: promotedClaim.id,
          action: "confirm",
          verification_id: promotedClaim.guest_verification_id,
        },
        promotedExpiresAt ? { expiresAt: promotedExpiresAt } : undefined
      );

      const cancelToken = await createActionToken(
        {
          email: promotedClaim.guest_email,
          claim_id: promotedClaim.id,
          action: "cancel",
          verification_id: promotedClaim.guest_verification_id,
        },
        promotedExpiresAt ? { expiresAt: promotedExpiresAt } : undefined
      );

      const confirmUrl = `${baseUrl}/guest/action?token=${confirmToken}&action=confirm`;
      const cancelUrl = `${baseUrl}/guest/action?token=${cancelToken}&action=cancel`;

      // Send waitlist offer email
      const emailContent = getWaitlistOfferEmail({
        guestName: promotedClaim.guest_name,
        eventTitle: eventForEmail?.title || "Open Mic",
        confirmUrl,
        cancelUrl,
        expiresAt: promotedClaim.offer_expires_at,
      });

      await sendEmail({
        to: promotedClaim.guest_email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Claim cancelled",
  });
}

/**
 * Handle cancel_rsvp action - cancel a guest RSVP
 */
async function handleCancelRsvp(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rsvpId: string,
  email: string,
  verificationId: string
): Promise<NextResponse> {
  // Fetch the RSVP
  const { data: rsvp, error: rsvpError } = await supabase
    .from("event_rsvps")
    .select("id, status, guest_name, guest_email, event_id, date_key")
    .eq("id", rsvpId)
    .single();

  if (rsvpError || !rsvp) {
    return NextResponse.json(
      { error: "RSVP not found" },
      { status: 404 }
    );
  }

  // Verify email matches
  if (rsvp.guest_email !== email) {
    return NextResponse.json(
      { error: "Token does not match RSVP" },
      { status: 403 }
    );
  }

  // Can only cancel if not already cancelled
  if (rsvp.status === "cancelled") {
    return NextResponse.json(
      { error: "RSVP is already cancelled" },
      { status: 400 }
    );
  }

  const wasConfirmedOrOffered = ["confirmed", "offered"].includes(rsvp.status);

  // Update RSVP to cancelled
  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "cancelled",
      offer_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rsvpId);

  if (updateError) {
    console.error("Cancel RSVP update error:", updateError);
    return NextResponse.json(
      { error: "Failed to cancel RSVP" },
      { status: 500 }
    );
  }

  // Mark token as used
  await supabase
    .from("guest_verifications")
    .update({ token_used: true })
    .eq("id", verificationId);

  // Send cancellation confirmation to guest (best effort, non-blocking)
  const { data: eventForEmail } = await supabase
    .from("events")
    .select("id, title, slug, event_date, start_time, venue_name, venue_address")
    .eq("id", rsvp.event_id)
    .maybeSingle();

  const baseUrl = getSiteUrl();
  const eventIdentifier = eventForEmail?.slug || eventForEmail?.id || rsvp.event_id;
  const dateParam = rsvp.date_key ? `?date=${rsvp.date_key}` : "";
  const eventUrl = `${baseUrl}/events/${eventIdentifier}${dateParam}`;
  const eventDate = rsvp.date_key
    ? formatDateKeyForEmail(rsvp.date_key)
    : eventForEmail?.event_date
      ? formatDateKeyForEmail(eventForEmail.event_date)
      : null;

  const cancellationEmail = getGuestCancellationConfirmationEmail({
    guestName: rsvp.guest_name,
    eventTitle: eventForEmail?.title || "Event",
    eventDate,
    eventTime: formatTimeForEmail(eventForEmail?.start_time),
    venueName: eventForEmail?.venue_name,
    venueAddress: eventForEmail?.venue_address,
    eventUrl,
    kind: "rsvp",
  });

  try {
    await sendEmail({
      to: email,
      subject: cancellationEmail.subject,
      html: cancellationEmail.html,
      text: cancellationEmail.text,
    });
  } catch (error) {
    console.error("Failed to send guest RSVP cancellation confirmation email:", error);
  }

  // If this was a confirmed/offered RSVP, promote from waitlist
  if (wasConfirmedOrOffered) {
    // Import and use the existing waitlist promotion logic
    const { promoteNextWaitlistPerson, sendOfferNotifications } = await import("@/lib/waitlistOffer");

    const promotedRsvpId = await promoteNextWaitlistPerson(supabase, rsvp.event_id);

    if (promotedRsvpId) {
      // Get the promoted RSVP with offer_expires_at that promoteNextWaitlistPerson just set
      const { data: promotedRsvp } = await supabase
        .from("event_rsvps")
        .select("user_id, guest_email, offer_expires_at")
        .eq("id", promotedRsvpId)
        .single();

      if (promotedRsvp) {
        // For members, use the existing notification flow
        if (promotedRsvp.user_id && promotedRsvp.offer_expires_at) {
          await sendOfferNotifications(
            supabase,
            rsvp.event_id,
            promotedRsvp.user_id,
            promotedRsvp.offer_expires_at
          );
        }
        // TODO: For guest waitlist promotion, send guest-specific offer email
        // This is deferred - guests on RSVP waitlist is an edge case
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "RSVP cancelled",
  });
}
