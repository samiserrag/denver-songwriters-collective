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

  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from(TAG_TABLE_NAME)
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, full_name, slug, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
      )
      .eq("organization_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (serviceClient as any)
      .from(CONTENT_LINK_TABLE_NAME)
      .select("id, organization_id, link_type, target_id, sort_order, label_override, created_at")
      .eq("organization_id", id)
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

  const contentLinks = ((contentLinkRows || []) as Array<Record<string, unknown>>)
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

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    const organization = await fetchOrganizationWithRelations(serviceClient, id);

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
    const contentLinksProvided = body.content_links !== undefined;
    const memberTags = memberTagsProvided ? normalizeMemberTags(body.member_tags) : [];
    const contentLinks = contentLinksProvided ? normalizeContentLinks(body.content_links) : [];

    if (Object.keys(updates).length === 0 && !memberTagsProvided && !contentLinksProvided) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
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
      const invalidLinks = await collectInvalidContentLinksByExistence(serviceClient, contentLinks);
      if (invalidLinks.length > 0) {
        return NextResponse.json(
          { error: "Some related content links reference missing content.", invalidLinks },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (serviceClient as any).from(TABLE_NAME).update(updates).eq("id", id);

      if (updateError) {
        console.error("Organizations PATCH update error:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (memberTagsProvided) {
      try {
        const addedProfileIds = await syncOrganizationMemberTags(serviceClient, id, memberTags, auth.user.id);
        await notifyTaggedMembersAdded(serviceClient, id, addedProfileIds, auth.user.id);
      } catch (syncError) {
        console.error("Organizations PATCH member tag sync error:", syncError);
        return NextResponse.json(
          { error: syncError instanceof Error ? syncError.message : "Failed to save member tags" },
          { status: 500 }
        );
      }
    }

    if (contentLinksProvided) {
      try {
        await syncOrganizationContentLinks(serviceClient, id, contentLinks, auth.user.id);
      } catch (syncError) {
        console.error("Organizations PATCH content link sync error:", syncError);
        return NextResponse.json(
          { error: syncError instanceof Error ? syncError.message : "Failed to save content links" },
          { status: 500 }
        );
      }
    }

    const organization = await fetchOrganizationWithRelations(serviceClient, id);
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
    const { error } = await (serviceClient as any).from(TABLE_NAME).delete().eq("id", id);

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
