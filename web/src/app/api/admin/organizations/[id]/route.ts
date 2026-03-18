import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import type { OrganizationVisibility } from "@/lib/organizations";

const TABLE_NAME = "organizations";
const TAG_TABLE_NAME = "organization_member_tags";

type MemberTagInput = {
  profile_id: string;
  sort_order: number;
  tag_reason: string | null;
};

function normalizeVisibility(value: unknown): OrganizationVisibility {
  if (value === "private" || value === "unlisted" || value === "public") return value;
  return "unlisted";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSortOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMemberTags(value: unknown): MemberTagInput[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<string, MemberTagInput>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const profileId = normalizeString((item as Record<string, unknown>).profile_id);
    if (!profileId) continue;

    deduped.set(profileId, {
      profile_id: profileId,
      sort_order: parseSortOrder((item as Record<string, unknown>).sort_order),
      tag_reason: normalizeString((item as Record<string, unknown>).tag_reason),
    });
  }

  return Array.from(deduped.values()).sort((a, b) => a.sort_order - b.sort_order);
}

function normalizeProfileRelation(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== "object") return null;
    return first as Record<string, unknown>;
  }
  if (typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function syncOrganizationMemberTags(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  memberTags: MemberTagInput[],
  actorUserId: string
): Promise<void> {
  const { data: existingRows, error: existingError } = await (serviceClient as any)
    .from(TAG_TABLE_NAME)
    .select("id, profile_id")
    .eq("organization_id", organizationId);

  if (existingError) throw new Error(existingError.message);

  const existing = (existingRows || []) as Array<{ id: string; profile_id: string }>;
  const incomingIds = new Set(memberTags.map((item) => item.profile_id));

  const deleteIds = existing
    .filter((row) => !incomingIds.has(row.profile_id))
    .map((row) => row.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .delete()
      .in("id", deleteIds);

    if (deleteError) throw new Error(deleteError.message);
  }

  if (memberTags.length > 0) {
    const upsertRows = memberTags.map((tag) => ({
      organization_id: organizationId,
      profile_id: tag.profile_id,
      sort_order: tag.sort_order,
      tag_reason: tag.tag_reason,
      created_by: actorUserId,
    }));

    const { error: upsertError } = await (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .upsert(upsertRows, { onConflict: "organization_id,profile_id" });

    if (upsertError) throw new Error(upsertError.message);
  }
}

async function fetchOrganizationWithTags(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  id: string
) {
  const { data: organization, error: organizationError } = await (serviceClient as any)
    .from(TABLE_NAME)
    .select("*")
    .eq("id", id)
    .single();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  const { data: tagRows, error: tagError } = await (serviceClient as any)
    .from(TAG_TABLE_NAME)
    .select(
      "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
    )
    .eq("organization_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (tagError) {
    throw new Error(tagError.message);
  }

  const memberTags = ((tagRows || []) as Array<Record<string, unknown>>)
    .map((row) => {
      const profile = normalizeProfileRelation(row.profiles);
      if (!profile) return null;
      return {
        id: row.id,
        organization_id: row.organization_id,
        profile_id: row.profile_id,
        sort_order: row.sort_order,
        tag_reason: row.tag_reason,
        profile,
      };
    })
    .filter(Boolean);

  return {
    ...(organization as Record<string, unknown>),
    member_tags: memberTags,
  };
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const serviceClient = createServiceRoleClient();
    const organization = await fetchOrganizationWithTags(serviceClient, id);

    return NextResponse.json(organization);
  } catch (err) {
    console.error("Organizations item GET crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.slug !== undefined) updates.slug = normalizeString(body.slug);
    if (body.name !== undefined) updates.name = normalizeString(body.name);
    if (body.website_url !== undefined) updates.website_url = normalizeString(body.website_url);
    if (body.city !== undefined) updates.city = normalizeString(body.city);
    if (body.organization_type !== undefined) updates.organization_type = normalizeString(body.organization_type);
    if (body.short_blurb !== undefined) updates.short_blurb = normalizeString(body.short_blurb);
    if (body.why_it_matters !== undefined) updates.why_it_matters = normalizeString(body.why_it_matters);
    if (body.tags !== undefined) updates.tags = normalizeStringArray(body.tags);
    if (body.featured !== undefined) updates.featured = body.featured === true;
    if (body.is_active !== undefined) updates.is_active = body.is_active === true;
    if (body.visibility !== undefined) updates.visibility = normalizeVisibility(body.visibility);
    if (body.logo_image_url !== undefined) updates.logo_image_url = normalizeString(body.logo_image_url);
    if (body.cover_image_url !== undefined) updates.cover_image_url = normalizeString(body.cover_image_url);
    if (body.gallery_image_urls !== undefined) updates.gallery_image_urls = normalizeStringArray(body.gallery_image_urls);
    if (body.fun_note !== undefined) updates.fun_note = normalizeString(body.fun_note);
    if (body.sort_order !== undefined) updates.sort_order = parseSortOrder(body.sort_order);

    const memberTagsProvided = body.member_tags !== undefined;
    const memberTags = memberTagsProvided ? normalizeMemberTags(body.member_tags) : [];

    if (Object.keys(updates).length === 0 && !memberTagsProvided) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (serviceClient as any)
        .from(TABLE_NAME)
        .update(updates)
        .eq("id", id);

      if (updateError) {
        console.error("Organizations PATCH update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (memberTagsProvided) {
      try {
        await syncOrganizationMemberTags(serviceClient, id, memberTags, auth.user.id);
      } catch (syncError) {
        console.error("Organizations PATCH member tag sync error:", syncError);
        return NextResponse.json(
          { error: syncError instanceof Error ? syncError.message : "Failed to save member tags" },
          { status: 500 }
        );
      }
    }

    const organization = await fetchOrganizationWithTags(serviceClient, id);
    return NextResponse.json(organization);
  } catch (err) {
    console.error("Organizations PATCH crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const serviceClient = createServiceRoleClient();
    const { error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Organizations DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Organizations DELETE crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
