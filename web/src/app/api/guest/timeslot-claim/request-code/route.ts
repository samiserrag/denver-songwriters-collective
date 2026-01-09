import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
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
  timeslot_id: string;
  guest_name: string;
  guest_email: string;
}

/**
 * POST /api/guest/timeslot-claim/request-code
 *
 * Request a verification code for guest timeslot claim.
 * Creates a guest_verifications record and sends code via email.
 */
export async function POST(request: NextRequest) {
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as RequestCodeBody;
    const { event_id, timeslot_id, guest_name, guest_email } = body;

    if (!event_id || !timeslot_id || !guest_name || !guest_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

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
      .select("id, title, is_published, status, has_timeslots")
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

    if (event.status !== "active") {
      return NextResponse.json(
        { error: "Event is no longer accepting signups" },
        { status: 400 }
      );
    }

    if (!event.has_timeslots) {
      return NextResponse.json(
        { error: "Event does not have timeslots" },
        { status: 400 }
      );
    }

    // Validate timeslot exists and belongs to this event
    const { data: timeslot, error: timeslotError } = await supabase
      .from("event_timeslots")
      .select("id, event_id")
      .eq("id", timeslot_id)
      .eq("event_id", event_id)
      .single();

    if (timeslotError || !timeslot) {
      return NextResponse.json({ error: "Timeslot not found" }, { status: 404 });
    }

    // Check if slot is already claimed
    const { data: existingClaim } = await supabase
      .from("timeslot_claims")
      .select("id, status")
      .eq("timeslot_id", timeslot_id)
      .not("status", "in", "(cancelled,no_show)")
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "This slot is already taken" },
        { status: 409 }
      );
    }

    // Check if this guest already has a pending verification or claim for this slot
    const { data: existingVerification } = await supabase
      .from("guest_verifications")
      .select("id, verified_at")
      .eq("email", normalizedEmail)
      .eq("timeslot_id", timeslot_id)
      .maybeSingle();

    if (existingVerification?.verified_at) {
      return NextResponse.json(
        { error: "You already claimed this slot" },
        { status: 409 }
      );
    }

    // Rate limiting: check codes sent in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCodes } = await supabase
      .from("guest_verifications")
      .select("id, created_at")
      .eq("email", normalizedEmail)
      .gte("created_at", oneHourAgo);

    if (recentCodes && recentCodes.length >= MAX_CODES_PER_EMAIL_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many requests", retry_after: 3600 },
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
      const retryAfter = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again later.", retry_after: retryAfter },
        { status: 429 }
      );
    }

    const code = generateVerificationCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000).toISOString();

    // Delete any existing unverified verifications for this timeslot
    await supabase
      .from("guest_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("timeslot_id", timeslot_id)
      .is("verified_at", null);

    const { data: verification, error: insertError } = await supabase
      .from("guest_verifications")
      .insert({
        email: normalizedEmail,
        event_id: event_id,
        timeslot_id: timeslot_id,
        guest_name: trimmedName,
        code: codeHash,
        code_expires_at: expiresAt,
        code_attempts: 0,
        locked_until: null,
        verified_at: null,
        action_type: "timeslot",
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

    const emailContent = getVerificationCodeEmail({
      guestName: trimmedName,
      eventTitle: event.title || "Event",
      code,
      expiresInMinutes: CODE_EXPIRES_MINUTES,
      purpose: "slot",
    });

    await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (process.env.NODE_ENV === "development") {
      const domain = normalizedEmail.split("@")[1];
      console.log(`[DEV] Timeslot claim verification code for @${domain}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      verification_id: verification.id,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Request timeslot claim code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
