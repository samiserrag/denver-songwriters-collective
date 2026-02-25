import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import { verifyCodeHash, createActionToken, endOfEventDayDenver } from "@/lib/guest-verification/crypto";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { sendEmail } from "@/lib/email/mailer";
import { getTimeslotClaimConfirmationEmail } from "@/lib/email/templates/timeslotClaimConfirmation";
import { getTimeslotSignupHostNotificationEmail } from "@/lib/email/templates/timeslotSignupHostNotification";
import { formatDateKeyShort, formatDateKeyForEmail } from "@/lib/events/dateKeyContract";
import { SITE_URL } from "@/lib/email/render";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/timeslot-claim/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates a timeslot_claim for the guest.
 */
export async function POST(request: NextRequest) {
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as VerifyCodeBody;
    const { verification_id, code } = body;

    if (!verification_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: verification, error: fetchError } = await supabase
      .from("guest_verifications")
      .select("*")
      .eq("id", verification_id)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    if (verification.action_type !== "timeslot") {
      return NextResponse.json(
        { error: "Invalid verification type" },
        { status: 400 }
      );
    }

    if (!verification.timeslot_id) {
      return NextResponse.json(
        { error: "No timeslot associated with this verification" },
        { status: 400 }
      );
    }

    if (verification.verified_at) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      );
    }

    if (
      verification.locked_until &&
      new Date(verification.locked_until) > new Date()
    ) {
      const retryAfter = Math.ceil(
        (new Date(verification.locked_until).getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again later.", retry_after: retryAfter },
        { status: 429 }
      );
    }

    if (
      verification.code_expires_at &&
      new Date(verification.code_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }

    const isValidCode = verifyCodeHash(code, verification.code || "");

    if (!isValidCode) {
      const newAttempts = (verification.code_attempts || 0) + 1;
      const attemptsRemaining = MAX_CODE_ATTEMPTS - newAttempts;

      const updateData: Record<string, unknown> = { code_attempts: newAttempts };

      if (newAttempts >= MAX_CODE_ATTEMPTS) {
        updateData.locked_until = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString();
      }

      await supabase
        .from("guest_verifications")
        .update(updateData)
        .eq("id", verification_id);

      if (newAttempts >= MAX_CODE_ATTEMPTS) {
        return NextResponse.json(
          { error: "Too many failed attempts. Please try again later.", retry_after: LOCKOUT_MINUTES * 60 },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Invalid or expired code", attempts_remaining: attemptsRemaining },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();

    // Phase ABC6: Get date_key from verification record
    // Note: date_key column added in Phase ABC6 migration, using type assertion until types regenerated
    const effectiveDateKey = (verification as { date_key?: string }).date_key;

    if (!effectiveDateKey) {
      // date_key is required for per-occurrence claims (Phase ABC6)
      return NextResponse.json(
        { error: "Missing date_key in verification record" },
        { status: 400 }
      );
    }

    // Check if slot is still available for this occurrence
    // Phase ABC6: Claims inherit occurrence scoping from timeslot_id (timeslots are per-occurrence)
    const { data: existingClaim } = await supabase
      .from("timeslot_claims")
      .select("id, status")
      .eq("timeslot_id", verification.timeslot_id)
      .not("status", "in", "(cancelled,no_show)")
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "This slot was just taken by someone else" },
        { status: 409 }
      );
    }

    // Get event and timeslot info with full event details
    const { data: timeslot } = await supabase
      .from("event_timeslots")
      .select(`
        id,
        slot_index,
        start_offset_minutes,
        duration_minutes,
        event:events!inner(
          id,
          title,
          slug,
          host_id,
          event_date,
          start_time,
          venue_name,
          venue_address
        )
      `)
      .eq("id", verification.timeslot_id)
      .single();

    if (!timeslot) {
      return NextResponse.json({ error: "Timeslot not found" }, { status: 404 });
    }

    // Create the timeslot claim
    // Phase ABC6: Claims inherit date_key from their timeslot (via timeslot_id FK)
    const { data: claim, error: claimError } = await supabase
      .from("timeslot_claims")
      .insert({
        timeslot_id: verification.timeslot_id,
        member_id: null, // Guest claim
        guest_name: verification.guest_name,
        guest_email: verification.email,
        guest_verified: true,
        guest_verification_id: verification.id,
        status: "confirmed",
      })
      .select("id, guest_name, status, claimed_at")
      .single();

    if (claimError) {
      console.error("Create timeslot claim error:", claimError);
      // Check if it's a duplicate constraint error
      if (claimError.code === "23505") {
        return NextResponse.json(
          { error: "This slot was just taken by someone else" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to claim slot" },
        { status: 500 }
      );
    }

    // Update verification as complete
    await supabase
      .from("guest_verifications")
      .update({ verified_at: verifiedAt, claim_id: claim.id })
      .eq("id", verification.id);

    // Extract event data with proper typing
    const event = timeslot.event as {
      id: string;
      title: string;
      slug: string | null;
      host_id: string | null;
      event_date: string | null;
      start_time: string | null;
      venue_name: string | null;
      venue_address: string | null;
    };
    // Phase ABC6: Include date in event URL for per-occurrence deep-linking
    const eventUrl = effectiveDateKey
      ? `/events/${event.slug || event.id}?date=${effectiveDateKey}`
      : `/events/${event.slug || event.id}`;
    const guestName = verification.guest_name || "A guest";
    const guestEmail = verification.email;

    // Calculate slot time
    const slotTime = formatSlotTime(event.start_time, timeslot.start_offset_minutes);
    const slotNumber = timeslot.slot_index + 1;

    // Phase ABC6: Use date_key for occurrence date, fallback to event_date
    const dateKeyForDisplay = effectiveDateKey || event.event_date;
    const eventDate = dateKeyForDisplay
      ? formatDateKeyForEmail(dateKeyForDisplay)
      : "TBD";

    // Phase ABC6: Short date for notifications
    const occurrenceDateShort = effectiveDateKey ? formatDateKeyShort(effectiveDateKey) : undefined;

    // Format event time for display
    const eventTime = event.start_time
      ? formatTimeForDisplay(event.start_time)
      : "TBD";

    // Send confirmation email to guest
    if (guestEmail) {
      // Create a proper action token for cancellation — valid until end of event day
      const timeslotExpiresAt = effectiveDateKey
        ? endOfEventDayDenver(effectiveDateKey)
        : undefined;
      const cancelToken = await createActionToken(
        {
          email: guestEmail,
          claim_id: claim.id,
          action: "cancel",
          verification_id: verification.id,
        },
        timeslotExpiresAt ? { expiresAt: timeslotExpiresAt } : undefined
      );
      const cancelUrl = `${SITE_URL}/guest/action?token=${cancelToken}&action=cancel`;

      const confirmationEmail = getTimeslotClaimConfirmationEmail({
        performerName: guestName,
        eventTitle: event.title || "Event",
        eventDate,
        eventTime,
        venueName: event.venue_name || "TBD",
        venueAddress: event.venue_address || undefined,
        slotTime: slotTime || `Slot ${slotNumber}`,
        slotNumber,
        eventUrl: `${SITE_URL}${eventUrl}`,
        cancelUrl,
        isGuest: true,
      });

      sendEmail({
        to: guestEmail,
        subject: confirmationEmail.subject,
        html: confirmationEmail.html,
        text: confirmationEmail.text,
      }).catch((err) => console.error("Failed to send guest confirmation email:", err));
    }

    // Notify event host about the guest signup
    if (event.host_id) {
      notifyEventHost(
        supabase,
        event.host_id,
        guestName,
        event.title || "Event",
        eventUrl,
        slotNumber,
        slotTime,
        occurrenceDateShort
      ).catch((err) => console.error("Failed to notify event host:", err));
    }

    // Phase ABC6: Include date_key in response (from verification, not claim)
    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        guest_name: claim.guest_name,
        status: claim.status,
        claimed_at: claim.claimed_at,
      },
      date_key: effectiveDateKey,
    });
  } catch (error) {
    console.error("Verify timeslot claim code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to format slot time
function formatSlotTime(eventStartTime: string | null, offsetMinutes: number | null): string | null {
  if (!eventStartTime || offsetMinutes === null) return null;

  const [hours, minutes] = eventStartTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

// Helper function to format event time for display
function formatTimeForDisplay(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

async function notifyEventHost(
  supabase: ReturnType<typeof createServiceRoleClient>,
  hostId: string,
  guestName: string,
  eventTitle: string,
  eventUrl: string,
  slotNumber: number,
  slotTime: string | null,
  occurrenceDate?: string
) {
  // Phase ABC6: Include occurrence date in notification messages
  const dateText = occurrenceDate ? ` (${occurrenceDate})` : "";
  const title = `${guestName} (guest) signed up for slot ${slotNumber}${dateText}`;
  const message = `${guestName} (guest) claimed slot ${slotNumber} for "${eventTitle}"${dateText}`;

  const { data: userData } = await supabase.auth.admin.getUserById(hostId);
  const userEmail = userData?.user?.email;

  const emailData = getTimeslotSignupHostNotificationEmail({
    eventTitle,
    eventUrl: `${SITE_URL}${eventUrl}`,
    performerName: guestName,
    slotNumber,
    slotTime: slotTime || undefined,
    isGuest: true,
    occurrenceDate, // Phase ABC6: Pass occurrence date to email
  });

  await sendEmailWithPreferences({
    supabase,
    userId: hostId,
    templateKey: "eventCommentNotification", // Reuse event_updates category
    payload: userEmail
      ? { to: userEmail, subject: emailData.subject, html: emailData.html, text: emailData.text }
      : { to: "", subject: "", html: "", text: "" },
    notification: {
      type: "event_signup",
      title,
      message,
      link: `${eventUrl}#lineup`,
    },
  });
}
