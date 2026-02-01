/**
 * Weekly Open Mics Digest Tests
 *
 * Tests for:
 * - Business logic (getUpcomingOpenMics)
 * - Email template (weeklyOpenMicsDigest)
 * - Cron handler contracts
 * - Preference gating
 */

import { describe, it, expect } from "vitest";
import {
  getDigestDateRange,
  formatDayHeader,
  formatTimeDisplay,
  type OpenMicEvent,
  type OpenMicOccurrence,
} from "@/lib/digest/weeklyOpenMics";
import { getWeeklyOpenMicsDigestEmail } from "@/lib/email/templates/weeklyOpenMicsDigest";
import { EMAIL_CATEGORY_MAP } from "@/lib/notifications/preferences";
import { TEMPLATE_REGISTRY } from "@/lib/email/registry";
import { isWeeklyDigestEnabled } from "@/lib/featureFlags";

// ============================================================
// Date Helper Tests
// ============================================================

describe("getDigestDateRange", () => {
  it("returns 7-day window (Sunday through Saturday)", () => {
    const { start, end } = getDigestDateRange("2026-01-25"); // Sunday
    expect(start).toBe("2026-01-25");
    expect(end).toBe("2026-01-31"); // 6 days later = Saturday
  });

  it("handles month boundary", () => {
    const { start, end } = getDigestDateRange("2026-01-29"); // Thursday
    expect(start).toBe("2026-01-29");
    expect(end).toBe("2026-02-04");
  });

  it("handles year boundary", () => {
    const { start, end } = getDigestDateRange("2025-12-29"); // Monday
    expect(start).toBe("2025-12-29");
    expect(end).toBe("2026-01-04");
  });
});

describe("formatDayHeader", () => {
  it("formats date as uppercase day and date", () => {
    const result = formatDayHeader("2026-01-27");
    // 2026-01-27 is a Tuesday
    expect(result).toMatch(/^TUESDAY, JANUARY 27$/i);
  });

  it("handles month boundary dates", () => {
    const result = formatDayHeader("2026-02-01");
    expect(result).toMatch(/^SUNDAY, FEBRUARY 1$/i);
  });
});

describe("formatTimeDisplay", () => {
  it("formats morning time", () => {
    expect(formatTimeDisplay("09:00:00")).toBe("9:00 AM");
  });

  it("formats afternoon time", () => {
    expect(formatTimeDisplay("14:30:00")).toBe("2:30 PM");
  });

  it("formats evening time", () => {
    expect(formatTimeDisplay("19:00:00")).toBe("7:00 PM");
  });

  it("formats noon", () => {
    expect(formatTimeDisplay("12:00:00")).toBe("12:00 PM");
  });

  it("formats midnight", () => {
    expect(formatTimeDisplay("00:00:00")).toBe("12:00 AM");
  });

  it("handles null", () => {
    expect(formatTimeDisplay(null)).toBe("");
  });

  it("handles HH:MM format without seconds", () => {
    expect(formatTimeDisplay("19:00")).toBe("7:00 PM");
  });
});

// ============================================================
// Email Template Tests
// ============================================================

describe("getWeeklyOpenMicsDigestEmail", () => {
  const mockEvent: OpenMicEvent = {
    id: "event-1",
    title: "Words Open Mic",
    slug: "words-open-mic",
    start_time: "19:00:00",
    event_date: "2026-01-27",
    day_of_week: "Monday",
    recurrence_rule: "weekly",
    custom_dates: null,
    max_occurrences: null,
    is_free: true,
    cost_label: null,
    venue: {
      id: "venue-1",
      name: "Mercury Cafe",
      city: "Denver",
      state: "CO",
    },
  };

  const mockOccurrence: OpenMicOccurrence = {
    event: mockEvent,
    dateKey: "2026-01-27",
    displayDate: "MONDAY, JANUARY 27",
  };

  it("generates email with correct subject", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: "John",
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.subject).toBe("🎤 Open Mics This Week in Denver");
  });

  it("personalizes greeting with first name", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: "Sarah",
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Hi Sarah,");
    expect(email.text).toContain("Hi Sarah,");
  });

  it("uses fallback greeting when no first name", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Hi there,");
    expect(email.text).toContain("Hi there,");
  });

  it("includes event title and venue", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Words Open Mic");
    expect(email.html).toContain("Mercury Cafe");
    expect(email.text).toContain("Words Open Mic");
    expect(email.text).toContain("Mercury Cafe");
  });

  it("includes formatted time", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("7:00 PM");
    expect(email.text).toContain("7:00 PM");
  });

  it("shows Free for free events", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Free");
    expect(email.text).toContain("Free");
  });

  it("generates event link with slug and date", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("/events/words-open-mic?date=2026-01-27");
  });

  it("falls back to event ID when no slug", () => {
    const eventNoSlug: OpenMicEvent = { ...mockEvent, slug: null };
    const occurrenceNoSlug: OpenMicOccurrence = {
      ...mockOccurrence,
      event: eventNoSlug,
    };
    const byDate = new Map([["2026-01-27", [occurrenceNoSlug]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain(`/events/${mockEvent.id}?date=2026-01-27`);
  });

  it("shows empty state when no open mics", () => {
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate: new Map(),
      totalCount: 0,
      venueCount: 0,
    });

    expect(email.html).toContain("No open mics scheduled this week");
    expect(email.text).toContain("No open mics scheduled this week");
  });

  it("includes summary line with count", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 5,
      venueCount: 3,
    });

    expect(email.html).toContain("5 open mics across 3 venues");
    expect(email.text).toContain("5 open mics across 3 venues");
  });

  it("handles singular count correctly", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("1 open mic across 1 venue");
  });

  it("includes unsubscribe link", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("/dashboard/settings");
    expect(email.html).toContain("Manage your email preferences");
    expect(email.text).toContain("/dashboard/settings");
  });

  it("includes Browse All Open Mics CTA", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Browse All Open Mics");
    expect(email.html).toContain("/happenings?type=open_mic");
    expect(email.text).toContain("/happenings?type=open_mic");
  });

  it("groups events by date", () => {
    const occurrence2: OpenMicOccurrence = {
      event: { ...mockEvent, id: "event-2", title: "Second Open Mic" },
      dateKey: "2026-01-28",
      displayDate: "TUESDAY, JANUARY 28",
    };

    const byDate = new Map([
      ["2026-01-27", [mockOccurrence]],
      ["2026-01-28", [occurrence2]],
    ]);

    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 2,
      venueCount: 2,
    });

    // Check that both dates are present
    expect(email.html).toContain("JANUARY 27");
    expect(email.html).toContain("JANUARY 28");
    expect(email.html).toContain("Words Open Mic");
    expect(email.html).toContain("Second Open Mic");
  });
});

