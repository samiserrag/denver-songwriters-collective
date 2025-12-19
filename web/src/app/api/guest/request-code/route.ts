import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationEnabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import {
  generateVerificationCode,
  hashCode,
} from "@/lib/guest-verification/crypto";
import { sendEmail, getVerificationCodeEmail } from "@/lib/email";

const {
  CODE_EXPIRES_MINUTES,
  MAX_CODES_PER_EMAIL_PER_HOUR,
} = GUEST_VERIFICATION_CONFIG;

interface RequestCodeBody {
  event_id: string;
  slot_index: number;
  guest_name: string;
  guest_email: string;
}

/**
 * POST /api/guest/request-code
 *
 * Request a verification code for guest slot claiming.
 * Creates a guest_verifications record and sends code via email (Phase 4).
 */
export async function POST(request: NextRequest) {
  // Feature flag check
  if (!isGuestVerificationEnabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as RequestCodeBody;
    const { event_id, slot_index, guest_name, guest_email } = body;

    // Validate required fields
    if (!event_id || slot_index === undefined || !guest_name || !guest_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format (basic RFC 5322)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate slot index
    if (typeof slot_index !== "number" || slot_index < 0) {
      return NextResponse.json(
        { error: "Invalid slot index" },
        { status: 400 }
      );
    }

    // Trim and validate guest name
    const trimmedName = guest_name.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Guest name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const normalizedEmail = guest_email.toLowerCase().trim();

    // Fetch event and validate
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, is_published, has_timeslots")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!event.is_published) {
      return NextResponse.json(
        { error: "Event is not published" },
        { status: 400 }
      );
    }

    if (!event.has_timeslots) {
      return NextResponse.json(
        { error: "Event does not support timeslots" },
        { status: 400 }
      );
    }

    // Fetch timeslot
    const { data: timeslot, error: timeslotError } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", event_id)
      .eq("slot_index", slot_index)
      .single();

    if (timeslotError || !timeslot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    // Check for existing active claim by this email on this event
    const { data: existingClaims } = await supabase
      .from("timeslot_claims")
      .select("id, status")
      .eq("guest_email", normalizedEmail)
      .in("status", ["confirmed", "offered", "waitlist"])
      .not("timeslot_id", "is", null);

    // Filter to only claims for this event's timeslots
    if (existingClaims && existingClaims.length > 0) {
      // Check if any of these claims are for this event
      const { data: eventTimeslots } = await supabase
        .from("event_timeslots")
        .select("id")
        .eq("event_id", event_id);

      const eventTimeslotIds = new Set(
        eventTimeslots?.map((t) => t.id) || []
      );

      // Get claim timeslot info
      for (const claim of existingClaims) {
        const { data: claimTimeslot } = await supabase
          .from("timeslot_claims")
          .select("timeslot_id")
          .eq("id", claim.id)
          .single();

        if (claimTimeslot && eventTimeslotIds.has(claimTimeslot.timeslot_id)) {
          return NextResponse.json(
            { error: "You already have a claim for this event" },
            { status: 409 }
          );
        }
      }
    }

    // Rate limiting: check codes sent in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCodes, error: rateError } = await supabase
      .from("guest_verifications")
      .select("id, created_at")
      .eq("email", normalizedEmail)
      .gte("created_at", oneHourAgo);

    if (rateError) {
      console.error("Rate limit check error:", rateError);
    }

    if (recentCodes && recentCodes.length >= MAX_CODES_PER_EMAIL_PER_HOUR) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retry_after: 3600,
        },
        { status: 429 }
      );
    }

    // Check for lockout
    const { data: lockedVerification } = await supabase
      .from("guest_verifications")
      .select("id, locked_until")
      .eq("email", normalizedEmail)
      .eq("event_id", event_id)
      .not("locked_until", "is", null)
      .gt("locked_until", new Date().toISOString())
      .maybeSingle();

    if (lockedVerification) {
      const lockedUntil = new Date(lockedVerification.locked_until!);
      const retryAfter = Math.ceil(
        (lockedUntil.getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: "Too many failed attempts. Please try again later.",
          retry_after: retryAfter,
        },
        { status: 429 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(
      Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000
    ).toISOString();

    // Delete any existing unverified verification for this email+event
    await supabase
      .from("guest_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("event_id", event_id)
      .is("verified_at", null);

    // Create new verification record
    const { data: verification, error: insertError } = await supabase
      .from("guest_verifications")
      .insert({
        email: normalizedEmail,
        event_id: event_id,
        timeslot_id: timeslot.id,
        guest_name: trimmedName,
        code: codeHash,
        code_expires_at: expiresAt,
        code_attempts: 0,
        locked_until: null,
        verified_at: null,
      })
      .select("id")
      .single();

    if (insertError || !verification) {
      console.error("Insert verification error:", insertError);
      return NextResponse.json(
        { error: "Failed to create verification" },
        { status: 500 }
      );
    }

    // Send verification code email
    const emailContent = getVerificationCodeEmail({
      guestName: trimmedName,
      eventTitle: event.title || "Open Mic",
      code,
      expiresInMinutes: CODE_EXPIRES_MINUTES,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    // Log code in development for testing (without full email)
    if (process.env.NODE_ENV === "development") {
      const domain = normalizedEmail.split("@")[1];
      console.log(`[DEV] Verification code for @${domain}: ${code}`);
    }

    // Return generic success (avoid email enumeration)
    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      verification_id: verification.id,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Request code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
