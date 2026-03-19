import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { SITE_URL } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/mailer";
import { getOrganizationMemberTaggedEmail } from "@/lib/email/templates/organizationMemberTagged";
import type { OrganizationContentLinkType } from "@/lib/organizations";

const TABLE_NAME = "organizations";
const TAG_TABLE_NAME = "organization_member_tags";
const CONTENT_LINK_TABLE_NAME = "organization_content_links";

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

const CONTENT_LINK_TYPES: OrganizationContentLinkType[] = ["blog_post", "gallery_album", "event_series", "event"];

type ManagerRole = "owner" | "manager";

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

type BlogOption = {
  id: string;
  slug: string | null;
  title: string | null;
  is_published: boolean;
  published_at: string | null;
  author_id: string | null;
};

type GalleryOption = {
  id: string;
  slug: string | null;
  name: string | null;
  is_published: boolean;
  is_hidden: boolean;
  created_by: string | null;
  created_at: string | null;
};

type EventOption = {
  id: string;
  slug: string | null;
  title: string;
  event_date: string | null;
  is_published: boolean;
  visibility: string;
  series_id: string | null;
};

type EventSeriesOption = {
  series_id: string;
  title: string;
  slug: string | null;
  event_id: string;
  event_date: string | null;
  is_published: boolean;
  visibility: string;
};

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

function parseSortOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

    deduped.set(`${linkType}:${targetId}`, {
      link_type: linkType,
      target_id: targetId,
      sort_order: parseSortOrder((item as Record<string, unknown>).sort_order),
      label_override: normalizeString((item as Record<string, unknown>).label_override),
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

async function getActiveGrant(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  userId: string
) {
  const { data } = await supabase
    .from("organization_managers")
    .select("id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return data;
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

  if (existingError) throw existingError;

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
    if (deleteError) throw deleteError;
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

    if (upsertError) throw upsertError;
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

  if (existingError) throw existingError;

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
    if (deleteError) throw deleteError;
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

    if (upsertError) throw upsertError;
  }
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

async function fetchOrganizationWithRelations(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  organizationId: string
) {
  const { data: organization, error: organizationError } = await (serviceClient as any)
    .from(TABLE_NAME)
    .select("*")
    .eq("id", organizationId)
    .single();

  if (organizationError) throw organizationError;

  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles!organization_member_tags_profile_id_fkey(id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
      )
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (serviceClient as any)
      .from(CONTENT_LINK_TABLE_NAME)
      .select("id, organization_id, link_type, target_id, sort_order, label_override, created_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (tagResult.error) throw tagResult.error;
  if (contentLinkResult.error) throw contentLinkResult.error;

  const memberTags = ((tagResult.data || []) as Array<Record<string, unknown>>)
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

  const contentLinks = ((contentLinkResult.data || []) as Array<Record<string, unknown>>)
    .map((row) => {
      const linkType = normalizeContentLinkType(row.link_type);
      const targetId = normalizeString(row.target_id);
      if (!linkType || !targetId) return null;
      return {
        id: row.id,
        organization_id: row.organization_id,
        link_type: linkType,
        target_id: targetId,
        sort_order: parseSortOrder(row.sort_order),
        label_override: normalizeString(row.label_override),
      };
    })
    .filter(Boolean);

  return {
    ...(organization as Record<string, unknown>),
    member_tags: memberTags,
    content_links: contentLinks,
  };
}

async function listMemberOptions(serviceClient: ReturnType<typeof createServiceRoleClient>) {
  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .select("id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data || []) as Array<Record<string, unknown>>;
}

async function listBlogOptionsForProfiles(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileIds: string[] | null
): Promise<BlogOption[]> {
  let query = (serviceClient as any)
    .from("blog_posts")
    .select("id, slug, title, is_published, published_at, author_id")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (Array.isArray(profileIds)) {
    if (profileIds.length === 0) return [];
    query = query.in("author_id", profileIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BlogOption[];
}

async function listGalleryOptionsForProfiles(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileIds: string[] | null
): Promise<GalleryOption[]> {
  let query = (serviceClient as any)
    .from("gallery_albums")
    .select("id, slug, name, is_published, is_hidden, created_by, created_at")
    .order("created_at", { ascending: false });

  if (Array.isArray(profileIds)) {
    if (profileIds.length === 0) return [];
    query = query.in("created_by", profileIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GalleryOption[];
}

async function listEventOptionsForProfiles(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileIds: string[] | null
): Promise<EventOption[]> {
  if (profileIds === null) {
    const { data, error } = await (serviceClient as any)
      .from("events")
      .select("id, slug, title, event_date, is_published, visibility, series_id")
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: normalizeString(row.id) || "",
      slug: normalizeString(row.slug),
      title: normalizeString(row.title) || "Untitled event",
      event_date: normalizeString(row.event_date),
      is_published: row.is_published === true,
      visibility: normalizeString(row.visibility) || "private",
      series_id: normalizeString(row.series_id),
    })).filter((row) => !!row.id);
  }

  if (profileIds.length === 0) return [];

  const [{ data: primaryEvents, error: primaryError }, { data: cohostRows, error: cohostError }] = await Promise.all([
    (serviceClient as any)
      .from("events")
      .select("id")
      .in("host_id", profileIds),
    (serviceClient as any)
      .from("event_hosts")
      .select("event_id")
      .in("user_id", profileIds)
      .eq("invitation_status", "accepted"),
  ]);

  if (primaryError) throw primaryError;
  if (cohostError) throw cohostError;

  const eventIds = Array.from(
    new Set([
      ...((primaryEvents || []) as Array<Record<string, unknown>>) .map((row) => normalizeString(row.id)).filter((id): id is string => !!id),
      ...((cohostRows || []) as Array<Record<string, unknown>>) .map((row) => normalizeString(row.event_id)).filter((id): id is string => !!id),
    ])
  );

  if (eventIds.length === 0) return [];

  const { data, error } = await (serviceClient as any)
    .from("events")
    .select("id, slug, title, event_date, is_published, visibility, series_id")
    .in("id", eventIds)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: normalizeString(row.id) || "",
    slug: normalizeString(row.slug),
    title: normalizeString(row.title) || "Untitled event",
    event_date: normalizeString(row.event_date),
    is_published: row.is_published === true,
    visibility: normalizeString(row.visibility) || "private",
    series_id: normalizeString(row.series_id),
  })).filter((row) => !!row.id);
}

function toSeriesOptions(events: EventOption[]): EventSeriesOption[] {
  const bySeries = new Map<string, EventSeriesOption>();

  for (const event of events) {
    if (!event.series_id) continue;
    if (bySeries.has(event.series_id)) continue;

    bySeries.set(event.series_id, {
      series_id: event.series_id,
      title: event.title,
      slug: event.slug,
      event_id: event.id,
      event_date: event.event_date,
      is_published: event.is_published,
      visibility: event.visibility,
    });
  }

  return Array.from(bySeries.values()).sort((a, b) => a.title.localeCompare(b.title));
}

async function listContentOptionsForProfiles(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileIds: string[] | null
) {
  const [blogs, galleries, events] = await Promise.all([
    listBlogOptionsForProfiles(serviceClient, profileIds),
    listGalleryOptionsForProfiles(serviceClient, profileIds),
    listEventOptionsForProfiles(serviceClient, profileIds),
  ]);

  const eventSeries = toSeriesOptions(events);
  return { blogs, galleries, events, eventSeries };
}

function collectInvalidManagerContentLinks(contentLinks: ContentLinkInput[], allowedContent: {
  blogs: BlogOption[];
  galleries: GalleryOption[];
  events: EventOption[];
  eventSeries: EventSeriesOption[];
}) {
  const allowedBlogs = new Set(allowedContent.blogs.map((row) => row.id));
  const allowedGalleries = new Set(allowedContent.galleries.map((row) => row.id));
  const allowedEvents = new Set(allowedContent.events.map((row) => row.id));
  const allowedSeries = new Set(allowedContent.eventSeries.map((row) => row.series_id));

  return contentLinks.filter((link) => {
    if (link.link_type === "blog_post") return !allowedBlogs.has(link.target_id);
    if (link.link_type === "gallery_album") return !allowedGalleries.has(link.target_id);
    if (link.link_type === "event") return !allowedEvents.has(link.target_id);
    if (link.link_type === "event_series") return !allowedSeries.has(link.target_id);
    return true;
  });
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

  if (error) throw error;

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

  if (blogsResult.error) throw blogsResult.error;
  if (galleriesResult.error) throw galleriesResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (seriesResult.error) throw seriesResult.error;

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

export async function GET(
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
      return NextResponse.json({ error: "You do not have permission to view this organization" }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient();
    const organization = await fetchOrganizationWithRelations(serviceClient, organizationId);

    const taggedProfileIds = ((organization.member_tags || []) as Array<Record<string, unknown>>)
      .map((row) => normalizeString(row.profile_id))
      .filter((id): id is string => !!id);

    const [memberOptions, contentOptions] = await Promise.all([
      listMemberOptions(serviceClient),
      listContentOptionsForProfiles(serviceClient, isAdmin ? null : taggedProfileIds),
    ]);

    return NextResponse.json({
      organization,
      memberOptions,
      contentOptions,
      isAdmin,
      managerRole: (grant?.role === "owner" ? "owner" : grant?.role === "manager" ? "manager" : null) as ManagerRole | null,
    });
  } catch (error) {
    console.error("[MyOrganizations] GET unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
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
    const memberTagsProvided = body.member_tags !== undefined;
    const contentLinksProvided = body.content_links !== undefined;
    const memberTags = memberTagsProvided ? normalizeMemberTags(body.member_tags) : [];
    const contentLinks = contentLinksProvided ? normalizeContentLinks(body.content_links) : [];

    if (Object.keys(updates).length === 0 && !memberTagsProvided && !contentLinksProvided) {
      return NextResponse.json(
        { error: "No editable organization fields provided" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    if (memberTagsProvided && memberTags.length > 0) {
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

    if (contentLinksProvided && contentLinks.length > 0) {
      const invalidByExistence = await collectInvalidContentLinksByExistence(serviceClient, contentLinks);
      if (invalidByExistence.length > 0) {
        return NextResponse.json(
          { error: "Some related content links reference missing content.", invalidLinks: invalidByExistence },
          { status: 400 }
        );
      }
    }

    let effectiveTaggedProfileIds: string[];

    if (memberTagsProvided) {
      try {
        const addedProfileIds = await syncOrganizationMemberTags(serviceClient, organizationId, memberTags, user.id);
        await notifyTaggedMembersAdded(serviceClient, organizationId, addedProfileIds, user.id);
      } catch (memberTagError) {
        console.error("[MyOrganizations] PATCH member tag sync error:", memberTagError);
        return NextResponse.json({ error: "Failed to save tagged members" }, { status: 500 });
      }

      effectiveTaggedProfileIds = memberTags.map((tag) => tag.profile_id);
    } else {
      const { data: tagRows, error: tagError } = await (serviceClient as any)
        .from(TAG_TABLE_NAME)
        .select("profile_id")
        .eq("organization_id", organizationId);

      if (tagError) {
        console.error("[MyOrganizations] PATCH existing tags query error:", tagError);
        return NextResponse.json({ error: "Failed to validate tagged members" }, { status: 500 });
      }

      effectiveTaggedProfileIds = ((tagRows || []) as Array<Record<string, unknown>>)
        .map((row) => normalizeString(row.profile_id))
        .filter((id): id is string => !!id);
    }

    if (contentLinksProvided) {
      if (!isAdmin) {
        const allowedContent = await listContentOptionsForProfiles(serviceClient, effectiveTaggedProfileIds);
        const invalidLinks = collectInvalidManagerContentLinks(contentLinks, allowedContent);

        if (invalidLinks.length > 0) {
          return NextResponse.json(
            {
              error:
                "Managers can only link blogs, galleries, and events tied to members tagged on this organization.",
              invalidLinks,
            },
            { status: 403 }
          );
        }
      }

      try {
        await syncOrganizationContentLinks(serviceClient, organizationId, contentLinks, user.id);
      } catch (contentLinkError) {
        console.error("[MyOrganizations] PATCH content link sync error:", contentLinkError);
        return NextResponse.json({ error: "Failed to save related content links" }, { status: 500 });
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (serviceClient as any)
        .from(TABLE_NAME)
        .update(updates)
        .eq("id", organizationId);

      if (updateError) {
        console.error("[MyOrganizations] PATCH update error:", updateError);
        return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
      }
    }

    const organization = await fetchOrganizationWithRelations(serviceClient, organizationId);

    return NextResponse.json({
      success: true,
      organization,
      updatedFields: Object.keys(updates),
      memberTagsProvided,
      contentLinksProvided,
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