// ============================================================
// Registry Tests
// ============================================================

describe("Template Registry", () => {
  it("includes weeklyOpenMicsDigest in registry", () => {
    expect(TEMPLATE_REGISTRY.weeklyOpenMicsDigest).toBeDefined();
    expect(TEMPLATE_REGISTRY.weeklyOpenMicsDigest.key).toBe("weeklyOpenMicsDigest");
    expect(TEMPLATE_REGISTRY.weeklyOpenMicsDigest.name).toBe("Weekly Open Mics Digest");
  });

  it("maps to event_updates category", () => {
    expect(EMAIL_CATEGORY_MAP.weeklyOpenMicsDigest).toBe("event_updates");
  });
});

// ============================================================
// Feature Flag Tests
// ============================================================

describe("Kill Switch", () => {
  it("isWeeklyDigestEnabled returns false by default", () => {
    // Without env var set, should be false
    const original = process.env.ENABLE_WEEKLY_DIGEST;
    delete process.env.ENABLE_WEEKLY_DIGEST;

    expect(isWeeklyDigestEnabled()).toBe(false);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_DIGEST = original;
    }
  });

  it("isWeeklyDigestEnabled returns true when env var is 'true'", () => {
    const original = process.env.ENABLE_WEEKLY_DIGEST;
    process.env.ENABLE_WEEKLY_DIGEST = "true";

    expect(isWeeklyDigestEnabled()).toBe(true);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_DIGEST = original;
    } else {
      delete process.env.ENABLE_WEEKLY_DIGEST;
    }
  });

  it("isWeeklyDigestEnabled returns false for other values", () => {
    const original = process.env.ENABLE_WEEKLY_DIGEST;
    process.env.ENABLE_WEEKLY_DIGEST = "false";

    expect(isWeeklyDigestEnabled()).toBe(false);

    process.env.ENABLE_WEEKLY_DIGEST = "1";
    expect(isWeeklyDigestEnabled()).toBe(false);

    process.env.ENABLE_WEEKLY_DIGEST = "yes";
    expect(isWeeklyDigestEnabled()).toBe(false);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_DIGEST = original;
    } else {
      delete process.env.ENABLE_WEEKLY_DIGEST;
    }
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe("Edge Cases", () => {
  it("handles event without venue", () => {
    const eventNoVenue: OpenMicEvent = {
      id: "event-1",
      title: "Words Open Mic",
      slug: "words-open-mic",
      start_time: "19:00:00",
      event_date: "2026-01-27",
      day_of_week: "Monday",
      recurrence_rule: "weekly",
      custom_dates: null,
      max_occurrences: null,
      is_free: true,
      cost_label: null,
      venue: null,
    };

    const occurrence: OpenMicOccurrence = {
      event: eventNoVenue,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 0,
    });

    expect(email.html).toContain("Location TBD");
    expect(email.text).toContain("Location TBD");
  });

  it("handles event with cost label instead of free", () => {
    const paidEvent: OpenMicEvent = {
      id: "event-1",
      title: "Premium Open Mic",
      slug: "premium-open-mic",
      start_time: "20:00:00",
      event_date: "2026-01-27",
      day_of_week: "Monday",
      recurrence_rule: "weekly",
      custom_dates: null,
      max_occurrences: null,
      is_free: false,
      cost_label: "$10 cover",
      venue: {
        id: "venue-1",
        name: "The Club",
        city: "Denver",
        state: "CO",
      },
    };

    const occurrence: OpenMicOccurrence = {
      event: paidEvent,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("$10 cover");
    expect(email.text).toContain("$10 cover");
    expect(email.html).not.toContain("Free");
  });

  it("handles event without start time", () => {
    const eventNoTime: OpenMicEvent = {
      id: "event-1",
      title: "TBD Open Mic",
      slug: null,
      start_time: null,
      event_date: "2026-01-27",
      day_of_week: "Monday",
      recurrence_rule: "weekly",
      custom_dates: null,
      max_occurrences: null,
      is_free: true,
      cost_label: null,
      venue: {
        id: "venue-1",
        name: "Some Venue",
        city: "Denver",
        state: "CO",
      },
    };

    const occurrence: OpenMicOccurrence = {
      event: eventNoTime,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyOpenMicsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    // Should not crash and should still include event
    expect(email.html).toContain("TBD Open Mic");
    expect(email.html).toContain("Some Venue");
  });
});
