import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { SITE_URL } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/mailer";
import { getOrganizationInviteEmail } from "@/lib/email/templates/organizationInvite";

interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

interface InviteAuthorizationResult {
  authorized: boolean;
  organization?: OrganizationSummary;
  isAdmin: boolean;
  managerRole: InviteRole | null;
}

async function checkInviteAuthorization(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  userId: string
): Promise<InviteAuthorizationResult> {
  const isAdmin = await checkAdminRole(supabase, userId);

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", organizationId)
    .single();

  if (orgError || !organization) {
    return { authorized: false, isAdmin, managerRole: null };
  }

  if (isAdmin) {
    return { authorized: true, organization, isAdmin: true, managerRole: null };
  }

  const { data: grant } = await supabase
    .from("organization_managers")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  const managerRole = grant?.role === "owner" ? "owner" : grant?.role === "manager" ? "manager" : null;

  return { authorized: !!grant, organization, isAdmin: false, managerRole };
}

type InviteRole = "owner" | "manager";

function normalizeInviteRole(value: unknown): InviteRole {
  return value === "owner" ? "owner" : "manager";
}

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

    const { authorized, organization, isAdmin, managerRole } = await checkInviteAuthorization(
      supabase,
      organizationId,
      sessionUser.id
    );

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins and existing organization managers can create invites" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const emailRestriction = typeof body.email === "string"
      ? body.email.trim().toLowerCase() || null
      : typeof body.email_restriction === "string"
      ? body.email_restriction.trim().toLowerCase() || null
      : null;
    const expiresInDaysRaw = Number(body.expiresInDays || body.expires_in_days || 7) || 7;
    const expiresInDays = Math.max(1, Math.min(30, expiresInDaysRaw));
    const roleToGrant = normalizeInviteRole(body.role_to_grant);

    if (!isAdmin && managerRole !== "owner" && roleToGrant === "owner") {
      return NextResponse.json(
        { error: "Only owners or admins can create owner invites" },
        { status: 403 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data: invite, error: insertError } = await (supabase as any)
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        token_hash: tokenHash,
        email_restriction: emailRestriction,
        role_to_grant: roleToGrant,
        expires_at: expiresAt.toISOString(),
        created_by: sessionUser.id,
      })
      .select("id")
      .single();

    if (insertError || !invite) {
      console.error("[OrganizationInvite] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
    }

    const inviteUrl = `${SITE_URL}/organization-invite?token=${token}`;

    let emailSent = false;
    if (emailRestriction) {
      try {
        const { data: inviter } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", sessionUser.id)
          .single();

        const emailContent = getOrganizationInviteEmail({
          recipientName: null,
          organizationName: organization.name,
          inviterName: inviter?.full_name || null,
          inviteUrl,
          expiresAtIso: expiresAt.toISOString(),
          roleToGrant,
        });

        emailSent = await sendEmail({
          to: emailRestriction,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateName: "organizationInvite",
        });
      } catch (emailError) {
        console.error("[OrganizationInvite] Email send error:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      emailRestriction,
      roleToGrant,
      emailSent,
      message:
        "Invite created. Share this link with the intended recipient. The token will not be shown again.",
    });
  } catch (error) {
    console.error("[OrganizationInvite] Unexpected POST error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
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

    const { authorized, organization } = await checkInviteAuthorization(
      supabase,
      organizationId,
      sessionUser.id
    );

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins and existing organization managers can view invites" },
        { status: 403 }
      );
    }

    const { data: invites, error } = await (supabase as any)
      .from("organization_invites")
      .select(
        "id, role_to_grant, email_restriction, expires_at, created_at, created_by, accepted_at, accepted_by, revoked_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OrganizationInvite] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
    }

    const now = new Date();
    const invitesWithStatus = (invites || []).map((invite: any) => {
      let status: "pending" | "accepted" | "expired" | "revoked";
      if (invite.revoked_at) {
        status = "revoked";
      } else if (invite.accepted_at) {
        status = "accepted";
      } else if (new Date(invite.expires_at) < now) {
        status = "expired";
      } else {
        status = "pending";
      }
      return { ...invite, status };
    });

    return NextResponse.json({ invites: invitesWithStatus });
  } catch (error) {
    console.error("[OrganizationInvite] Unexpected GET error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
