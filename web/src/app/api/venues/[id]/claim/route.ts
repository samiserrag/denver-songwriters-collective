/**
 * Venue Claim API - ABC8
 *
 * POST: Submit a claim for venue ownership
 * DELETE: Cancel own pending claim
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = body.message?.trim() || null;

    // Verify venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, name")
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Check if user already has an active claim for this venue
    const { data: existingClaim } = await supabase
      .from("venue_claims")
      .select("id, status")
      .eq("venue_id", venueId)
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "You already have a pending claim for this venue" },
        { status: 409 }
      );
    }

    // Check if user already manages this venue
    const { data: existingManager } = await supabase
      .from("venue_managers")
      .select("id")
      .eq("venue_id", venueId)
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      return NextResponse.json(
        { error: "You already manage this venue" },
        { status: 409 }
      );
    }

    // Create the claim
    const { data: claim, error: insertError } = await supabase
      .from("venue_claims")
      .insert({
        venue_id: venueId,
        requester_id: sessionUser.id,
        message,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[VenueClaim] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit claim" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      message: "Claim submitted successfully. An admin will review your request.",
    });
  } catch (error) {
    console.error("[VenueClaim] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find and cancel the user's pending claim
    const { data: claim, error: findError } = await supabase
      .from("venue_claims")
      .select("id")
      .eq("venue_id", venueId)
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (findError || !claim) {
      return NextResponse.json(
        { error: "No pending claim found to cancel" },
        { status: 404 }
      );
    }

    // Cancel the claim
    const { error: updateError } = await supabase
      .from("venue_claims")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (updateError) {
      console.error("[VenueClaim] Cancel error:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel claim" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Claim cancelled successfully",
    });
  } catch (error) {
    console.error("[VenueClaim] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
