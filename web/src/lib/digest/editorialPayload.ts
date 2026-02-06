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

  if (typeof subject_override === "string") normalizedData.subject_override = subject_override;
  if (typeof intro_note === "string") normalizedData.intro_note = intro_note;
  if (typeof member_spotlight_ref === "string" && member_spotlight_ref.trim()) {
    const normalized = normalizeEditorialUrl(
      member_spotlight_ref,
      getEditorialUrlPrefix("member_spotlight_ref")
    );
    if (normalized.error) {
      return invalidUrl("member_spotlight_ref");
    }
    normalizedData.member_spotlight_ref = normalized.value;
  }

  if (typeof venue_spotlight_ref === "string" && venue_spotlight_ref.trim()) {
    const normalized = normalizeEditorialUrl(
      venue_spotlight_ref,
      getEditorialUrlPrefix("venue_spotlight_ref")
    );
    if (normalized.error) {
      return invalidUrl("venue_spotlight_ref");
    }
    normalizedData.venue_spotlight_ref = normalized.value;
  }

  if (typeof blog_feature_ref === "string" && blog_feature_ref.trim()) {
    const normalized = normalizeEditorialUrl(
      blog_feature_ref,
      getEditorialUrlPrefix("blog_feature_ref")
    );
    if (normalized.error) {
      return invalidUrl("blog_feature_ref");
    }
    normalizedData.blog_feature_ref = normalized.value;
  }

  if (typeof gallery_feature_ref === "string" && gallery_feature_ref.trim()) {
    const normalized = normalizeEditorialUrl(
      gallery_feature_ref,
      getEditorialUrlPrefix("gallery_feature_ref")
    );
    if (normalized.error) {
      return invalidUrl("gallery_feature_ref");
    }
    normalizedData.gallery_feature_ref = normalized.value;
  }

  if (typeof featured_happenings_refs !== "undefined") {
    if (!Array.isArray(featured_happenings_refs)) {
      return invalidUrl("featured_happenings_refs");
    }

    const normalized = normalizeEditorialUrls(
      featured_happenings_refs as string[],
      getEditorialUrlPrefix("featured_happenings_refs")
    );
    if (normalized.error) {
      return invalidUrl("featured_happenings_refs", normalized.index);
    }
    normalizedData.featured_happenings_refs = normalized.value;
  }

  return { data: normalizedData };
}
