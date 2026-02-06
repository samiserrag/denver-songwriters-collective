import { describe, it, expect } from "vitest";
import {
  resolveEditorialWithDiagnostics,
  type DigestEditorial,
} from "../lib/digest/digestEditorial";

const baseEditorial = (): DigestEditorial => ({
  id: "editorial-1",
  week_key: "2026-W06",
  digest_type: "weekly_happenings",
  subject_override: null,
  intro_note: null,
  featured_happening_ids: null,
  member_spotlight_id: null,
  venue_spotlight_id: null,
  blog_feature_slug: null,
  gallery_feature_slug: null,
  featured_happenings_refs: null,
  member_spotlight_ref: null,
  venue_spotlight_ref: null,
  blog_feature_ref: null,
  gallery_feature_ref: null,
  created_at: "2026-02-06T00:00:00.000Z",
  updated_at: "2026-02-06T00:00:00.000Z",
  updated_by: null,
});

describe("Editorial URL resolver", () => {
  it("resolves a member spotlight URL to a profile", async () => {
    const supabase = {
      from: (table: string) => {
        if (table !== "profiles") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "profile-1",
                  full_name: "Pony Lee",
                  slug: "pony-lee",
                  avatar_url: null,
                  bio: "A short bio.",
                },
                error: null,
              }),
            }),
          }),
        };
      },
    } as unknown;

    const editorial = baseEditorial();
    editorial.member_spotlight_ref =
      "https://denversongwriterscollective.org/songwriters/pony-lee";

    const result = await resolveEditorialWithDiagnostics(
      supabase as never,
      editorial
    );

    expect(result.unresolved).toEqual([]);
    expect(result.resolved.memberSpotlight?.name).toBe("Pony Lee");
    expect(result.resolved.memberSpotlight?.url).toBe(
      "https://denversongwriterscollective.org/songwriters/pony-lee"
    );
  });

  it("returns unresolved diagnostics for invalid URL inputs", async () => {
    const supabase = {
      from: () => {
        throw new Error("Should not query for invalid URLs");
      },
    } as unknown;

    const editorial = baseEditorial();
    editorial.member_spotlight_ref =
      "https://example.com/songwriters/pony-lee";

    const result = await resolveEditorialWithDiagnostics(
      supabase as never,
      editorial
    );

    expect(result.resolved.memberSpotlight).toBeUndefined();
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].field).toBe("member_spotlight_ref");
    expect(result.unresolved[0].reason).toBe("unsupported_domain");
  });
});
