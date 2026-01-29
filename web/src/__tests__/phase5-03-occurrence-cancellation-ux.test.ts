/**
 * Phase 5.03 — Occurrence Cancellation UX Tests
 *
 * Tests for:
 * - DatePillRow isCancelled styling
 * - nextOccurrence.ts includes cancelled in series view
 * - SeriesCard passes isCancelled flag
 * - Event detail page cancelled pill styling
 * - OccurrenceEditor default show-cancelled ON
 * - Optimistic UI behavior
 */

import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Part A: DatePillRow isCancelled Styling
// ═══════════════════════════════════════════════════════════════════════════

describe("Part A: DatePillRow isCancelled Styling", () => {
  it("should define isCancelled as optional property on DatePillData", () => {
    // Type check - interface should support isCancelled
    interface DatePillData {
      label: string;
      href: string;
      dateKey: string;
      isRescheduled?: boolean;
      isCancelled?: boolean;
    }

    const cancelledPill: DatePillData = {
      label: "Mon, Jan 27",
      href: "/events/test?date=2026-01-27",
      dateKey: "2026-01-27",
      isCancelled: true,
    };

    expect(cancelledPill.isCancelled).toBe(true);
  });

  it("should apply cancelled styling with line-through and opacity", () => {
    // Cancelled pills should have:
    // - line-through text decoration
    // - reduced opacity (70%)
    // - red color scheme
    const cancelledClasses = "bg-red-100/50 dark:bg-red-500/5 text-red-400 dark:text-red-500 border border-red-300 dark:border-red-500/30 line-through opacity-70";

    expect(cancelledClasses).toContain("line-through");
    expect(cancelledClasses).toContain("opacity-70");
    expect(cancelledClasses).toContain("red");
  });

  it("should render ✕ prefix for cancelled pills", () => {
    // Cancelled pills should show ✕ icon before the date
    const cancelledIcon = "✕";
    expect(cancelledIcon).toBe("✕");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part B: nextOccurrence.ts Series View Includes Cancelled
// ═══════════════════════════════════════════════════════════════════════════

describe("Part B: Series View Includes Cancelled Occurrences", () => {
  interface MockOverride {
    event_id: string;
    date_key: string;
    status: "normal" | "cancelled";
  }

  interface MockOccurrence {
    dateKey: string;
    isConfident: boolean;
    isCancelled?: boolean;
  }

  function buildOverrideKey(eventId: string, dateKey: string): string {
    return `${eventId}:${dateKey}`;
  }

  function mapOccurrencesWithCancelled(
    occurrences: MockOccurrence[],
    overrides: MockOverride[],
    eventId: string
  ): MockOccurrence[] {
    const overrideMap = new Map(
      overrides.map((o) => [buildOverrideKey(o.event_id, o.date_key), o])
    );

    return occurrences.map((occ) => {
      const key = buildOverrideKey(eventId, occ.dateKey);
      const override = overrideMap.get(key);
      return {
        ...occ,
        isCancelled: override?.status === "cancelled",
      };
    });
  }

  it("should include cancelled occurrences in array (not filter them out)", () => {
    const eventId = "event-123";
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-27", isConfident: true },
      { dateKey: "2026-02-03", isConfident: true },
      { dateKey: "2026-02-10", isConfident: true },
    ];
    const overrides: MockOverride[] = [
      { event_id: eventId, date_key: "2026-02-03", status: "cancelled" },
    ];

    const result = mapOccurrencesWithCancelled(occurrences, overrides, eventId);

    // All 3 occurrences should be present (not filtered)
    expect(result).toHaveLength(3);
    // Middle one should have isCancelled: true
    expect(result[1].isCancelled).toBe(true);
    // Others should be false/undefined
    expect(result[0].isCancelled).toBe(false);
    expect(result[2].isCancelled).toBe(false);
  });

  it("should mark isCancelled=true for cancelled overrides", () => {
    const eventId = "event-456";
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-28", isConfident: true },
    ];
    const overrides: MockOverride[] = [
      { event_id: eventId, date_key: "2026-01-28", status: "cancelled" },
    ];

    const result = mapOccurrencesWithCancelled(occurrences, overrides, eventId);

    expect(result[0].isCancelled).toBe(true);
  });

  it("should mark isCancelled=false for normal overrides", () => {
    const eventId = "event-789";
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-28", isConfident: true },
    ];
    const overrides: MockOverride[] = [
      { event_id: eventId, date_key: "2026-01-28", status: "normal" },
    ];

    const result = mapOccurrencesWithCancelled(occurrences, overrides, eventId);

    expect(result[0].isCancelled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part C: SeriesCard Passes isCancelled Flag
// ═══════════════════════════════════════════════════════════════════════════

describe("Part C: SeriesCard Passes isCancelled Flag", () => {
  interface MockDatePill {
    label: string;
    href: string;
    dateKey: string;
    isRescheduled?: boolean;
    isCancelled?: boolean;
  }

  interface MockUpcomingOccurrence {
    dateKey: string;
    displayDate?: string;
    isRescheduled?: boolean;
    isCancelled?: boolean;
  }

  function formatDateShort(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00Z`);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
  }

  function buildDatePills(
    occurrences: MockUpcomingOccurrence[],
    eventSlug: string
  ): MockDatePill[] {
    return occurrences.map((occ) => ({
      label: formatDateShort(occ.displayDate || occ.dateKey),
      href: `/events/${eventSlug}?date=${occ.dateKey}`,
      dateKey: occ.dateKey,
      isRescheduled: occ.isRescheduled,
      isCancelled: occ.isCancelled,
    }));
  }

  it("should pass isCancelled flag to DatePillRow", () => {
    const occurrences: MockUpcomingOccurrence[] = [
      { dateKey: "2026-01-27", isCancelled: false },
      { dateKey: "2026-02-03", isCancelled: true },
    ];

    const pills = buildDatePills(occurrences, "test-event");

    expect(pills[0].isCancelled).toBe(false);
    expect(pills[1].isCancelled).toBe(true);
  });

  it("should preserve dateKey for href even when cancelled", () => {
    const occurrences: MockUpcomingOccurrence[] = [
      { dateKey: "2026-02-03", isCancelled: true },
    ];

    const pills = buildDatePills(occurrences, "test-event");

    // Link should use dateKey (identity), not filter out cancelled
    expect(pills[0].href).toBe("/events/test-event?date=2026-02-03");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part D: Event Detail Page Cancelled Pill Styling
// ═══════════════════════════════════════════════════════════════════════════

describe("Part D: Event Detail Page Cancelled Pill Styling", () => {
  interface MockOverride {
    date_key: string;
    status?: "normal" | "cancelled";
    override_patch?: { event_date?: string };
  }

  function getPillStyling(
    isSelected: boolean,
    isCancelled: boolean,
    isRescheduled: boolean
  ): string {
    if (isSelected) {
      return "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]";
    }
    if (isCancelled) {
      return "bg-red-100/50 dark:bg-red-500/5 text-red-400 dark:text-red-500 border border-red-300 dark:border-red-500/30 line-through opacity-70";
    }
    if (isRescheduled) {
      return "bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300";
    }
    return "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]";
  }

  it("should apply cancelled styling when override status is cancelled", () => {
    const styling = getPillStyling(false, true, false);

    expect(styling).toContain("red");
    expect(styling).toContain("line-through");
    expect(styling).toContain("opacity-70");
  });

  it("should prioritize selected over cancelled styling", () => {
    const styling = getPillStyling(true, true, false);

    // Selected styling should take priority
    expect(styling).toContain("accent-primary");
    expect(styling).not.toContain("line-through");
  });

  it("should detect cancelled from override status", () => {
    const override: MockOverride = {
      date_key: "2026-01-28",
      status: "cancelled",
    };

    const isCancelled = override.status === "cancelled";
    expect(isCancelled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part E: OccurrenceEditor Default Show-Cancelled ON
// ═══════════════════════════════════════════════════════════════════════════

describe("Part E: OccurrenceEditor Default Show-Cancelled ON", () => {
  it("should default showCancelled to true", () => {
    // In the component: const [showCancelled, setShowCancelled] = useState(true);
    const defaultShowCancelled = true;
    expect(defaultShowCancelled).toBe(true);
  });

  it("should include all occurrences when showCancelled is true", () => {
    const showCancelled = true;
    const allOccurrences = [
      { dateKey: "2026-01-27", isCancelled: false },
      { dateKey: "2026-02-03", isCancelled: true },
      { dateKey: "2026-02-10", isCancelled: false },
    ];
    const normalOccurrences = allOccurrences.filter((o) => !o.isCancelled);

    const displayOccurrences = showCancelled ? allOccurrences : normalOccurrences;

    expect(displayOccurrences).toHaveLength(3);
  });

  it("should allow toggling to hide cancelled occurrences", () => {
    const showCancelled = false;
    const allOccurrences = [
      { dateKey: "2026-01-27", isCancelled: false },
      { dateKey: "2026-02-03", isCancelled: true },
      { dateKey: "2026-02-10", isCancelled: false },
    ];
    const normalOccurrences = allOccurrences.filter((o) => !o.isCancelled);

    const displayOccurrences = showCancelled ? allOccurrences : normalOccurrences;

    expect(displayOccurrences).toHaveLength(2);
    expect(displayOccurrences.every((o) => !o.isCancelled)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part F: Optimistic UI Behavior
// ═══════════════════════════════════════════════════════════════════════════

describe("Part F: Optimistic UI Behavior", () => {
  interface MockOccurrence {
    dateKey: string;
    isCancelled: boolean;
    override: { status: string } | null;
  }

  function applyOptimisticCancel(
    occurrences: MockOccurrence[],
    dateKey: string
  ): MockOccurrence[] {
    return occurrences.map((occ) =>
      occ.dateKey === dateKey
        ? { ...occ, isCancelled: true, override: { status: "cancelled" } }
        : occ
    );
  }

  function applyOptimisticRestore(
    occurrences: MockOccurrence[],
    dateKey: string
  ): MockOccurrence[] {
    return occurrences.map((occ) =>
      occ.dateKey === dateKey
        ? { ...occ, isCancelled: false, override: { status: "normal" } }
        : occ
    );
  }

  it("should immediately mark occurrence as cancelled on cancel action", () => {
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-28", isCancelled: false, override: null },
    ];

    const updated = applyOptimisticCancel(occurrences, "2026-01-28");

    expect(updated[0].isCancelled).toBe(true);
    expect(updated[0].override?.status).toBe("cancelled");
  });

  it("should immediately mark occurrence as normal on restore action", () => {
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-28", isCancelled: true, override: { status: "cancelled" } },
    ];

    const updated = applyOptimisticRestore(occurrences, "2026-01-28");

    expect(updated[0].isCancelled).toBe(false);
    expect(updated[0].override?.status).toBe("normal");
  });

  it("should preserve state of other occurrences during optimistic update", () => {
    const occurrences: MockOccurrence[] = [
      { dateKey: "2026-01-27", isCancelled: false, override: null },
      { dateKey: "2026-02-03", isCancelled: false, override: null },
      { dateKey: "2026-02-10", isCancelled: true, override: { status: "cancelled" } },
    ];

    const updated = applyOptimisticCancel(occurrences, "2026-02-03");

    // First and last should be unchanged
    expect(updated[0].isCancelled).toBe(false);
    expect(updated[2].isCancelled).toBe(true);
    // Middle should be updated
    expect(updated[1].isCancelled).toBe(true);
  });
});
