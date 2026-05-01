/**
 * Track 1 PR 11 — WhatChanged component tests.
 *
 * Real-render tests (RTL) for the small, isolated component that renders
 * the "What changed" field-list in CRUI. Uses the established testing-
 * library pattern in this repo (see private-section-banner.test.tsx).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { WhatChanged } from "@/app/(protected)/dashboard/my-events/_components/WhatChanged";

function renderWhatChanged(
  props: React.ComponentProps<typeof WhatChanged>,
): HTMLElement | null {
  render(React.createElement(WhatChanged, props));
  return screen.queryByTestId("what-changed-section");
}

describe("WhatChanged — render gating", () => {
  it("renders nothing in create mode", () => {
    const node = renderWhatChanged({
      mode: "create",
      before: { title: "Old" },
      after: { title: "New" },
    });
    expect(node).toBeNull();
  });

  it("renders nothing when before is null (no baseline yet)", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: null,
      after: { title: "New title" },
    });
    expect(node).toBeNull();
  });

  it("renders nothing when after is null", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { title: "Old title" },
      after: null,
    });
    expect(node).toBeNull();
  });

  it("renders nothing when the diff is empty (no changed fields)", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { title: "Same" },
      after: { title: "Same" },
    });
    expect(node).toBeNull();
  });
});

describe("WhatChanged — single scalar field change", () => {
  it("renders one row with friendly label, before, and after values", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { title: "Open Mic" },
      after: { title: "Open Mic Night" },
    });

    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("What changed");
    expect(node!.textContent).toContain("Title");
    expect(node!.textContent).toContain("Open Mic");
    expect(node!.textContent).toContain("Open Mic Night");
  });

  it("renders an em-dash placeholder when the prior value was null", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { description: null },
      after: { description: "A new description" },
    });

    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Description");
    expect(node!.textContent).toContain("—");
    expect(node!.textContent).toContain("A new description");
  });

  it("renders Yes/No for boolean scalars", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { is_free: false },
      after: { is_free: true },
    });

    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Free");
    expect(node!.textContent).toContain("No");
    expect(node!.textContent).toContain("Yes");
  });
});

describe("WhatChanged — array field change", () => {
  it("renders added/removed values for event_type, not positional order", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { event_type: ["open_mic", "showcase"] },
      after: { event_type: ["open_mic", "concert"] },
    });

    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Type");
    expect(node!.textContent).toContain("Added:");
    expect(node!.textContent).toContain("concert");
    expect(node!.textContent).toContain("Removed:");
    expect(node!.textContent).toContain("showcase");
  });

  it("treats reordering alone as no change (renders nothing)", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { event_type: ["open_mic", "showcase"] },
      after: { event_type: ["showcase", "open_mic"] },
    });
    expect(node).toBeNull();
  });
});

describe("WhatChanged — scope targeting", () => {
  it("renders when changes apply to edit_series scope", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { recurrence_rule: "weekly" },
      after: { recurrence_rule: "biweekly" },
    });
    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Recurrence");
  });

  it("renders for occurrence-scope edits when the field is occurrence-eligible", () => {
    const node = renderWhatChanged({
      mode: "edit_occurrence",
      before: { start_time: "19:00" },
      after: { start_time: "20:00" },
    });
    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Start time");
    expect(node!.textContent).toContain("19:00");
    expect(node!.textContent).toContain("20:00");
  });

  it("rejects series-only fields (e.g., recurrence_rule) when target is occurrence", () => {
    // Per computePatchDiff: series-only fields are pushed to outOfScopeFields
    // and excluded from changedFields. So the section renders nothing.
    const node = renderWhatChanged({
      mode: "edit_occurrence",
      before: { recurrence_rule: "weekly" },
      after: { recurrence_rule: "biweekly" },
    });
    expect(node).toBeNull();
  });
});

describe("WhatChanged — accessible label", () => {
  it("uses an aria-label so screen readers announce the section purpose", () => {
    const node = renderWhatChanged({
      mode: "edit_series",
      before: { title: "Old" },
      after: { title: "New" },
    });
    expect(node).not.toBeNull();
    expect(node!.getAttribute("aria-label")).toBe("What changed");
  });
});
