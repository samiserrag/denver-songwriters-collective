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

function isMissingTagSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  const code = maybe.code || "";
  const message = (maybe.message || "").toLowerCase();

  if (code === "42P01" || code === "PGRST200" || code === "PGRST205") return true;
  if (!message) return false;
  if (!message.includes("organization_member_tags") && !message.includes("host_spotlight_reason")) {
    return false;
  }
  return (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("relation") ||
    message.includes("column")
  );
}

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

    const sortOrder = parseSortOrder((item as Record<string, unknown>).sort_order);
    const tagReason = normalizeString((item as Record<string, unknown>).tag_reason);

    deduped.set(profileId, {
      profile_id: profileId,
      sort_order: sortOrder,
      tag_reason: tagReason,
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

  if (existingError) {
    if (isMissingTagSchemaError(existingError)) return;
    throw existingError;
  }

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

    if (deleteError) {
      if (isMissingTagSchemaError(deleteError)) return;
      throw deleteError;
    }
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

    if (upsertError) {
      if (isMissingTagSchemaError(upsertError)) return;
      throw upsertError;
    }
  }
}

async function listOrganizationsWithTags(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  ids?: string[]
) {
  let orgQuery = (serviceClient as any)
    .from(TABLE_NAME)
    .select("*")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (ids && ids.length > 0) {
    orgQuery = orgQuery.in("id", ids);
  }

  const { data: orgRows, error: orgError } = await orgQuery;
  if (orgError) {
    throw new Error(orgError.message);
  }

  const organizations = (orgRows || []) as Array<Record<string, unknown>>;
  const organizationIds = organizations
    .map((row) => row.id)
    .filter((value): value is string => typeof value === "string");

  if (organizationIds.length === 0) {
    return organizations;
  }

  const { data: tagRows, error: tagError } = await (serviceClient as any)
    .from(TAG_TABLE_NAME)
    .select(
      "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
    )
    .in("organization_id", organizationIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (tagError) {
    if (isMissingTagSchemaError(tagError)) {
      return organizations.map((organization) => ({
        ...organization,
        member_tags: [],
      }));
    }
    throw new Error(tagError.message);
  }

  const tagsByOrganization = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (tagRows || []) as Array<Record<string, unknown>>) {
    const organizationId = row.organization_id;
    if (typeof organizationId !== "string") continue;

    const profile = normalizeProfileRelation(row.profiles);
    if (!profile) continue;

    const normalizedTag: Record<string, unknown> = {
      id: row.id,
      organization_id: organizationId,
      profile_id: row.profile_id,
      sort_order: row.sort_order,
      tag_reason: row.tag_reason,
      profile,
    };

    const list = tagsByOrganization.get(organizationId) || [];
    list.push(normalizedTag);
    tagsByOrganization.set(organizationId, list);
  }

  return organizations.map((organization) => {
    const organizationId = organization.id;
    const memberTags =
      typeof organizationId === "string"
        ? tagsByOrganization.get(organizationId) || []
        : [];

    return {
      ...organization,
      member_tags: memberTags,
    };
  });
}

async function listMemberOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .select("id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan")
    .not("full_name", "is", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Array<Record<string, unknown>>;
}

// GET all organizations
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceClient = createServiceRoleClient();
    const [organizations, memberOptions] = await Promise.all([
      listOrganizationsWithTags(serviceClient),
      listMemberOptions(serviceClient),
    ]);

    return NextResponse.json({ organizations, memberOptions });
  } catch (err) {
    console.error("Organizations GET crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create organization
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const slug = normalizeString(body.slug);
    const name = normalizeString(body.name);
    const websiteUrl = normalizeString(body.website_url);
    const shortBlurb = normalizeString(body.short_blurb);
    const whyItMatters = normalizeString(body.why_it_matters);

    if (!slug || !name || !websiteUrl || !shortBlurb || !whyItMatters) {
      return NextResponse.json(
        { error: "Missing required fields: slug, name, website_url, short_blurb, why_it_matters" },
        { status: 400 }
      );
    }

    const payload = {
      slug,
      name,
      website_url: websiteUrl,
      city: normalizeString(body.city),
      organization_type: normalizeString(body.organization_type),
      short_blurb: shortBlurb,
      why_it_matters: whyItMatters,
      tags: normalizeStringArray(body.tags),
      featured: body.featured === true,
      is_active: body.is_active !== false,
      visibility: normalizeVisibility(body.visibility),
      logo_image_url: normalizeString(body.logo_image_url),
      cover_image_url: normalizeString(body.cover_image_url),
      gallery_image_urls: normalizeStringArray(body.gallery_image_urls),
      fun_note: normalizeString(body.fun_note),
      sort_order: parseSortOrder(body.sort_order),
      created_by: user.id,
    };

    const memberTags = normalizeMemberTags(body.member_tags);

    const serviceClient = createServiceRoleClient();
    const { data, error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Organizations POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      if (memberTags.length > 0) {
        await syncOrganizationMemberTags(serviceClient, data.id, memberTags, user.id);
      }
    } catch (syncError) {
      console.error("Organizations POST member tag sync error:", syncError);
      await (serviceClient as any).from(TABLE_NAME).delete().eq("id", data.id);
      return NextResponse.json(
        { error: syncError instanceof Error ? syncError.message : "Failed to save member tags" },
        { status: 500 }
      );
    }

    const [created] = await listOrganizationsWithTags(serviceClient, [data.id]);
    return NextResponse.json(created ?? data, { status: 201 });
  } catch (err) {
    console.error("Organizations POST crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
