import {
  getEditorialUrlPrefix,
  normalizeEditorialUrl,
  normalizeEditorialUrls,
} from "./digestEditorial";

export interface EditorialPayloadError {
  error: "Invalid URL";
  field: string;
  guidance: string;
  example?: string;
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
    member_spotlight_ref,
    venue_spotlight_ref,
    blog_feature_ref,
    gallery_feature_ref,
    featured_happenings_refs,
  } = editorialData;

  const guidance = "URLs only. Paste a link from this site.";
  const examples = {
    member_spotlight_ref:
      "https://denversongwriterscollective.org/songwriters/pony-lee",
    venue_spotlight_ref:
      "https://denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden",
    blog_feature_ref:
      "https://denversongwriterscollective.org/blog/my-post",
    gallery_feature_ref:
      "https://denversongwriterscollective.org/gallery/album-slug",
    featured_happenings_refs:
      "https://denversongwriterscollective.org/events/a-lodge-lyons-the-rock-garden",
  };

  const invalidUrl = (
    field: keyof typeof examples,
    index?: number
  ): EditorialPayloadResult => ({
    data: {},
    error: {
      error: "Invalid URL",
      field,
      guidance,
      example: examples[field],
      index,
    },
  });

  const disallowedFields = [
    "member_spotlight_id",
    "venue_spotlight_id",
    "featured_happening_ids",
    "blog_feature_slug",
    "gallery_feature_slug",
  ];

  for (const field of disallowedFields) {
    if (Object.prototype.hasOwnProperty.call(editorialData, field)) {
      return invalidUrl(
        (field === "featured_happening_ids"
          ? "featured_happenings_refs"
          : (field.replace(/_id$|_slug$/, "_ref") as keyof typeof examples))
      );
    }
  }

  const normalizedData: Record<string, unknown> = {};
  const hasField = (field: string) =>
    Object.prototype.hasOwnProperty.call(editorialData, field);

  const normalizeClearableText = (value: unknown): string | null | undefined => {
    if (typeof value !== "string") return value == null ? null : undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return value;
  };

  if (hasField("subject_override")) {
    const normalized = normalizeClearableText(subject_override);
    if (normalized !== undefined) normalizedData.subject_override = normalized;
  }

  if (hasField("intro_note")) {
    const normalized = normalizeClearableText(intro_note);
    if (normalized !== undefined) normalizedData.intro_note = normalized;
  }

  if (hasField("member_spotlight_ref")) {
    if (member_spotlight_ref == null) {
      normalizedData.member_spotlight_ref = null;
    } else if (typeof member_spotlight_ref !== "string") {
      return invalidUrl("member_spotlight_ref");
    } else {
      const trimmed = member_spotlight_ref.trim();
      if (!trimmed) {
        normalizedData.member_spotlight_ref = null;
      } else {
        const normalized = normalizeEditorialUrl(
          trimmed,
          getEditorialUrlPrefix("member_spotlight_ref")
        );
        if (normalized.error) {
          return invalidUrl("member_spotlight_ref");
        }
        normalizedData.member_spotlight_ref = normalized.value;
      }
    }
  }

  if (hasField("venue_spotlight_ref")) {
    if (venue_spotlight_ref == null) {
      normalizedData.venue_spotlight_ref = null;
    } else if (typeof venue_spotlight_ref !== "string") {
      return invalidUrl("venue_spotlight_ref");
    } else {
      const trimmed = venue_spotlight_ref.trim();
      if (!trimmed) {
        normalizedData.venue_spotlight_ref = null;
      } else {
        const normalized = normalizeEditorialUrl(
          trimmed,
          getEditorialUrlPrefix("venue_spotlight_ref")
        );
        if (normalized.error) {
          return invalidUrl("venue_spotlight_ref");
        }
        normalizedData.venue_spotlight_ref = normalized.value;
      }
    }
  }

  if (hasField("blog_feature_ref")) {
    if (blog_feature_ref == null) {
      normalizedData.blog_feature_ref = null;
    } else if (typeof blog_feature_ref !== "string") {
      return invalidUrl("blog_feature_ref");
    } else {
      const trimmed = blog_feature_ref.trim();
      if (!trimmed) {
        normalizedData.blog_feature_ref = null;
      } else {
        const normalized = normalizeEditorialUrl(
          trimmed,
          getEditorialUrlPrefix("blog_feature_ref")
        );
        if (normalized.error) {
          return invalidUrl("blog_feature_ref");
        }
        normalizedData.blog_feature_ref = normalized.value;
      }
    }
  }

  if (hasField("gallery_feature_ref")) {
    if (gallery_feature_ref == null) {
      normalizedData.gallery_feature_ref = null;
    } else if (typeof gallery_feature_ref !== "string") {
      return invalidUrl("gallery_feature_ref");
    } else {
      const trimmed = gallery_feature_ref.trim();
      if (!trimmed) {
        normalizedData.gallery_feature_ref = null;
      } else {
        const normalized = normalizeEditorialUrl(
          trimmed,
          getEditorialUrlPrefix("gallery_feature_ref")
        );
        if (normalized.error) {
          return invalidUrl("gallery_feature_ref");
        }
        normalizedData.gallery_feature_ref = normalized.value;
      }
    }
  }

  if (hasField("featured_happenings_refs")) {
    if (featured_happenings_refs == null) {
      normalizedData.featured_happenings_refs = null;
    } else if (!Array.isArray(featured_happenings_refs)) {
      return invalidUrl("featured_happenings_refs");
    } else {
      const trimmedRefs = (featured_happenings_refs as unknown[])
        .filter((ref): ref is string => typeof ref === "string")
        .map((ref) => ref.trim())
        .filter(Boolean);
      if (trimmedRefs.length === 0) {
        normalizedData.featured_happenings_refs = null;
      } else {
        const normalized = normalizeEditorialUrls(
          trimmedRefs,
          getEditorialUrlPrefix("featured_happenings_refs")
        );
        if (normalized.error) {
          return invalidUrl("featured_happenings_refs", normalized.index);
        }
        normalizedData.featured_happenings_refs = normalized.value;
      }
    }
  }

  return { data: normalizedData };
}
