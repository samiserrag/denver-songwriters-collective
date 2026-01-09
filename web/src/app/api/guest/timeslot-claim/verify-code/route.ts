import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationDisabled,
  featureDisabledResponse,
  GUEST_VERIFICATION_CONFIG,
} from "@/lib/guest-verification/config";
import { verifyCodeHash } from "@/lib/guest-verification/crypto";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getContentCommentNotificationEmail } from "@/lib/email/templates/contentCommentNotification";

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

    // Check if slot is still available
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

    // Get event and timeslot info
    const { data: timeslot } = await supabase
      .from("event_timeslots")
      .select(`
        id,
        slot_index,
        event:events!inner(id, title, slug, host_id)
      `)
      .eq("id", verification.timeslot_id)
      .single();

    if (!timeslot) {
      return NextResponse.json({ error: "Timeslot not found" }, { status: 404 });
    }

    // Create the timeslot claim
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

    // Notify event host about the guest signup
    const event = timeslot.event as { id: string; title: string; slug: string | null; host_id: string | null };
    if (event.host_id) {
      const eventUrl = `/events/${event.slug || event.id}`;
      const guestName = verification.guest_name || "A guest";

      notifyEventHost(
        supabase,
        event.host_id,
        guestName,
        event.title || "Event",
        eventUrl,
        timeslot.slot_index
      ).catch((err) => console.error("Failed to notify event host:", err));
    }

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        guest_name: claim.guest_name,
        status: claim.status,
        claimed_at: claim.claimed_at,
      },
    });
  } catch (error) {
    console.error("Verify timeslot claim code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function notifyEventHost(
  supabase: ReturnType<typeof createServiceRoleClient>,
  hostId: string,
  guestName: string,
  eventTitle: string,
  eventUrl: string,
  slotIndex: number
) {
  const title = `${guestName} (guest) signed up for slot ${slotIndex + 1}`;
  const message = `${guestName} (guest) claimed slot ${slotIndex + 1} for "${eventTitle}"`;

  const { data: userData } = await supabase.auth.admin.getUserById(hostId);
  const userEmail = userData?.user?.email;

  const emailData = getContentCommentNotificationEmail({
    contentType: "event",
    contentTitle: eventTitle,
    contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${eventUrl}`,
    commenterName: guestName,
    commentPreview: `Claimed slot ${slotIndex + 1}`,
    isReply: false,
  });

  await sendEmailWithPreferences({
    supabase,
    userId: hostId,
    templateKey: "eventCommentNotification",
    payload: userEmail
      ? { to: userEmail, subject: `Guest signup for ${eventTitle}`, html: emailData.html, text: emailData.text }
      : { to: "", subject: "", html: "", text: "" },
    notification: {
      type: "event_signup",
      title,
      message,
      link: eventUrl,
    },
  });
}
