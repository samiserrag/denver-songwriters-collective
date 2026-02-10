import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Embed framing regression", () => {
  it("keeps embed routes frameable and non-embed routes deny-framed", () => {
    const nextConfig = fs.readFileSync(path.join(ROOT, "..", "next.config.ts"), "utf-8");

    expect(nextConfig).toContain('source: "/embed/:path*"');
    expect(nextConfig).toContain("frame-ancestors *");

    expect(nextConfig).toContain('source: "/((?!embed/).*)"');
    expect(nextConfig).toContain('key: "X-Frame-Options"');
    expect(nextConfig).toContain("DENY");
    expect(nextConfig).toContain("frame-ancestors 'none'");
  });

  it("includes EMBED-02 routes with dynamic server rendering", () => {
    const routes = [
      "app/embed/venues/[id]/route.ts",
      "app/embed/members/[id]/route.ts",
      "app/embed/blog/[slug]/route.ts",
      "app/embed/gallery/[slug]/route.ts",
    ];

    for (const route of routes) {
      const source = fs.readFileSync(path.join(ROOT, route), "utf-8");
      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).toContain("isExternalEmbedsEnabled");
    }
  });
});
