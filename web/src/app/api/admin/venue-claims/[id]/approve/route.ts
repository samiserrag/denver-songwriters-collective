/**
 * Admin Venue Claim Approval API - ABC8
 *
 * POST: Approve a venue claim and grant owner access
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getVenueClaimApprovedEmail } from "@/lib/email/templates/venueClaimApproved";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, sessionUser.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Check if user already has active access to this venue
    const { data: existingManager } = await supabase
      .from("venue_managers")
      .select("id")
      .eq("venue_id", claim.venue_id)
      .eq("user_id", claim.requester_id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      // Auto-reject: user already has access
      await supabase
        .from("venue_claims")
        .update({
          status: "rejected",
          reviewed_by: sessionUser.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: "User already has active access to this venue.",
        })
        .eq("id", claimId);

      return NextResponse.json(
        { error: "User already has access to this venue. Claim auto-rejected." },
        { status: 409 }
      );
    }

    // Update claim status to approved
    const { error: updateError } = await supabase
      .from("venue_claims")
      .update({
        status: "approved",
        reviewed_by: sessionUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("[VenueClaimApprove] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to approve claim" },
        { status: 500 }
      );
    }

    // Grant owner access via venue_managers
    const { error: grantError } = await supabase.from("venue_managers").insert({
      venue_id: claim.venue_id,
      user_id: claim.requester_id,
      role: "owner",
      grant_method: "claim",
      created_by: sessionUser.id,
    });

    if (grantError) {
      console.error("[VenueClaimApprove] Grant error:", grantError);
      // Rollback claim status
      await supabase
        .from("venue_claims")
        .update({ status: "pending", reviewed_by: null, reviewed_at: null })
        .eq("id", claimId);

      return NextResponse.json(
        { error: "Failed to grant venue access" },
        { status: 500 }
      );
    }

    // Send approval email notification
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
        const emailContent = getVenueClaimApprovedEmail({
          userName: requester.full_name,
          venueName: venue.name,
          venueId: venue.id,
          venueSlug: venue.slug,
          role: "owner",
        });

        await sendEmailWithPreferences({
          supabase,
          userId: claim.requester_id,
          templateKey: "venueClaimApproved",
          payload: {
            to: requester.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          },
          notification: {
            type: "venue_claim",
            title: `You're now an owner of ${venue.name}`,
            message: "Your venue claim has been approved.",
            link: `/dashboard/my-venues`,
          },
        });
      }
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error("[VenueClaimApprove] Email error:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Claim approved. User is now a venue owner.",
    });
  } catch (error) {
    console.error("[VenueClaimApprove] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
