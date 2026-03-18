import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const serviceClient = createServiceRoleClient();

    const { data: invite, error: findError } = await (serviceClient as any)
      .from("organization_invites")
      .select(
        "id, organization_id, email_restriction, role_to_grant, expires_at, accepted_at, revoked_at, created_by"
      )
      .eq("token_hash", tokenHash)
      .single();

    if (findError || !invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    if (invite.revoked_at) {
      return NextResponse.json({ error: "This invite has been revoked" }, { status: 400 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
    }

    if (invite.email_restriction) {
      const userEmail = sessionUser.email?.toLowerCase();
      if (userEmail !== invite.email_restriction.toLowerCase()) {
        return NextResponse.json(
          { error: "This invite is restricted to a different email address" },
          { status: 403 }
        );
      }
    }

    const { data: organization, error: orgError } = await (serviceClient as any)
      .from("organizations")
      .select("id, name, slug")
      .eq("id", invite.organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: "This organization no longer exists" }, { status: 404 });
    }

    const { data: existingManager } = await (serviceClient as any)
      .from("organization_managers")
      .select("id")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      return NextResponse.json(
        { error: "You already have access to this organization" },
        { status: 409 }
      );
    }

    const { error: grantError } = await (serviceClient as any).from("organization_managers").insert({
      organization_id: invite.organization_id,
      user_id: sessionUser.id,
      role: invite.role_to_grant,
      grant_method: "invite",
      created_by: invite.created_by || null,
    });

    if (grantError) {
      console.error("[OrganizationInviteAccept] Grant error:", grantError);
      return NextResponse.json({ error: "Failed to grant organization access" }, { status: 500 });
    }

    const acceptedAt = new Date().toISOString();
    const { error: acceptError } = await (serviceClient as any)
      .from("organization_invites")
      .update({
        accepted_at: acceptedAt,
        accepted_by: sessionUser.id,
      })
      .eq("id", invite.id);

    if (acceptError) {
      console.error("[OrganizationInviteAccept] Accept mark error:", acceptError);
    }

    if (invite.created_by) {
      const { data: acceptorProfile } = await serviceClient
        .from("profiles")
        .select("full_name, email")
        .eq("id", sessionUser.id)
        .single();

      const acceptorName =
        acceptorProfile?.full_name ||
        acceptorProfile?.email ||
        sessionUser.email ||
        "Someone";
      const roleLabel = invite.role_to_grant === "owner" ? "owner" : "manager";

      await serviceClient.rpc("create_user_notification", {
        p_user_id: invite.created_by,
        p_type: "organization_invite_accepted",
        p_title: "Organization invite accepted",
        p_message: `${acceptorName} accepted your invite and is now an ${roleLabel} of "${organization.name}".`,
        p_link: `/dashboard/my-organizations/${invite.organization_id}`,
      });
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      roleGranted: invite.role_to_grant,
      message: `You are now an ${invite.role_to_grant} of this organization.`,
    });
  } catch (error) {
    console.error("[OrganizationInviteAccept] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
