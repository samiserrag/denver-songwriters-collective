import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

const TAG_TABLE_NAME = "organization_member_tags";
const ORG_TABLE_NAME = "organizations";

function normalizeOrganizationId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

async function loadMembership(organizationId: string, userId: string) {
  const serviceClient = createServiceRoleClient();

  const [{ data: organization, error: orgError }, { data: membership, error: membershipError }] =
    await Promise.all([
      (serviceClient as any)
        .from(ORG_TABLE_NAME)
        .select("id, name, slug")
        .eq("id", organizationId)
        .maybeSingle(),
      (serviceClient as any)
        .from(TAG_TABLE_NAME)
        .select("id, organization_id, profile_id, sort_order, tag_reason")
        .eq("organization_id", organizationId)
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);

  if (orgError) throw orgError;
  if (membershipError) throw membershipError;

  return { serviceClient, organization, membership };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const organizationId = normalizeOrganizationId(
      request.nextUrl.searchParams.get("organizationId")
    );
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const { organization, membership } = await loadMembership(organizationId, auth.user.id);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      organization,
      isTagged: !!membership,
      membership: membership || null,
    });
  } catch (error) {
    console.error("[OrganizationMembership] GET unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("error" in auth) return auth.error;

    const organizationId = normalizeOrganizationId(
      request.nextUrl.searchParams.get("organizationId")
    );
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const { serviceClient, organization, membership } = await loadMembership(
      organizationId,
      auth.user.id
    );
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    if (!membership?.id) {
      return NextResponse.json(
        { error: "You are not currently tagged on this organization." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .delete()
      .eq("id", membership.id)
      .eq("profile_id", auth.user.id);

    if (deleteError) {
      console.error("[OrganizationMembership] DELETE remove tag error:", deleteError);
      return NextResponse.json({ error: "Failed to remove your member tag" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      organization,
      message: "You have been removed from this organization profile.",
    });
  } catch (error) {
    console.error("[OrganizationMembership] DELETE unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
