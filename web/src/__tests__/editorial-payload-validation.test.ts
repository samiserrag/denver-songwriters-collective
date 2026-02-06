import { describe, it, expect } from "vitest";
import { buildEditorialUpsertData } from "../lib/digest/editorialPayload";

describe("Editorial payload validation", () => {
  it("allows intro-only save", () => {
    const result = buildEditorialUpsertData({ intro_note: "Hello" });
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ intro_note: "Hello" });
  });

  it("normalizes member spotlight URL from relative path", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_ref: "/songwriters/pony-lee",
    });
    expect(result.error).toBeUndefined();
    expect(result.data.member_spotlight_ref).toBe(
      "https://denversongwriterscollective.org/songwriters/pony-lee"
    );
  });

  it("normalizes venue spotlight URL from www host without scheme", () => {
    const result = buildEditorialUpsertData({
      venue_spotlight_ref: "www.denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden",
    });
    expect(result.error).toBeUndefined();
    expect(result.data.venue_spotlight_ref).toBe(
      "https://denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden"
    );
  });

  it("normalizes URL without scheme or www", () => {
    const result = buildEditorialUpsertData({
      venue_spotlight_ref:
        "denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden",
    });
    expect(result.error).toBeUndefined();
    expect(result.data.venue_spotlight_ref).toBe(
      "https://denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden"
    );
  });

  it("normalizes blog feature URL and strips query/hash", () => {
    const result = buildEditorialUpsertData({
      blog_feature_ref: "https://denversongwriterscollective.org/blog/my-post?utm=1#top",
    });
    expect(result.error).toBeUndefined();
    expect(result.data.blog_feature_ref).toBe(
      "https://denversongwriterscollective.org/blog/my-post"
    );
  });

  it("normalizes featured happenings URLs array", () => {
    const result = buildEditorialUpsertData({
      featured_happenings_refs: [
        "https://denversongwriterscollective.org/events/a-lodge-lyons-the-rock-garden?utm=1",
        "/events/open-mic-night",
      ],
    });
    expect(result.error).toBeUndefined();
    expect(result.data.featured_happenings_refs).toEqual([
      "https://denversongwriterscollective.org/events/a-lodge-lyons-the-rock-garden",
      "https://denversongwriterscollective.org/events/open-mic-night",
    ]);
  });

  it("rejects non-DSC domains", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_ref: "https://example.com/songwriters/pony-lee",
    });
    expect(result.error?.error).toBe("Invalid URL");
    expect(result.error?.field).toBe("member_spotlight_ref");
  });

  it("rejects slug-only inputs", () => {
    const result = buildEditorialUpsertData({
      venue_spotlight_ref: "a-lodge-lyons-the-rock-garden",
    });
    expect(result.error?.error).toBe("Invalid URL");
    expect(result.error?.field).toBe("venue_spotlight_ref");
  });

  it("rejects URLs with the wrong path prefix", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_ref:
        "https://denversongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden",
    });
    expect(result.error?.error).toBe("Invalid URL");
    expect(result.error?.field).toBe("member_spotlight_ref");
  });

  it("rejects legacy *_id fields", () => {
    const result = buildEditorialUpsertData({
      member_spotlight_id: "123",
    });
    expect(result.error?.error).toBe("Invalid URL");
    expect(result.error?.field).toBe("member_spotlight_ref");
  });

  it("rejects featured_happening_ids", () => {
    const result = buildEditorialUpsertData({
      featured_happening_ids: ["123"],
    });
    expect(result.error?.error).toBe("Invalid URL");
    expect(result.error?.field).toBe("featured_happenings_refs");
  });

  it("clears whitespace-only text fields to null", () => {
    const result = buildEditorialUpsertData({
      subject_override: "   ",
      intro_note: "\n\t",
    });
    expect(result.error).toBeUndefined();
    expect(result.data.subject_override).toBeNull();
    expect(result.data.intro_note).toBeNull();
  });

  it("clears empty featured refs to null", () => {
    const result = buildEditorialUpsertData({
      featured_happenings_refs: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.data.featured_happenings_refs).toBeNull();
  });
});
