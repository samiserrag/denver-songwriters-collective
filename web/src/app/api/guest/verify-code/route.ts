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
  endOfEventDayDenver,
} from "@/lib/guest-verification/crypto";
import { sendEmail, getClaimConfirmedEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/siteUrl";

const { MAX_CODE_ATTEMPTS, LOCKOUT_MINUTES } = GUEST_VERIFICATION_CONFIG;

interface VerifyCodeBody {
  verification_id: string;
  code: string;
}

/**
 * POST /api/guest/verify-code
 *
 * Verify a guest's email with the 6-digit code.
 * On success, creates a timeslot claim for the guest.
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

    // Fetch event details for email
    const { data: event } = await supabase
      .from("events")
      .select("id, title, visibility")
      .eq("id", verification.event_id)
      .single();

    // PR5: Invite-only events do not allow guest timeslot claims
    if ((event as { visibility?: string })?.visibility === "invite_only") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventTitle = event?.title || "Open Mic";

    // Check one-guest-per-occurrence: email cannot have active claim in this event + date
    // ABC10b: Fixed to scope by date_key for per-occurrence claims
    const { data: eventTimeslots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", verification.event_id)
      .eq("date_key", verification.date_key);

    const eventTimeslotIds = eventTimeslots?.map((t) => t.id) || [];

    if (eventTimeslotIds.length > 0) {
      const { data: existingClaims } = await supabase
        .from("timeslot_claims")
        .select("id, timeslot_id")
        .eq("guest_email", verification.email)
        .in("timeslot_id", eventTimeslotIds)
        .in("status", ["confirmed", "offered", "waitlist"]);

      if (existingClaims && existingClaims.length > 0) {
        return NextResponse.json(
          { error: "You already have a claim for this occurrence" },
          { status: 409 }
        );
      }
    }

    // Validate timeslot_id exists
    if (!verification.timeslot_id) {
      return NextResponse.json(
        { error: "Invalid verification: missing timeslot" },
        { status: 400 }
      );
    }

    // Check if slot is already taken (has active claim)
    const { data: activeClaim } = await supabase
      .from("timeslot_claims")
      .select("id")
      .eq("timeslot_id", verification.timeslot_id)
      .in("status", ["confirmed", "offered", "performed"])
      .maybeSingle();

    // Determine status: confirmed if open, waitlist if taken
    let status: "confirmed" | "waitlist" = "confirmed";
    let waitlistPosition: number | null = null;

    if (activeClaim) {
      // Slot is taken, join waitlist
      status = "waitlist";

      // Get next waitlist position
      const { data: waitlistClaims } = await supabase
        .from("timeslot_claims")
        .select("waitlist_position")
        .eq("timeslot_id", verification.timeslot_id)
        .eq("status", "waitlist")
        .order("waitlist_position", { ascending: false })
        .limit(1);

      const maxPosition =
        waitlistClaims && waitlistClaims.length > 0
          ? waitlistClaims[0].waitlist_position || 0
          : 0;
      waitlistPosition = maxPosition + 1;
    }

    // Create the timeslot claim
    const { data: claim, error: claimError } = await supabase
      .from("timeslot_claims")
      .insert({
        timeslot_id: verification.timeslot_id,
        member_id: null, // Guest claims have no member_id
        guest_name: verification.guest_name,
        guest_email: verification.email,
        guest_verified: true,
        guest_verification_id: verification.id,
        status,
        waitlist_position: waitlistPosition,
        claimed_at: verifiedAt,
      })
      .select("*")
      .single();

    if (claimError) {
      // Handle race condition - slot was claimed between check and insert
      if (claimError.code === "23505") {
        return NextResponse.json(
          { error: "Slot was just claimed. Please try another slot." },
          { status: 409 }
        );
      }
      console.error("Create claim error:", claimError);
      return NextResponse.json(
        { error: "Failed to create claim" },
        { status: 500 }
      );
    }

    // Create action tokens for confirm/cancel — valid until end of event day
    const claimExpiresAt = verification.date_key
      ? endOfEventDayDenver(verification.date_key)
      : undefined;

    const confirmToken = await createActionToken(
      {
        email: verification.email,
        claim_id: claim.id,
        action: "confirm",
        verification_id: verification.id,
      },
      claimExpiresAt ? { expiresAt: claimExpiresAt } : undefined
    );

    const cancelToken = await createActionToken(
      {
        email: verification.email,
        claim_id: claim.id,
        action: "cancel",
        verification_id: verification.id,
      },
      claimExpiresAt ? { expiresAt: claimExpiresAt } : undefined
    );

    // Update verification as verified and store tokens
    await supabase
      .from("guest_verifications")
      .update({
        verified_at: verifiedAt,
        claim_id: claim.id,
        action_token: confirmToken, // Store confirm token for offer flow
        action_type: "confirm",
        token_expires_at: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq("id", verification.id);

    // Build response URLs (always absolute with protocol)
    const baseUrl = getSiteUrl();

    const cancelUrl = `${baseUrl}/guest/action?token=${cancelToken}&action=cancel`;

    // Get slot index for email
    const { data: timeslot } = await supabase
      .from("event_timeslots")
      .select("slot_index")
      .eq("id", verification.timeslot_id)
      .single();

    // Send confirmation email
    const emailContent = getClaimConfirmedEmail({
      guestName: verification.guest_name,
      eventTitle,
      slotNumber: timeslot?.slot_index !== undefined ? timeslot.slot_index + 1 : undefined, // 1-indexed for humans
      cancelUrl,
      status: status as "confirmed" | "waitlist",
      waitlistPosition: waitlistPosition ?? undefined,
    });

    await sendEmail({
      to: verification.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        guest_name: claim.guest_name,
        waitlist_position: claim.waitlist_position,
        claimed_at: claim.claimed_at,
      },
      action_urls: {
        confirm: `${baseUrl}/guest/action?token=${confirmToken}&action=confirm`,
        cancel: `${baseUrl}/guest/action?token=${cancelToken}&action=cancel`,
      },
    });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
