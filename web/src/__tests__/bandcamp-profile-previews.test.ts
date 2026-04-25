import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBandcampProfileLinkMeta } from "@/lib/bandcampProfilePreviews";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveBandcampProfileLinkMeta", () => {
  it("enriches Bandcamp profile links from public page metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Great Band">
            <meta property="og:description" content="music from Denver">
            <meta property="og:image" content="https://f4.bcbits.com/img/a123.jpg">
          </head>
        </html>
      `,
    } as Response);

    await expect(resolveBandcampProfileLinkMeta("https://greatband.bandcamp.com")).resolves.toEqual({
      provider: "bandcamp",
      href: "https://greatband.bandcamp.com/",
      dedupe_key: "https://greatband.bandcamp.com/",
      headline: "Great Band",
      supportingText: "music from Denver",
      ctaLabel: "Listen on Bandcamp",
      thumbnailUrl: "https://f4.bcbits.com/img/a123.jpg",
    });
  });

  it("falls back to the basic Bandcamp profile card when metadata fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
    } as Response);

    await expect(resolveBandcampProfileLinkMeta("https://fallback.bandcamp.com")).resolves.toMatchObject({
      provider: "bandcamp",
      headline: "fallback",
      supportingText: "Bandcamp profile",
      ctaLabel: "Open on Bandcamp",
    });
  });
});
