import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { SITE_URL } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/mailer";
import { getOrganizationMemberTaggedEmail } from "@/lib/email/templates/organizationMemberTagged";
import type { OrganizationContentLinkType, OrganizationVisibility } from "@/lib/organizations";

const TABLE_NAME = "organizations";
const TAG_TABLE_NAME = "organization_member_tags";
const CONTENT_LINK_TABLE_NAME = "organization_content_links";

const CONTENT_LINK_TYPES: OrganizationContentLinkType[] = ["blog_post", "gallery_album", "event_series", "event"];

type MemberTagInput = {
  profile_id: string;
  sort_order: number;
  tag_reason: string | null;
};

type ContentLinkInput = {
  link_type: OrganizationContentLinkType;
  target_id: string;
  sort_order: number;
  label_override: string | null;
};

function isMissingSchemaError(error: unknown, schemaTokens: string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  const code = maybe.code || "";
  const message = (maybe.message || "").toLowerCase();

  if (code === "42P01" || code === "PGRST200" || code === "PGRST205") return true;
  if (!message) return false;
  if (!schemaTokens.some((token) => message.includes(token))) return false;

  return (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("relation") ||
    message.includes("column")
  );
}

function isMissingTagSchemaError(error: unknown): boolean {
  return isMissingSchemaError(error, ["organization_member_tags", "host_spotlight_reason"]);
}

function isMissingContentLinkSchemaError(error: unknown): boolean {
  return isMissingSchemaError(error, ["organization_content_links"]);
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

function normalizeContentLinkType(value: unknown): OrganizationContentLinkType | null {
  if (typeof value !== "string") return null;
  return (CONTENT_LINK_TYPES as string[]).includes(value) ? (value as OrganizationContentLinkType) : null;
}

function normalizeContentLinks(value: unknown): ContentLinkInput[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<string, ContentLinkInput>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const linkType = normalizeContentLinkType((item as Record<string, unknown>).link_type);
    const targetId = normalizeString((item as Record<string, unknown>).target_id);
    if (!linkType || !targetId) continue;

    const sortOrder = parseSortOrder((item as Record<string, unknown>).sort_order);
    const labelOverride = normalizeString((item as Record<string, unknown>).label_override);

    deduped.set(`${linkType}:${targetId}`, {
      link_type: linkType,
      target_id: targetId,
      sort_order: sortOrder,
      label_override: labelOverride,
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
): Promise<string[]> {
  const { data: existingRows, error: existingError } = await (serviceClient as any)
    .from(TAG_TABLE_NAME)
    .select("id, profile_id")
    .eq("organization_id", organizationId);

  if (existingError) {
    if (isMissingTagSchemaError(existingError)) return [];
    throw existingError;
  }

  const existing = (existingRows || []) as Array<{ id: string; profile_id: string }>;
  const existingProfileIds = new Set(existing.map((row) => row.profile_id));
  const addedProfileIds = memberTags
    .map((item) => item.profile_id)
    .filter((profileId) => !existingProfileIds.has(profileId));
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
      if (isMissingTagSchemaError(deleteError)) return [];
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
      if (isMissingTagSchemaError(upsertError)) return [];
      throw upsertError;
    }
  }

  return addedProfileIds;
}

async function syncOrganizationContentLinks(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  contentLinks: ContentLinkInput[],
  actorUserId: string
): Promise<void> {
  const { data: existingRows, error: existingError } = await (serviceClient as any)
    .from(CONTENT_LINK_TABLE_NAME)
    .select("id, link_type, target_id")
    .eq("organization_id", organizationId);

  if (existingError) {
    if (isMissingContentLinkSchemaError(existingError)) return;
    throw existingError;
  }

  const existing = (existingRows || []) as Array<{ id: string; link_type: string; target_id: string }>;
  const incomingKeys = new Set(contentLinks.map((item) => `${item.link_type}:${item.target_id}`));

  const deleteIds = existing
    .filter((row) => !incomingKeys.has(`${row.link_type}:${row.target_id}`))
    .map((row) => row.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } = await (serviceClient as any)
      .from(CONTENT_LINK_TABLE_NAME)
      .delete()
      .in("id", deleteIds);

    if (deleteError) {
      if (isMissingContentLinkSchemaError(deleteError)) return;
      throw deleteError;
    }
  }

  if (contentLinks.length > 0) {
    const upsertRows = contentLinks.map((link) => ({
      organization_id: organizationId,
      link_type: link.link_type,
      target_id: link.target_id,
      sort_order: link.sort_order,
      label_override: link.label_override,
      created_by: actorUserId,
    }));

    const { error: upsertError } = await (serviceClient as any)
      .from(CONTENT_LINK_TABLE_NAME)
      .upsert(upsertRows, { onConflict: "organization_id,link_type,target_id" });

    if (upsertError) {
      if (isMissingContentLinkSchemaError(upsertError)) return;
      throw upsertError;
    }
  }
}

