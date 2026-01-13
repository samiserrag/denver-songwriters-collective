/**
 * Admin Venue Manager API - ABC9
 *
 * DELETE: Revoke a manager's access to a venue (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; managerId: string }> }
) {
  try {
    const { id: venueId, managerId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin check
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason?.trim() || null;

    const serviceClient = createServiceRoleClient();

    // Verify the manager grant exists and belongs to this venue
    const { data: manager, error: findError } = await serviceClient
      .from("venue_managers")
      .select("id, venue_id, user_id, revoked_at")
      .eq("id", managerId)
      .eq("venue_id", venueId)
      .single();

    if (findError || !manager) {
      return NextResponse.json(
        { error: "Manager grant not found" },
        { status: 404 }
      );
    }

    if (manager.revoked_at) {
      return NextResponse.json(
        { error: "Access already revoked" },
        { status: 409 }
      );
    }

    // Soft-delete by setting revoked_at
    const { error: updateError } = await serviceClient
      .from("venue_managers")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoked_reason: reason,
      })
      .eq("id", managerId);

    if (updateError) {
      console.error("[AdminVenueManager] Revoke error:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke access" },
        { status: 500 }
      );
    }

    console.log(
      `[AdminVenueManager] Admin ${user.id} revoked access for manager ${managerId} on venue ${venueId}. Reason: ${reason || "none"}`
    );

    return NextResponse.json({
      success: true,
      message: "Access revoked successfully",
    });
  } catch (error) {
    console.error("[AdminVenueManager] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
