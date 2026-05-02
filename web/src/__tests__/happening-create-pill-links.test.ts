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

const actionsRowSource = readFileSync(
  path.resolve(__dirname, "../components/happenings/HappeningActionsRow.tsx"),
  "utf-8"
);

describe("add happening pill links", () => {
  it("places the Add Happening pill next to the homepage See All Happenings CTA", () => {
    // Homepage hero still keeps the literal `+ Add Happening` link
    // between `See All Happenings` and `See Open Mics`. The new
    // top-of-page strip (a `<HappeningActionsRow>`) sits above the
    // hero and is covered by `happening-actions-row.test.ts`.
    const seeAllIndex = homeSource.indexOf("See All Happenings");
    const addHappeningIndex = homeSource.indexOf("+ Add Happening", seeAllIndex);
    const openMicIndex = homeSource.indexOf("See Open Mics", seeAllIndex);

    expect(seeAllIndex).toBeGreaterThanOrEqual(0);
    expect(addHappeningIndex).toBeGreaterThan(seeAllIndex);
    expect(addHappeningIndex).toBeLessThan(openMicIndex);
    expect(homeSource.slice(seeAllIndex, openMicIndex)).toContain(
      'href="/dashboard/my-events/new"'
    );
    expect(homeSource.slice(seeAllIndex, openMicIndex)).toContain("rounded-full");
  });

  it("surfaces an Add-Happening entry point near the top of the happenings page before filters", () => {
    // The previous inline `+ Add Happening` link was replaced by a
    // `<HappeningActionsRow>` component so the entry now stays
    // visible regardless of `showHero` / `pageTitle` state. The
    // contract gated by this test — entry point exists before the
    // sticky filter block — is preserved by asserting that the
    // component is rendered at least once before `<StickyControls`,
    // and that the component itself wires the create href + the
    // pill-shaped (`rounded-full`) treatment.
    const actionsRowIndex = happeningsSource.indexOf("<HappeningActionsRow");
    const stickyControlsIndex = happeningsSource.indexOf("<StickyControls");

    expect(actionsRowIndex).toBeGreaterThanOrEqual(0);
    expect(stickyControlsIndex).toBeGreaterThan(actionsRowIndex);
    expect(actionsRowSource).toContain('href="/dashboard/my-events/new"');
    expect(actionsRowSource).toContain("rounded-full");
  });
});