async function listOrganizationsWithRelations(
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

  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
      )
      .in("organization_id", organizationIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (serviceClient as any)
      .from(CONTENT_LINK_TABLE_NAME)
      .select("id, organization_id, link_type, target_id, sort_order, label_override, created_at")
      .in("organization_id", organizationIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const { data: tagRows, error: tagError } = tagResult;
  const { data: contentLinkRows, error: contentLinkError } = contentLinkResult;

  if (tagError && !isMissingTagSchemaError(tagError)) {
    throw new Error(tagError.message);
  }
  if (contentLinkError && !isMissingContentLinkSchemaError(contentLinkError)) {
    throw new Error(contentLinkError.message);
  }

  const tagsByOrganization = new Map<string, Array<Record<string, unknown>>>();
  for (const row of ((tagRows || []) as Array<Record<string, unknown>>)) {
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

  const contentLinksByOrganization = new Map<string, Array<Record<string, unknown>>>();
  for (const row of ((contentLinkRows || []) as Array<Record<string, unknown>>)) {
    const organizationId = row.organization_id;
    if (typeof organizationId !== "string") continue;

    const linkType = normalizeContentLinkType(row.link_type);
    const targetId = normalizeString(row.target_id);
    if (!linkType || !targetId) continue;

    const normalizedLink: Record<string, unknown> = {
      id: row.id,
      organization_id: organizationId,
      link_type: linkType,
      target_id: targetId,
      sort_order: parseSortOrder(row.sort_order),
      label_override: normalizeString(row.label_override),
    };

    const list = contentLinksByOrganization.get(organizationId) || [];
    list.push(normalizedLink);
    contentLinksByOrganization.set(organizationId, list);
  }

  return organizations.map((organization) => {
    const organizationId = organization.id;
    const memberTags = typeof organizationId === "string" ? tagsByOrganization.get(organizationId) || [] : [];
    const contentLinks =
      typeof organizationId === "string" ? contentLinksByOrganization.get(organizationId) || [] : [];

    return {
      ...organization,
      member_tags: memberTags,
      content_links: contentLinks,
    };
  });
}

async function listMemberOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .select("id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Array<Record<string, unknown>>;
}

async function listBlogOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("blog_posts")
    .select("id, slug, title, is_published, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Array<Record<string, unknown>>;
}

async function listGalleryOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("gallery_albums")
    .select("id, slug, name, is_published, is_hidden, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Array<Record<string, unknown>>;
}

async function listEventOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("events")
    .select("id, series_id, title, slug, event_date, is_published, visibility")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data || []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: normalizeString(row.id) || "",
      title: normalizeString(row.title) || "Untitled event",
      slug: normalizeString(row.slug),
      series_id: normalizeString(row.series_id),
      event_date: normalizeString(row.event_date),
      is_published: row.is_published === true,
      visibility: normalizeString(row.visibility) || "private",
    }))
    .filter((row) => !!row.id)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function listContentOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const [blogs, galleries, events] = await Promise.all([
    listBlogOptions(serviceClient),
    listGalleryOptions(serviceClient),
    listEventOptions(serviceClient),
  ]);

  return { blogs, galleries, events };
}

async function listExistingProfileIds(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileIds: string[]
): Promise<Set<string>> {
  if (profileIds.length === 0) return new Set<string>();

  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .select("id")
    .in("id", profileIds);

  if (error) throw new Error(error.message);

  return new Set(
    ((data || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.id))
      .filter((id): id is string => !!id)
  );
}

