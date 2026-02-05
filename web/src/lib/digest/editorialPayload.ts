import { isUUID, normalizeEditorialRef, normalizeEditorialRefs } from "./digestEditorial";

export interface EditorialPayloadError {
  error: "Invalid UUID" | "Invalid reference";
  field: string;
  guidance: string;
  index?: number;
}

export interface EditorialPayloadResult {
  data: Record<string, unknown>;
  error?: EditorialPayloadError;
}

export function buildEditorialUpsertData(
  editorialData: Record<string, unknown>
): EditorialPayloadResult {
  const {
    subject_override,
    intro_note,
    featured_happening_ids,
    member_spotlight_id,
    venue_spotlight_id,
    blog_feature_slug,
    gallery_feature_slug,
    member_spotlight_ref,
    venue_spotlight_ref,
    blog_feature_ref,
    gallery_feature_ref,
    featured_happenings_refs,
  } = editorialData;

  const invalidUuid = (field: string, guidance: string): EditorialPayloadResult => ({
    data: {},
    error: {
      error: "Invalid UUID",
      field,
      guidance,
    },
  });

  if (
    typeof member_spotlight_id === "string" &&
    member_spotlight_id.trim() &&
    !isUUID(member_spotlight_id.trim())
  ) {
    return invalidUuid(
      "member_spotlight_id",
      "Paste a UUID for now, or use member_spotlight_ref for slug/URL inputs."
    );
  }

  if (
    typeof venue_spotlight_id === "string" &&
    venue_spotlight_id.trim() &&
    !isUUID(venue_spotlight_id.trim())
  ) {
    return invalidUuid(
      "venue_spotlight_id",
      "Paste a UUID for now, or use venue_spotlight_ref for slug/URL inputs."
    );
  }

  if (typeof featured_happening_ids !== "undefined") {
    if (!Array.isArray(featured_happening_ids)) {
      return invalidUuid(
        "featured_happening_ids",
        "Use an array of UUIDs, or use featured_happenings_refs for slug/URL inputs."
      );
    }
    for (const id of featured_happening_ids as unknown[]) {
      if (typeof id !== "string" || !isUUID(id)) {
        return invalidUuid(
          "featured_happening_ids",
          "Use an array of UUIDs, or use featured_happenings_refs for slug/URL inputs."
        );
      }
    }
  }

  const normalizedData: Record<string, unknown> = {};

  if (typeof subject_override === "string") normalizedData.subject_override = subject_override;
  if (typeof intro_note === "string") normalizedData.intro_note = intro_note;
  if (typeof featured_happening_ids !== "undefined") {
    normalizedData.featured_happening_ids = featured_happening_ids;
  }

  const normalizeRef = (
    field: string,
    value: string | null | undefined,
    guidance: string
  ): EditorialPayloadResult | { value: string | null } => {
    const result = normalizeEditorialRef(value);
    if (result.error) {
      return {
        data: {},
        error: {
          error: "Invalid reference",
          field,
          guidance,
        },
      };
    }
    return { value: result.value };
  };

  const normalizeRefs = (
    field: string,
    value: string[] | null | undefined,
    guidance: string
  ): EditorialPayloadResult | { value: string[] | null } => {
    const result = normalizeEditorialRefs(value);
    if (result.error) {
      return {
        data: {},
        error: {
          error: "Invalid reference",
          field,
          guidance,
          index: result.index,
        },
      };
    }
    return { value: result.value };
  };

  const memberRefInput =
    (typeof member_spotlight_ref === "string" && member_spotlight_ref) ||
    (typeof member_spotlight_id === "string" && member_spotlight_id) ||
    null;
  if (memberRefInput !== null) {
    const normalized = normalizeRef(
      "member_spotlight_ref",
      memberRefInput,
      "Paste a DSC member slug or URL (e.g., /songwriters/sami-serrag)."
    );
    if ("error" in normalized) return normalized;
    normalizedData.member_spotlight_ref = normalized.value;
  }

  const venueRefInput =
    (typeof venue_spotlight_ref === "string" && venue_spotlight_ref) ||
    (typeof venue_spotlight_id === "string" && venue_spotlight_id) ||
    null;
  if (venueRefInput !== null) {
    const normalized = normalizeRef(
      "venue_spotlight_ref",
      venueRefInput,
      "Paste a DSC venue slug or URL (e.g., /venues/brewery-rickoli)."
    );
    if ("error" in normalized) return normalized;
    normalizedData.venue_spotlight_ref = normalized.value;
  }

  const blogRefInput =
    (typeof blog_feature_ref === "string" && blog_feature_ref) ||
    (typeof blog_feature_slug === "string" && blog_feature_slug) ||
    null;
  if (blogRefInput !== null) {
    const normalized = normalizeRef(
      "blog_feature_ref",
      blogRefInput,
      "Paste a DSC blog slug or URL (e.g., /blog/my-post)."
    );
    if ("error" in normalized) return normalized;
    normalizedData.blog_feature_ref = normalized.value;
  }

  const galleryRefInput =
    (typeof gallery_feature_ref === "string" && gallery_feature_ref) ||
    (typeof gallery_feature_slug === "string" && gallery_feature_slug) ||
    null;
  if (galleryRefInput !== null) {
    const normalized = normalizeRef(
      "gallery_feature_ref",
      galleryRefInput,
      "Paste a DSC gallery slug or URL (e.g., /gallery/album-slug)."
    );
    if ("error" in normalized) return normalized;
    normalizedData.gallery_feature_ref = normalized.value;
  }

  if (typeof featured_happenings_refs !== "undefined") {
    if (!Array.isArray(featured_happenings_refs)) {
      return {
        data: {},
        error: {
          error: "Invalid reference",
          field: "featured_happenings_refs",
          guidance: "Paste DSC happening slugs or URLs (e.g., /events/slug).",
        },
      };
    }

    const normalized = normalizeRefs(
      "featured_happenings_refs",
      featured_happenings_refs as string[],
      "Paste DSC happening slugs or URLs (e.g., /events/slug)."
    );
    if ("error" in normalized) return normalized;
    normalizedData.featured_happenings_refs = normalized.value;
  }

  return { data: normalizedData };
}
