import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import {
  verifyCodeHash,
  createActionToken,
} from "@/lib/guest-verification/crypto";
import { sendEmail } from "@/lib/email";
import { getRsvpConfirmationEmail } from "@/lib/emailTemplates";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/rsvp/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates an RSVP for the guest.
 */
export async function POST(request: NextRequest) {
  // Emergency kill switch only (guest verification is always enabled)
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as VerifyCodeBody;
    const { verification_id, code } = body;

    // Validate required fields
    if (!verification_id || !code) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch verification record
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

    // Check this is an RSVP verification (not a slot claim)
    if (verification.timeslot_id !== null) {
      return NextResponse.json(
        { error: "Invalid verification type" },
        { status: 400 }
      );
    }

    // Check if already verified
    if (verification.verified_at) {
      return NextResponse.json(
        { error: "Code already used" },
        { status: 400 }
      );
    }

    // Check if locked out
    if (
      verification.locked_until &&
      new Date(verification.locked_until) > new Date()
    ) {
      const retryAfter = Math.ceil(
        (new Date(verification.locked_until).getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: "Too many failed attempts. Please try again later.",
          retry_after: retryAfter,
        },
        { status: 429 }
      );
    }

    // Check if expired
    if (
      verification.code_expires_at &&
      new Date(verification.code_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Verify code (constant-time comparison)
    const isValidCode = verifyCodeHash(code, verification.code || "");

    if (!isValidCode) {
      // Increment attempts
      const newAttempts = (verification.code_attempts || 0) + 1;
      const attemptsRemaining = MAX_CODE_ATTEMPTS - newAttempts;

      // Lock out if too many attempts
      const updateData: Record<string, unknown> = {
        code_attempts: newAttempts,
      };

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
          {
            error: "Too many failed attempts. Please try again later.",
            retry_after: LOCKOUT_MINUTES * 60,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Invalid or expired code",
          attempts_remaining: attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // Code is valid - verify the email
    const verifiedAt = new Date().toISOString();

    // Fetch event details
    const { data: event } = await supabase
      .from("events")
      .select("id, slug, title, capacity, status, event_date, start_time, venue_name, venue_address")
      .eq("id", verification.event_id)
      .single();

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (event.status !== "active") {
      return NextResponse.json(
        { error: "Event is no longer accepting RSVPs" },
        { status: 400 }
      );
    }

    // Check for existing RSVP by this email
    const { data: existingRsvp } = await supabase
      .from("event_rsvps")
      .select("id")
      .eq("event_id", verification.event_id)
      .eq("guest_email", verification.email)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingRsvp) {
      return NextResponse.json(
        { error: "You already have an RSVP for this event" },
        { status: 409 }
      );
    }

    // Determine status: confirmed or waitlist based on capacity
    let status: "confirmed" | "waitlist" = "confirmed";
    let waitlistPosition: number | null = null;

    if (event.capacity !== null) {
      // Count current confirmed RSVPs
      const { count: confirmedCount } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", verification.event_id)
        .eq("status", "confirmed");

      if ((confirmedCount || 0) >= event.capacity) {
        status = "waitlist";

        // Get next waitlist position
        const { data: lastWaitlist } = await supabase
          .from("event_rsvps")
          .select("waitlist_position")
          .eq("event_id", verification.event_id)
          .eq("status", "waitlist")
          .order("waitlist_position", { ascending: false })
          .limit(1)
          .maybeSingle();

        waitlistPosition = (lastWaitlist?.waitlist_position || 0) + 1;
      }
    }

    // Create the RSVP (no user_id for guests)
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .insert({
        event_id: verification.event_id,
        user_id: null, // Guest RSVP
        guest_name: verification.guest_name,
        guest_email: verification.email,
        guest_verified: true,
        guest_verification_id: verification.id,
        status,
        waitlist_position: waitlistPosition,
        notes: null,
      })
      .select("*")
      .single();

    if (rsvpError) {
      // Handle race condition
      if (rsvpError.code === "23505") {
        return NextResponse.json(
          { error: "You already have an RSVP for this event" },
          { status: 409 }
        );
      }
      console.error("Create RSVP error:", rsvpError);
      return NextResponse.json(
        { error: "Failed to create RSVP" },
        { status: 500 }
      );
    }

    // Create action token for cancel
    const cancelToken = await createActionToken({
      email: verification.email,
      rsvp_id: rsvp.id,
      action: "cancel_rsvp",
      verification_id: verification.id,
    });

    // Update verification as verified and store rsvp_id
    await supabase
      .from("guest_verifications")
      .update({
        verified_at: verifiedAt,
        rsvp_id: rsvp.id,
        action_token: cancelToken,
        action_type: "cancel_rsvp",
        token_expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days for RSVP cancel
        ).toISOString(),
      })
      .eq("id", verification.id);

    // Build cancel URL
    const baseUrl =
      process.env.PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";

    const cancelUrl = `${baseUrl}/guest/action?token=${cancelToken}`;

    // Send RSVP confirmation email
    const emailContent = getRsvpConfirmationEmail({
      eventTitle: event.title || "Event",
      eventDate: event.event_date || "TBA",
      eventTime: event.start_time || "TBA",
      venueName: event.venue_name || "TBA",
      venueAddress: event.venue_address || undefined,
      eventId: event.id,
      eventSlug: event.slug,
      isWaitlist: status === "waitlist",
      waitlistPosition: waitlistPosition ?? undefined,
      guestName: verification.guest_name,
      cancelUrl,
    });

    await sendEmail({
      to: verification.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: true,
      rsvp: {
        id: rsvp.id,
        status: rsvp.status,
        guest_name: rsvp.guest_name,
        waitlist_position: rsvp.waitlist_position,
        created_at: rsvp.created_at,
      },
      cancel_url: cancelUrl,
    });
  } catch (error) {
    console.error("Verify RSVP code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
