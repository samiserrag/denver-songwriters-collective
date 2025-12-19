import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  isGuestVerificationEnabled,
  featureDisabledResponse,
} from "@/lib/guest-verification/config";
import { verifyActionToken, createActionToken } from "@/lib/guest-verification/crypto";
import { sendEmail, getWaitlistOfferEmail } from "@/lib/email";

interface ActionBody {
  token: string;
  action: "confirm" | "cancel";
}

/**
 * POST /api/guest/action
 *
 * Perform an action (confirm or cancel) on a guest claim using a signed token.
 * Token is validated for signature, expiry, and single-use.
 */
export async function POST(request: NextRequest) {
  // Feature flag check
  if (!isGuestVerificationEnabled()) {
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

    if (!["confirm", "cancel"].includes(action)) {
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
      .select("id, token_used, claim_id")
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
    timeslot_id: string;
    event_timeslots: { event_id: string };
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

  // If this was a confirmed/offered claim, promote from waitlist
  if (wasConfirmedOrOffered) {
    // Get event details for offer window and email
    const { data: event } = await supabase
      .from("events")
      .select("id, title, slot_offer_window_minutes")
      .eq("id", claim.event_timeslots.event_id)
      .single();

    const offerWindowMinutes = event?.slot_offer_window_minutes || 120;

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
      const baseUrl =
        process.env.PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";

      // Create new action tokens for the promoted guest
      const confirmToken = await createActionToken({
        email: promotedClaim.guest_email,
        claim_id: promotedClaim.id,
        action: "confirm",
        verification_id: promotedClaim.guest_verification_id,
      });

      const cancelToken = await createActionToken({
        email: promotedClaim.guest_email,
        claim_id: promotedClaim.id,
        action: "cancel",
        verification_id: promotedClaim.guest_verification_id,
      });

      const confirmUrl = `${baseUrl}/guest/action?token=${confirmToken}`;
      const cancelUrl = `${baseUrl}/guest/action?token=${cancelToken}`;

      // Send waitlist offer email
      const emailContent = getWaitlistOfferEmail({
        guestName: promotedClaim.guest_name,
        eventTitle: event?.title || "Open Mic",
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
