import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  path.resolve(__dirname, "../app/page.tsx"),
  "utf-8"
);

const happeningsSource = readFileSync(
  path.resolve(__dirname, "../app/happenings/page.tsx"),
  "utf-8"
);

describe("add happening pill links", () => {
  it("places the Add Happening pill next to the homepage See All Happenings CTA", () => {
    const seeAllIndex = homeSource.indexOf("See All Happenings");
    const addHappeningIndex = homeSource.indexOf("+ Add Happening", seeAllIndex);
    const openMicIndex = homeSource.indexOf("See Open Mics", seeAllIndex);

    expect(seeAllIndex).toBeGreaterThanOrEqual(0);
    expect(addHappeningIndex).toBeGreaterThan(seeAllIndex);
    expect(addHappeningIndex).toBeLessThan(openMicIndex);
    expect(homeSource.slice(seeAllIndex, openMicIndex)).toContain('href="/dashboard/my-events/new"');
    expect(homeSource.slice(seeAllIndex, openMicIndex)).toContain("rounded-full");
  });

  it("surfaces Add Happening near the top of the happenings page before filters", () => {
    const addHappeningIndex = happeningsSource.indexOf("+ Add Happening");
    const stickyControlsIndex = happeningsSource.indexOf("<StickyControls");
    const linkStartIndex = happeningsSource.lastIndexOf("<Link", addHappeningIndex);
    const linkBlock = happeningsSource.slice(linkStartIndex, addHappeningIndex + 250);

    expect(addHappeningIndex).toBeGreaterThanOrEqual(0);
    expect(addHappeningIndex).toBeLessThan(stickyControlsIndex);
    expect(linkBlock).toContain('href="/dashboard/my-events/new"');
    expect(linkBlock).toContain("rounded-full");
  });
});
