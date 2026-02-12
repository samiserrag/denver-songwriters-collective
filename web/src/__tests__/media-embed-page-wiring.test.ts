import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("media embed canonical page wiring", () => {
  it("wires events detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/events/[id]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    expect(source).toContain("MediaEmbedsSection");
  });

  it("wires blog detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/blog/[slug]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    expect(source).toContain("MediaEmbedsSection");
  });

  it("wires gallery detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/gallery/[slug]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    expect(source).toContain("MediaEmbedsSection");
  });
});
