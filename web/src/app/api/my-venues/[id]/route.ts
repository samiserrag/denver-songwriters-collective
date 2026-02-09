/**
 * My Venue Management API - ABC8
 *
 * DELETE: Relinquish access to a venue
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    // Find user's active grant for this venue
    const { data: grant, error: findError } = await supabase
      .from("venue_managers")
      .select("id, role")
      .eq("venue_id", venueId)
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (findError || !grant) {
      return NextResponse.json(
        { error: "You don't have access to this venue" },
        { status: 404 }
      );
    }

    // If user is the sole owner, check if there are other owners
    if (grant.role === "owner") {
      const { count } = await supabase
        .from("venue_managers")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("role", "owner")
        .is("revoked_at", null);

      if (count === 1) {
        return NextResponse.json(
          {
            error:
              "You are the only owner of this venue. Transfer ownership or contact an admin to relinquish access.",
          },
          { status: 400 }
        );
      }
    }

    // Revoke the grant (soft delete)
    const { error: revokeError } = await supabase
      .from("venue_managers")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: sessionUser.id,
        revoked_reason: "User relinquished access",
      })
      .eq("id", grant.id);

    if (revokeError) {
      console.error("[MyVenueDelete] Revoke error:", revokeError);
      return NextResponse.json(
        { error: "Failed to relinquish access" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You no longer have access to this venue",
    });
  } catch (error) {
    console.error("[MyVenueDelete] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
