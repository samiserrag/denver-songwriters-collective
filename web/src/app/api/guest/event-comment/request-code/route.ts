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
import {
  validateDateKeyForWrite,
  dateKeyErrorResponse,
  formatDateKeyShort,
} from "@/lib/events/dateKeyContract";

const {
  CODE_EXPIRES_MINUTES,
  MAX_CODES_PER_EMAIL_PER_HOUR,
} = GUEST_VERIFICATION_CONFIG;

interface RequestCodeBody {
  event_id: string;
  guest_name: string;
  guest_email: string;
  content: string;
  parent_id?: string | null;
  /** Phase ABC6: date_key for per-occurrence comments */
  date_key?: string;
}

/**
 * POST /api/guest/event-comment/request-code
 *
 * Request a verification code for guest comment.
 * Creates a guest_verifications record and sends code via email.
 */
export async function POST(request: NextRequest) {
  // Emergency kill switch only (guest verification is always enabled)
  if (isGuestVerificationDisabled()) {
    return featureDisabledResponse();
  }

  try {
    const body = (await request.json()) as RequestCodeBody;
    const { event_id, guest_name, guest_email, content, parent_id, date_key: providedDateKey } = body;

    // Validate required fields
    if (!event_id || !guest_name || !guest_email || !content) {
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

    // Trim and validate guest name
    const trimmedName = guest_name.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Guest name must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Validate comment content
    const trimmedContent = content.trim();
    if (trimmedContent.length < 1) {
      return NextResponse.json(
        { error: "Comment content required" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 2000) {
      return NextResponse.json(
        { error: "Comment too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const normalizedEmail = guest_email.toLowerCase().trim();

    // Phase ABC6: Validate date_key and check for cancelled occurrence
    const dateKeyResult = await validateDateKeyForWrite(event_id, providedDateKey);
    if (!dateKeyResult.success) {
      return dateKeyErrorResponse(dateKeyResult.error);
    }
    const { effectiveDateKey } = dateKeyResult;

    // Fetch event and validate
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, is_published, status")
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

    // Delete any existing unverified comment verifications for this email+event
    // Note: comment_id IS NULL distinguishes pending comment verifications
    await supabase
      .from("guest_verifications")
      .delete()
      .eq("email", normalizedEmail)
      .eq("event_id", event_id)
      .is("comment_id", null)
      .is("timeslot_id", null)
      .is("rsvp_id", null)
      .is("verified_at", null);

    // Create new verification record
    // Store the pending comment content in guest_name field (repurposed as JSON)
    const pendingCommentData = JSON.stringify({
      content: trimmedContent,
      parent_id: parent_id || null,
    });

    // Phase ABC6: Include date_key in verification record
    const { data: verification, error: insertError } = await supabase
      .from("guest_verifications")
      .insert({
        email: normalizedEmail,
        event_id: event_id,
        timeslot_id: null,
        rsvp_id: null,
        comment_id: null,
        guest_name: trimmedName,
        code: codeHash,
        code_expires_at: expiresAt,
        code_attempts: 0,
        locked_until: null,
        verified_at: null,
        // Store pending comment data in action_type field
        action_type: "comment",
        action_token: pendingCommentData,
        date_key: effectiveDateKey,
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
    // Phase ABC6: Include occurrence date for context
    const emailContent = getVerificationCodeEmail({
      guestName: trimmedName,
      eventTitle: event.title || "Event",
      code,
      expiresInMinutes: CODE_EXPIRES_MINUTES,
      purpose: "comment",
      occurrenceDate: formatDateKeyShort(effectiveDateKey),
    });

    await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    // Log code in development for testing
    if (process.env.NODE_ENV === "development") {
      const domain = normalizedEmail.split("@")[1];
      console.log(`[DEV] Comment verification code for @${domain}: ${code}`);
    }

    // Phase ABC6: Return generic success with date_key
    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      verification_id: verification.id,
      expires_at: expiresAt,
      date_key: effectiveDateKey,
    });
  } catch (error) {
    console.error("Request comment code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
