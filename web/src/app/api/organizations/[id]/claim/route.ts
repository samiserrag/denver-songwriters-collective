import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() || null : null;

    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, is_active")
      .eq("id", organizationId)
      .single();

    if (orgError || !organization || !organization.is_active) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { data: existingClaim } = await supabase
      .from("organization_claims")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        { error: "You already have a pending claim for this organization" },
        { status: 409 }
      );
    }

    const { data: existingManager } = await supabase
      .from("organization_managers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      return NextResponse.json(
        { error: "You already manage this organization" },
        { status: 409 }
      );
    }

    const { data: claim, error: insertError } = await supabase
      .from("organization_claims")
      .insert({
        organization_id: organizationId,
        requester_id: sessionUser.id,
        message,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[OrganizationClaim] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      message: "Claim submitted successfully. An admin will review your request.",
    });
  } catch (error) {
    console.error("[OrganizationClaim] Unexpected POST error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: claim, error: findError } = await supabase
      .from("organization_claims")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (findError || !claim) {
      return NextResponse.json(
        { error: "No pending claim found to cancel" },
        { status: 404 }
      );
    }

    const { error: cancelError } = await supabase
      .from("organization_claims")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (cancelError) {
      console.error("[OrganizationClaim] Cancel error:", cancelError);
      return NextResponse.json({ error: "Failed to cancel claim" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Claim cancelled successfully" });
  } catch (error) {
    console.error("[OrganizationClaim] Unexpected DELETE error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
