import type { CollectiveFriend } from "@/lib/friends-of-the-collective";

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
  created_at?: string;
  updated_at?: string;
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

