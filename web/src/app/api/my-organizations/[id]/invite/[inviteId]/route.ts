import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

type ManagerRole = "owner" | "manager";

async function getAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  userId: string
): Promise<{ isAdmin: boolean; managerRole: ManagerRole | null }> {
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return { isAdmin: true, managerRole: null };

  const { data: grant } = await supabase
    .from("organization_managers")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!grant) return { isAdmin: false, managerRole: null };
  if (grant.role === "owner") return { isAdmin: false, managerRole: "owner" };
  return { isAdmin: false, managerRole: "manager" };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: organizationId, inviteId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin, managerRole } = await getAccess(
      supabase,
      organizationId,
      sessionUser.id
    );

    if (!isAdmin && !managerRole) {
      return NextResponse.json(
        { error: "Only admins and organization managers can revoke invites" },
        { status: 403 }
      );
    }

    const { data: invite, error: inviteError } = await (supabase as any)
      .from("organization_invites")
      .select("id, role_to_grant, accepted_at, revoked_at")
      .eq("id", inviteId)
      .eq("organization_id", organizationId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (!isAdmin && managerRole !== "owner" && invite.role_to_grant === "owner") {
      return NextResponse.json(
        { error: "Only owners or admins can revoke owner invites" },
        { status: 403 }
      );
    }

    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "Cannot revoke an accepted invite" },
        { status: 400 }
      );
    }

    if (invite.revoked_at) {
      return NextResponse.json(
        { error: "Invite is already revoked" },
        { status: 400 }
      );
    }

    let reason: string | null = null;
    try {
      const body = await request.json();
      reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
    } catch {
      // Body is optional for DELETE.
    }

    const { error: updateError } = await (supabase as any)
      .from("organization_invites")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: sessionUser.id,
        revoked_reason: reason,
      })
      .eq("id", inviteId);

    if (updateError) {
      console.error("[OrganizationInviteRevoke] Update error:", updateError);
      return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Invite revoked" });
  } catch (error) {
    console.error("[OrganizationInviteRevoke] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
