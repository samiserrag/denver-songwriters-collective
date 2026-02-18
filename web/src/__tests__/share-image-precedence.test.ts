import { describe, expect, it } from "vitest";
import { DEFAULT_SHARE_IMAGE, selectShareImageUrl } from "@/lib/share-image";

describe("share image precedence", () => {
  it("uses social share image when present", () => {
    const result = selectShareImageUrl({
      socialShareImageUrl: "https://example.com/share.png",
      heroImageUrl: "https://example.com/hero.png",
    });

    expect(result).toBe("https://example.com/share.png");
  });

  it("falls back to hero image when social share image is empty", () => {
    const result = selectShareImageUrl({
      socialShareImageUrl: "   ",
      heroImageUrl: "https://example.com/hero.png",
    });

    expect(result).toBe("https://example.com/hero.png");
  });

  it("falls back to default when both social share and hero are missing", () => {
    const result = selectShareImageUrl({
      socialShareImageUrl: "",
      heroImageUrl: null,
    });

    expect(result).toBe(DEFAULT_SHARE_IMAGE);
  });
});
