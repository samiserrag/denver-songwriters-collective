/**
 * Admin Venue Claim Rejection API - ABC8
 *
 * POST: Reject a venue claim with optional reason
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getVenueClaimRejectedEmail } from "@/lib/email/templates/venueClaimRejected";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rejectionReason = body.reason?.trim() || null;

    // Fetch the claim
    const { data: claim, error: claimError } = await supabase
      .from("venue_claims")
      .select("id, venue_id, requester_id, status")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (claim.status !== "pending") {
      return NextResponse.json(
        { error: `Claim is already ${claim.status}` },
        { status: 400 }
      );
    }

    // Update claim status to rejected
    const { error: updateError } = await supabase
      .from("venue_claims")
      .update({
        status: "rejected",
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("[VenueClaimReject] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to reject claim" },
        { status: 500 }
      );
    }

    // Send rejection email notification
    try {
      // Fetch venue and requester details for email
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name, slug")
        .eq("id", claim.venue_id)
        .single();

      const { data: requester } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", claim.requester_id)
        .single();

      if (venue && requester?.email) {
        const emailContent = getVenueClaimRejectedEmail({
          userName: requester.full_name,
          venueName: venue.name,
          venueId: venue.id,
          venueSlug: venue.slug,
          reason: rejectionReason,
        });

        await sendEmailWithPreferences({
          supabase,
          userId: claim.requester_id,
          templateKey: "venueClaimRejected",
          payload: {
            to: requester.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          },
          notification: {
            type: "venue_claim",
            title: `Update on your claim for ${venue.name}`,
            message: rejectionReason || "Your venue claim was not approved.",
            link: `/venues/${venue.slug || venue.id}`,
          },
        });
      }
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error("[VenueClaimReject] Email error:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Claim rejected.",
    });
  } catch (error) {
    console.error("[VenueClaimReject] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
