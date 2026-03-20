import { describe, expect, it } from "vitest";

describe("ImageUpload crop export contract", () => {
  it("uses natural image dimensions when computing crop pixels", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/ui/ImageUpload.tsx", "utf-8");

    expect(source).toContain("(completedCrop.x / 100) * image.naturalWidth");
    expect(source).toContain("(completedCrop.y / 100) * image.naturalHeight");
    expect(source).toContain("(completedCrop.width / 100) * image.naturalWidth");
    expect(source).toContain("(completedCrop.height / 100) * image.naturalHeight");
  });

  it("does not rely on rendered image width/height scaling for crop export", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/components/ui/ImageUpload.tsx", "utf-8");

    expect(source).not.toContain("const scaleX = image.naturalWidth / image.width");
    expect(source).not.toContain("const scaleY = image.naturalHeight / image.height");
    expect(source).not.toContain("* image.width * scaleX");
    expect(source).not.toContain("* image.height * scaleY");
  });
});
