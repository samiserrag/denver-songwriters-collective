import type { CollectiveFriend, CollectiveFriendMemberTag } from "@/lib/friends-of-the-collective";

export type OrganizationVisibility = "private" | "unlisted" | "public";

export interface OrganizationRecord {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  city: string | null;
  organization_type: string | null;
  short_blurb: string;
  why_it_matters: string;
  tags: string[] | null;
  featured: boolean;
  is_active: boolean;
  visibility: OrganizationVisibility;
  logo_image_url: string | null;
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  fun_note: string | null;
  sort_order: number;
  member_tags?: OrganizationMemberTagRecord[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationMemberTagRecord {
  id: string;
  organization_id: string;
  profile_id: string;
  sort_order: number;
  tag_reason: string | null;
  profile?: OrganizationMemberTagProfile | null;
}

export interface OrganizationMemberTagProfile {
  id: string;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_public?: boolean | null;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
}

function buildProfileHref(profile: OrganizationMemberTagProfile): string {
  const identifier = profile.slug || profile.id;
  if (profile.is_studio || profile.role === "studio") return `/studios/${identifier}`;
  if (profile.is_songwriter || profile.is_host || profile.role === "performer" || profile.role === "host") {
    return `/songwriters/${identifier}`;
  }
  return `/members/${identifier}`;
}

function mapMemberTags(tags: OrganizationMemberTagRecord[] | null | undefined): CollectiveFriendMemberTag[] {
  if (!tags || tags.length === 0) return [];
  return tags
    .filter((tag) => tag.profile)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((tag) => {
      const profile = tag.profile as OrganizationMemberTagProfile;
      return {
        profileId: profile.id,
        name: profile.full_name || "Member",
        avatarUrl: profile.avatar_url ?? undefined,
        profileUrl: buildProfileHref(profile),
        sortOrder: tag.sort_order ?? 0,
        tagReason: tag.tag_reason ?? undefined,
      };
    });
}

export function toFriendView(row: OrganizationRecord): CollectiveFriend {
  return {
    id: row.slug,
    name: row.name,
    websiteUrl: row.website_url,
    city: row.city ?? undefined,
    organizationType: row.organization_type ?? undefined,
    shortBlurb: row.short_blurb,
    whyItMatters: row.why_it_matters,
    tags: row.tags ?? [],
    featured: row.featured,
    isActive: row.is_active,
    logoImageUrl: row.logo_image_url ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    funNote: row.fun_note ?? undefined,
    sortOrder: row.sort_order,
    slug: row.slug,
    memberTags: mapMemberTags(row.member_tags),
  };
}

export function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifyTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return "";
  return tags.join(", ");
}

export function parseGalleryInput(input: string): string[] {
  return input
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function stringifyGallery(urls: string[] | null | undefined): string {
  if (!urls || urls.length === 0) return "";
  return urls.join("\n");
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
