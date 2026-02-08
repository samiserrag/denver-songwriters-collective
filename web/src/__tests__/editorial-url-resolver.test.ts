import { describe, it, expect } from "vitest";
import {
  normalizeEditorialUrl,
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
      "https://coloradosongwriterscollective.org/songwriters/pony-lee";

    const result = await resolveEditorialWithDiagnostics(
      supabase as never,
      editorial
    );

    expect(result.unresolved).toEqual([]);
    expect(result.resolved.memberSpotlight?.name).toBe("Pony Lee");
    expect(result.resolved.memberSpotlight?.url).toBe(
      "https://coloradosongwriterscollective.org/songwriters/pony-lee"
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

  it("normalizeEditorialUrl accepts the old domain (coloradosongwriterscollective.org)", () => {
    const result = normalizeEditorialUrl(
      "https://coloradosongwriterscollective.org/songwriters/pony-lee",
      "/songwriters/"
    );
    expect(result.error).toBeUndefined();
    expect(result.slug).toBe("pony-lee");
    expect(result.value).toContain("/songwriters/pony-lee");
  });

  it("normalizeEditorialUrl accepts the new domain (coloradosongwriterscollective.org)", () => {
    const result = normalizeEditorialUrl(
      "https://coloradosongwriterscollective.org/songwriters/pony-lee",
      "/songwriters/"
    );
    expect(result.error).toBeUndefined();
    expect(result.slug).toBe("pony-lee");
    expect(result.value).toContain("/songwriters/pony-lee");
  });

  it("normalizeEditorialUrl accepts www variants of both domains", () => {
    const oldWww = normalizeEditorialUrl(
      "https://www.coloradosongwriterscollective.org/venues/brewery-rickoli",
      "/venues/"
    );
    expect(oldWww.error).toBeUndefined();
    expect(oldWww.slug).toBe("brewery-rickoli");

    const newWww = normalizeEditorialUrl(
      "https://www.coloradosongwriterscollective.org/venues/brewery-rickoli",
      "/venues/"
    );
    expect(newWww.error).toBeUndefined();
    expect(newWww.slug).toBe("brewery-rickoli");
  });

  it("normalizeEditorialUrl rejects URLs from unknown domains", () => {
    const result = normalizeEditorialUrl(
      "https://example.com/songwriters/pony-lee",
      "/songwriters/"
    );
    expect(result.error).toBe("unsupported_domain");
    expect(result.value).toBeNull();
  });

  it("resolves a gallery URL using gallery_albums.name (published only)", async () => {
    const supabase = {
      from: (table: string) => {
        if (table !== "gallery_albums") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select: (fields: string) => {
            expect(fields).toContain("name");
            return {
              eq: (column: string, value: string | boolean) => {
                expect(column).toBe("slug");
                expect(value).toBe("collective-open-mic-at-sloan-lake-2-1-26");
                return {
                  eq: (column2: string, value2: string | boolean) => {
                    expect(column2).toBe("is_published");
                    expect(value2).toBe(true);
                    return {
                  maybeSingle: async () => ({
                    data: {
                      slug: "collective-open-mic-at-sloan-lake-2-1-26",
                      name: "Collective Open Mic at Sloan Lake 2-1-26",
                      cover_image_url: null,
                    },
                    error: null,
                  }),
                };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown;

    const editorial = baseEditorial();
    editorial.gallery_feature_ref =
      "https://coloradosongwriterscollective.org/gallery/collective-open-mic-at-sloan-lake-2-1-26";

    const result = await resolveEditorialWithDiagnostics(
      supabase as never,
      editorial
    );

    expect(result.unresolved).toEqual([]);
    expect(result.resolved.galleryFeature?.title).toBe(
      "Collective Open Mic at Sloan Lake 2-1-26"
    );
    expect(result.resolved.galleryFeature?.url).toBe(
      "https://coloradosongwriterscollective.org/gallery/collective-open-mic-at-sloan-lake-2-1-26"
    );
  });
});

describe("Embed route domain-agnostic canonical URL (source-level)", () => {
  it("embed route imports getSiteUrl and uses it for canonicalUrl and imageUrl", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routePath = path.resolve(
      __dirname,
      "../app/embed/events/[id]/route.ts"
    );
    const source = fs.readFileSync(routePath, "utf-8");

    // Must import getSiteUrl
    expect(source).toContain('import { getSiteUrl } from "@/lib/siteUrl"');

    // Must call getSiteUrl() and use it for URLs
    expect(source).toContain("const siteUrl = getSiteUrl()");
    expect(source).toContain("const canonicalUrl = `${siteUrl}${canonicalPath}`");

    // Must NOT contain hardcoded production domain in URL construction
    const lines = source.split("\n");
    const urlConstructionLines = lines.filter(
      (line) =>
        (line.includes("canonicalUrl") || line.includes("imageUrl")) &&
        !line.trimStart().startsWith("//") &&
        !line.trimStart().startsWith("*")
    );
    for (const line of urlConstructionLines) {
      expect(line).not.toContain(
        '"https://coloradosongwriterscollective.org'
      );
    }
  });
});
