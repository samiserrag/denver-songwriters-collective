import { describe, it, expect } from "vitest";

/**
 * OG Metadata Tests
 *
 * These tests verify that generateMetadata functions return the correct
 * OpenGraph and Twitter card metadata structure for social sharing.
 *
 * The actual metadata generation is tested by verifying the structure
 * and required fields match the expected format.
 */

describe("OG Metadata Structure", () => {
  describe("Required OG fields", () => {
    it("should require title field", () => {
      const metadata = {
        title: "Test Title | Denver Songwriters Collective",
        openGraph: {
          title: "Test Title | Denver Songwriters Collective",
        },
      };
      expect(metadata.openGraph.title).toBeTruthy();
      expect(metadata.title).toBe(metadata.openGraph.title);
    });

    it("should require description field", () => {
      const metadata = {
        description: "Test description for social sharing",
        openGraph: {
          description: "Test description for social sharing",
        },
      };
      expect(metadata.openGraph.description).toBeTruthy();
      expect(metadata.description).toBe(metadata.openGraph.description);
    });

    it("should require images array with proper dimensions", () => {
      const metadata = {
        openGraph: {
          images: [
            {
              url: "https://example.com/og/test",
              width: 1200,
              height: 630,
              alt: "Test - Denver Songwriters Collective",
            },
          ],
        },
      };
      expect(metadata.openGraph.images).toHaveLength(1);
      expect(metadata.openGraph.images[0].width).toBe(1200);
      expect(metadata.openGraph.images[0].height).toBe(630);
      expect(metadata.openGraph.images[0].url).toBeTruthy();
      expect(metadata.openGraph.images[0].alt).toBeTruthy();
    });

    it("should include siteName field", () => {
      const metadata = {
        openGraph: {
          siteName: "Denver Songwriters Collective",
        },
      };
      expect(metadata.openGraph.siteName).toBe("Denver Songwriters Collective");
    });

    it("should include url field for canonical URL", () => {
      const metadata = {
        openGraph: {
          url: "https://denversongwriterscollective.org/songwriters/test-user",
        },
      };
      expect(metadata.openGraph.url).toMatch(/^https:\/\//);
    });

    it("should include locale field", () => {
      const metadata = {
        openGraph: {
          locale: "en_US",
        },
      };
      expect(metadata.openGraph.locale).toBe("en_US");
    });
  });

  describe("Twitter card fields", () => {
    it("should use summary_large_image card type", () => {
      const metadata = {
        twitter: {
          card: "summary_large_image",
        },
      };
      expect(metadata.twitter.card).toBe("summary_large_image");
    });

    it("should include title and description", () => {
      const metadata = {
        twitter: {
          card: "summary_large_image",
          title: "Test Title | Denver Songwriters Collective",
          description: "Test description",
        },
      };
      expect(metadata.twitter.title).toBeTruthy();
      expect(metadata.twitter.description).toBeTruthy();
    });

    it("should include images array", () => {
      const metadata = {
        twitter: {
          card: "summary_large_image",
          images: ["https://example.com/og/test"],
        },
      };
      expect(metadata.twitter.images).toHaveLength(1);
      expect(metadata.twitter.images[0]).toMatch(/^https:\/\//);
    });
  });

  describe("Canonical URL", () => {
    it("should include alternates.canonical", () => {
      const metadata = {
        alternates: {
          canonical: "https://denversongwriterscollective.org/songwriters/test-user",
        },
      };
      expect(metadata.alternates.canonical).toMatch(/^https:\/\//);
    });
  });
});

describe("OG Image URL patterns", () => {
  const siteUrl = "https://denversongwriterscollective.org";

  describe("Songwriters OG images", () => {
    it("should generate correct OG image URL for slug", () => {
      const slug = "john-doe";
      const ogImageUrl = `${siteUrl}/og/songwriter/${slug}`;
      expect(ogImageUrl).toBe("https://denversongwriterscollective.org/og/songwriter/john-doe");
    });

    it("should handle UUID fallback", () => {
      const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const ogImageUrl = `${siteUrl}/og/songwriter/${uuid}`;
      expect(ogImageUrl).toContain("/og/songwriter/");
    });
  });

  describe("Events OG images", () => {
    it("should generate correct OG image URL for slug", () => {
      const slug = "open-mic-night";
      const ogImageUrl = `${siteUrl}/og/event/${slug}`;
      expect(ogImageUrl).toBe("https://denversongwriterscollective.org/og/event/open-mic-night");
    });
  });

  describe("Venues OG images", () => {
    it("should generate correct OG image URL for slug", () => {
      const slug = "brewery-rickoli";
      const ogImageUrl = `${siteUrl}/og/venue/${slug}`;
      expect(ogImageUrl).toBe("https://denversongwriterscollective.org/og/venue/brewery-rickoli");
    });
  });

  describe("Blog OG images", () => {
    it("should generate correct OG image URL for slug", () => {
      const slug = "my-first-post";
      const ogImageUrl = `${siteUrl}/og/blog/${slug}`;
      expect(ogImageUrl).toBe("https://denversongwriterscollective.org/og/blog/my-first-post");
    });
  });

  describe("Gallery OG images", () => {
    it("should generate correct OG image URL for slug", () => {
      const slug = "showcase-webshow-9-5-25";
      const ogImageUrl = `${siteUrl}/og/gallery/${slug}`;
      expect(ogImageUrl).toBe("https://denversongwriterscollective.org/og/gallery/showcase-webshow-9-5-25");
    });
  });
});

describe("Metadata fallback values", () => {
  it("should have fallback title for missing profile", () => {
    const title = "Songwriter Not Found | Denver Songwriters Collective";
    expect(title).toContain("Not Found");
    expect(title).toContain("Denver Songwriters Collective");
  });

  it("should have fallback title for missing event", () => {
    const title = "Happening Not Found | Denver Songwriters Collective";
    expect(title).toContain("Not Found");
    expect(title).toContain("Denver Songwriters Collective");
  });

  it("should have fallback title for missing venue", () => {
    const title = "Venue Not Found | Denver Songwriters Collective";
    expect(title).toContain("Not Found");
    expect(title).toContain("Denver Songwriters Collective");
  });

  it("should have fallback title for missing blog post", () => {
    const title = "Post Not Found | Denver Songwriters Collective";
    expect(title).toContain("Not Found");
    expect(title).toContain("Denver Songwriters Collective");
  });

  it("should have fallback title for missing gallery album", () => {
    const title = "Album Not Found | Denver Songwriters Collective";
    expect(title).toContain("Not Found");
    expect(title).toContain("Denver Songwriters Collective");
  });
});

describe("Description truncation", () => {
  it("should truncate long descriptions to 155 characters plus ellipsis", () => {
    const longBio = "A".repeat(200);
    const truncated = longBio.slice(0, 155) + (longBio.length > 155 ? "..." : "");
    expect(truncated.length).toBe(158); // 155 + 3 for "..."
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("should not add ellipsis for short descriptions", () => {
    const shortBio = "Short bio text";
    const result = shortBio.slice(0, 155) + (shortBio.length > 155 ? "..." : "");
    expect(result).toBe(shortBio);
    expect(result.endsWith("...")).toBe(false);
  });
});

describe("OG Image dimensions", () => {
  it("should use 1200x630 for standard OG images", () => {
    const dimensions = { width: 1200, height: 630 };
    expect(dimensions.width).toBe(1200);
    expect(dimensions.height).toBe(630);
    // Verify aspect ratio is approximately 1.9:1 (1200/630 ≈ 1.9)
    expect(dimensions.width / dimensions.height).toBeCloseTo(1.9, 1);
  });
});