async function collectInvalidContentLinksByExistence(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  contentLinks: ContentLinkInput[]
): Promise<ContentLinkInput[]> {
  if (contentLinks.length === 0) return [];

  const blogIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "blog_post")
        .map((link) => link.target_id)
    )
  );
  const galleryIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "gallery_album")
        .map((link) => link.target_id)
    )
  );
  const eventIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "event")
        .map((link) => link.target_id)
    )
  );
  const seriesIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "event_series")
        .map((link) => link.target_id)
    )
  );

  const [blogsResult, galleriesResult, eventsResult, seriesResult] = await Promise.all([
    blogIds.length > 0
      ? (serviceClient as any).from("blog_posts").select("id").in("id", blogIds)
      : Promise.resolve({ data: [], error: null }),
    galleryIds.length > 0
      ? (serviceClient as any).from("gallery_albums").select("id").in("id", galleryIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length > 0
      ? (serviceClient as any).from("events").select("id").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length > 0
      ? (serviceClient as any).from("events").select("series_id").in("series_id", seriesIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (blogsResult.error) throw new Error(blogsResult.error.message);
  if (galleriesResult.error) throw new Error(galleriesResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (seriesResult.error) throw new Error(seriesResult.error.message);

  const existingBlogIds = new Set(
    ((blogsResult.data || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.id))
      .filter((id): id is string => !!id)
  );
  const existingGalleryIds = new Set(
    ((galleriesResult.data || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.id))
      .filter((id): id is string => !!id)
  );
  const existingEventIds = new Set(
    ((eventsResult.data || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.id))
      .filter((id): id is string => !!id)
  );
  const existingSeriesIds = new Set(
    ((seriesResult.data || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.series_id))
      .filter((id): id is string => !!id)
  );

  return contentLinks.filter((link) => {
    if (link.link_type === "blog_post") return !existingBlogIds.has(link.target_id);
    if (link.link_type === "gallery_album") return !existingGalleryIds.has(link.target_id);
    if (link.link_type === "event") return !existingEventIds.has(link.target_id);
    if (link.link_type === "event_series") return !existingSeriesIds.has(link.target_id);
    return true;
  });
}

async function notifyTaggedMembersAdded(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  addedProfileIds: string[],
  actorUserId: string
) {
  if (addedProfileIds.length === 0) return;

  try {
    const [{ data: organization }, { data: actorProfile }, { data: taggedProfiles }] = await Promise.all([
      (serviceClient as any)
        .from(TABLE_NAME)
        .select("name")
        .eq("id", organizationId)
        .single(),
      (serviceClient as any)
        .from("profiles")
        .select("full_name, email")
        .eq("id", actorUserId)
        .maybeSingle(),
      (serviceClient as any)
        .from("profiles")
        .select("id, full_name, email")
        .in("id", addedProfileIds),
    ]);

    const organizationName = normalizeString(organization?.name);
    if (!organizationName) return;

    const actorName =
      normalizeString(actorProfile?.full_name) ||
      normalizeString(actorProfile?.email) ||
      "A CSC organization manager";

    const directoryUrl = `${SITE_URL}/friends-of-the-collective`;
    const removeTagUrl = `${SITE_URL}/organization-membership?organizationId=${encodeURIComponent(organizationId)}`;

    await Promise.allSettled(
      ((taggedProfiles || []) as Array<Record<string, unknown>>).map(async (profile) => {
        const profileId = normalizeString(profile.id);
        const to = normalizeString(profile.email);
        if (!profileId || !to || profileId === actorUserId) return;

        const emailContent = getOrganizationMemberTaggedEmail({
          recipientName: normalizeString(profile.full_name),
          organizationName,
          taggedByName: actorName,
          directoryUrl,
          removeTagUrl,
        });

        await sendEmail({
          to,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateName: "organizationMemberTagged",
        });
      })
    );
  } catch (error) {
    console.error("Organization member-tag notification failed:", error);
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceClient = createServiceRoleClient();
    const [organizations, memberOptions, contentOptions] = await Promise.all([
      listOrganizationsWithRelations(serviceClient),
      listMemberOptions(serviceClient),
      listContentOptions(serviceClient),
    ]);

    return NextResponse.json({ organizations, memberOptions, contentOptions });
  } catch (err) {
    console.error("Organizations GET crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const contentLinks = normalizeContentLinks(body.content_links);

    const serviceClient = createServiceRoleClient();

    if (memberTags.length > 0) {
      const existingProfileIds = await listExistingProfileIds(
        serviceClient,
        memberTags.map((tag) => tag.profile_id)
      );
      const missingProfileIds = Array.from(
        new Set(
          memberTags
            .map((tag) => tag.profile_id)
            .filter((profileId) => !existingProfileIds.has(profileId))
        )
      );
      if (missingProfileIds.length > 0) {
        return NextResponse.json(
          { error: "Some member tags reference unknown profiles.", missingProfileIds },
          { status: 400 }
        );
      }
    }

    if (contentLinks.length > 0) {
      const invalidLinks = await collectInvalidContentLinksByExistence(serviceClient, contentLinks);
      if (invalidLinks.length > 0) {
        return NextResponse.json(
          { error: "Some related content links reference missing content.", invalidLinks },
          { status: 400 }
        );
      }
    }

    const { data, error } = await (serviceClient as any).from(TABLE_NAME).insert(payload).select().single();

    if (error) {
      console.error("Organizations POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      let addedProfileIds: string[] = [];
      if (memberTags.length > 0) {
        addedProfileIds = await syncOrganizationMemberTags(serviceClient, data.id, memberTags, user.id);
      }
      if (contentLinks.length > 0) {
        await syncOrganizationContentLinks(serviceClient, data.id, contentLinks, user.id);
      }
      await notifyTaggedMembersAdded(serviceClient, data.id, addedProfileIds, user.id);
    } catch (syncError) {
      console.error("Organizations POST relation sync error:", syncError);
      await (serviceClient as any).from(TABLE_NAME).delete().eq("id", data.id);
      return NextResponse.json(
        { error: syncError instanceof Error ? syncError.message : "Failed to save organization links" },
        { status: 500 }
      );
    }

    const [created] = await listOrganizationsWithRelations(serviceClient, [data.id]);
    return NextResponse.json(created ?? data, { status: 201 });
  } catch (err) {
    console.error("Organizations POST crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
