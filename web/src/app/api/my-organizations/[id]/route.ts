import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

const MANAGER_EDITABLE_FIELDS = [
  "name",
  "website_url",
  "city",
  "organization_type",
  "short_blurb",
  "why_it_matters",
  "tags",
  "logo_image_url",
  "cover_image_url",
  "gallery_image_urls",
  "fun_note",
] as const;

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeOrganizationPatch(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const key of MANAGER_EDITABLE_FIELDS) {
    if (!(key in body)) continue;
    if (key === "tags" || key === "gallery_image_urls") {
      updates[key] = normalizeStringArray(body[key]);
    } else {
      updates[key] = normalizeString(body[key]);
    }
  }
  return updates;
}

async function getActiveGrant(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, organizationId: string, userId: string) {
  const { data } = await supabase
    .from("organization_managers")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [grant, isAdmin] = await Promise.all([
      getActiveGrant(supabase, organizationId, user.id),
      checkAdminRole(supabase, user.id),
    ]);

    if (!grant && !isAdmin) {
      return NextResponse.json({ error: "You do not have permission to edit this organization" }, { status: 403 });
    }

    const body = await request.json();
    const updates = sanitizeOrganizationPatch(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No editable organization fields provided" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", organizationId)
      .select("*")
      .single();

    if (updateError) {
      console.error("[MyOrganizations] PATCH update error:", updateError);
      return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      organization: updated,
      updatedFields: Object.keys(updates),
    });
  } catch (error) {
    console.error("[MyOrganizations] PATCH unexpected error:", error);
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
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const grant = await getActiveGrant(supabase, organizationId, user.id);
    if (!grant) {
      return NextResponse.json(
        { error: "You don't have access to this organization" },
        { status: 404 }
      );
    }

    if (grant.role === "owner") {
      const { count } = await supabase
        .from("organization_managers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("role", "owner")
        .is("revoked_at", null);

      if (count === 1) {
        return NextResponse.json(
          {
            error:
              "You are the only owner of this organization. Transfer ownership or contact an admin to relinquish access.",
          },
          { status: 400 }
        );
      }
    }

    const { error: revokeError } = await supabase
      .from("organization_managers")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoked_reason: "User relinquished access",
      })
      .eq("id", grant.id);

    if (revokeError) {
      console.error("[MyOrganizations] DELETE revoke error:", revokeError);
      return NextResponse.json({ error: "Failed to relinquish access" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "You no longer have access to this organization",
    });
  } catch (error) {
    console.error("[MyOrganizations] DELETE unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
