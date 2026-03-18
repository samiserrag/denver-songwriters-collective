import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

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

    const body = await request.json();
    const rejectionReason = typeof body.reason === "string" ? body.reason.trim() || null : null;

    const { data: claim, error: claimError } = await supabase
      .from("organization_claims")
      .select("id, status")
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

    const { error: updateError } = await supabase
      .from("organization_claims")
      .update({
        status: "rejected",
        reviewed_by: sessionUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("[OrganizationClaimReject] Update error:", updateError);
      return NextResponse.json({ error: "Failed to reject claim" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Claim rejected.",
    });
  } catch (error) {
    console.error("[OrganizationClaimReject] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
