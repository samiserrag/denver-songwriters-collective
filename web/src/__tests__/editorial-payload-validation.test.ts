import { describe, it, expect } from "vitest";
import { buildEditorialUpsertData } from "../lib/digest/editorialPayload";

describe("Editorial payload validation", () => {
  it("allows intro-only save", () => {
    const result = buildEditorialUpsertData({ intro_note: "Hello" });
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ intro_note: "Hello" });
  });

  const refCases = [
    {
      label: "member spotlight URL",
      field: "member_spotlight_ref",
      value: "https://denversongwriterscollective.org/songwriters/sami-serrag",
      expected: "sami-serrag",
    },
    {
      label: "member spotlight slug",
      field: "member_spotlight_ref",
      value: "sami-serrag",
      expected: "sami-serrag",
    },
    {
      label: "venue spotlight URL",
      field: "venue_spotlight_ref",
      value: "https://denversongwriterscollective.org/venues/brewery-rickoli?utm=1",
      expected: "brewery-rickoli",
    },
    {
      label: "venue spotlight slug",
      field: "venue_spotlight_ref",
      value: "brewery-rickoli",
      expected: "brewery-rickoli",
    },
    {
      label: "blog feature URL",
      field: "blog_feature_ref",
      value: "https://denversongwriterscollective.org/blog/my-post?utm=1#top",
      expected: "my-post",
    },
    {
      label: "blog feature slug",
      field: "blog_feature_ref",
      value: "my-post",
      expected: "my-post",
    },
    {
      label: "gallery feature URL",
      field: "gallery_feature_ref",
      value: "https://denversongwriterscollective.org/gallery/album-slug#section",
      expected: "album-slug",
    },
    {
      label: "gallery feature slug",
      field: "gallery_feature_ref",
      value: "album-slug",
      expected: "album-slug",
    },
  ];

  for (const testCase of refCases) {
    it(`normalizes ${testCase.label}`, () => {
      const result = buildEditorialUpsertData({ [testCase.field]: testCase.value });
      expect(result.error).toBeUndefined();
      expect(result.data[testCase.field]).toBe(testCase.expected);
    });
  }

  it("normalizes featured happenings refs from URLs and slugs", () => {
    const result = buildEditorialUpsertData({
      featured_happenings_refs: [
        "https://denversongwriterscollective.org/events/a-lodge-lyons-the-rock-garden?utm=1",
        "open-mic-night",
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.data.featured_happenings_refs).toEqual([
      "a-lodge-lyons-the-rock-garden",
      "open-mic-night",
    ]);
  });

  it("returns invalid reference error for unsupported domains", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_ref: "https://example.com/songwriters/sami-serrag",
    });
    expect(result.error?.error).toBe("Invalid reference");
    expect(result.error?.field).toBe("member_spotlight_ref");
  });

  it("returns invalid reference error with index for mixed refs", () => {
    const result = buildEditorialUpsertData({
      featured_happenings_refs: [
        "https://denversongwriterscollective.org/events/valid-slug",
        "https://example.com/events/not-allowed",
      ],
    });
    expect(result.error?.error).toBe("Invalid reference");
    expect(result.error?.field).toBe("featured_happenings_refs");
    expect(result.error?.index).toBe(1);
  });

  it("returns invalid UUID error for legacy UUID fields", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_id: "not-a-uuid",
    });
    expect(result.error?.error).toBe("Invalid UUID");
    expect(result.error?.field).toBe("member_spotlight_id");
  });

  it("returns invalid UUID error for featured_happening_ids array", () => {
    const result = buildEditorialUpsertData({
      featured_happening_ids: ["not-a-uuid"],
    });
    expect(result.error?.error).toBe("Invalid UUID");
    expect(result.error?.field).toBe("featured_happening_ids");
  });
});
