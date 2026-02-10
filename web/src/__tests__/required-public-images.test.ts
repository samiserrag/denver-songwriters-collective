import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_PUBLIC_IMAGES = [
  "images/hero-bg.jpg",
  "images/og-image.jpg",
  "images/hero/denver-songwriters-hero.jpg",
];

describe("required public image assets", () => {
  it("keeps required image files in web/public", () => {
    const publicRoot = path.resolve(process.cwd(), "public");

    for (const imagePath of REQUIRED_PUBLIC_IMAGES) {
      const fullPath = path.join(publicRoot, imagePath);
      expect(
        fs.existsSync(fullPath),
        `Missing required public asset: ${imagePath}`
      ).toBe(true);
    }
  });
});
