import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("admin events table layout + theme contract", () => {
  it("uses fixed table layout and avoids horizontal-scroll wrapper", () => {
    const source = read("components/admin/EventSpotlightTable.tsx");
    expect(source).toContain("table-fixed");
    expect(source).not.toContain("overflow-x-auto");
  });

  it("uses theme token colors instead of hardcoded dark-only table shell colors", () => {
    const source = read("components/admin/EventSpotlightTable.tsx");
    expect(source).not.toContain("bg-black/20");
    expect(source).not.toContain("text-gold-400");
    expect(source).not.toContain("border-white/10");
  });

  it("uses wider admin events page container to prevent clipped columns", () => {
    const source = read("app/(protected)/dashboard/admin/events/page.tsx");
    expect(source).toContain("max-w-7xl");
  });
});
