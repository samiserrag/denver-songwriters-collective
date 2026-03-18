import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getOrganizationClaimApprovedEmail } from "@/lib/email/templates/organizationClaimApproved";
import { getOrganizationClaimRejectedEmail } from "@/lib/email/templates/organizationClaimRejected";

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

    const { data: claim, error: claimError } = await supabase
      .from("organization_claims")
      .select("id, organization_id, requester_id, status")
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

    const { data: existingManager } = await supabase
      .from("organization_managers")
      .select("id")
      .eq("organization_id", claim.organization_id)
      .eq("user_id", claim.requester_id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      await supabase
        .from("organization_claims")
        .update({
          status: "rejected",
          reviewed_by: sessionUser.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: "User already has active access to this organization.",
        })
        .eq("id", claimId);

      try {
        const [{ data: organization }, { data: requester }] = await Promise.all([
          supabase
            .from("organizations")
            .select("id, name, slug")
            .eq("id", claim.organization_id)
            .single(),
          supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("id", claim.requester_id)
            .single(),
        ]);

        if (organization && requester?.email) {
          const emailContent = getOrganizationClaimRejectedEmail({
            userName: requester.full_name,
            organizationName: organization.name,
            organizationId: organization.id,
            organizationSlug: organization.slug,
            reason: "User already has active access to this organization.",
          });

          await sendEmailWithPreferences({
            supabase,
            userId: claim.requester_id,
            templateKey: "organizationClaimRejected",
            payload: {
              to: requester.email,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            },
            notification: {
              type: "organization_claim",
              title: `Update on your claim for ${organization.name}`,
              message: "User already has active access to this organization.",
              link: "/dashboard/my-organizations",
            },
          });
        }
      } catch (emailError) {
        console.error("[OrganizationClaimApprove] Auto-reject email error:", emailError);
      }

      return NextResponse.json(
        { error: "User already has access. Claim auto-rejected." },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("organization_claims")
      .update({
        status: "approved",
        reviewed_by: sessionUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("[OrganizationClaimApprove] Update error:", updateError);
      return NextResponse.json({ error: "Failed to approve claim" }, { status: 500 });
    }

    const { error: grantError } = await supabase
      .from("organization_managers")
      .insert({
        organization_id: claim.organization_id,
        user_id: claim.requester_id,
        role: "owner",
        grant_method: "claim",
        created_by: sessionUser.id,
      });

    if (grantError) {
      console.error("[OrganizationClaimApprove] Grant error:", grantError);
      await supabase
        .from("organization_claims")
        .update({ status: "pending", reviewed_by: null, reviewed_at: null })
        .eq("id", claimId);
      return NextResponse.json({ error: "Failed to grant organization access" }, { status: 500 });
    }

    try {
      const [{ data: organization }, { data: requester }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, slug")
          .eq("id", claim.organization_id)
          .single(),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", claim.requester_id)
          .single(),
      ]);

      if (organization && requester?.email) {
        const emailContent = getOrganizationClaimApprovedEmail({
          userName: requester.full_name,
          organizationName: organization.name,
          organizationId: organization.id,
          organizationSlug: organization.slug,
          role: "owner",
        });

        await sendEmailWithPreferences({
          supabase,
          userId: claim.requester_id,
          templateKey: "organizationClaimApproved",
          payload: {
            to: requester.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          },
          notification: {
            type: "organization_claim",
            title: `You're now an owner of ${organization.name}`,
            message: "Your organization claim has been approved.",
            link: "/dashboard/my-organizations",
          },
        });
      }
    } catch (emailError) {
      console.error("[OrganizationClaimApprove] Approval email error:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Claim approved. User is now an organization owner.",
    });
  } catch (error) {
    console.error("[OrganizationClaimApprove] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
