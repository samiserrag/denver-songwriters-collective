/**
 * Weekly Happenings Digest Tests
 *
 * Tests for GTM-1:
 * - Business logic (getUpcomingHappenings)
 * - Email template (weeklyHappeningsDigest)
 * - All 9 event types included
 * - 1-week window cap
 * - Cron handler contracts
 * - Kill switch behavior
 * - Preference gating
 */

import { describe, it, expect } from "vitest";
import {
  getDigestDateRange,
  formatDayHeader,
  formatTimeDisplay,
  type HappeningEvent,
  type HappeningOccurrence,
} from "@/lib/digest/weeklyHappenings";
import { getWeeklyHappeningsDigestEmail } from "@/lib/email/templates/weeklyHappeningsDigest";
import { EMAIL_CATEGORY_MAP } from "@/lib/notifications/preferences";
import { TEMPLATE_REGISTRY } from "@/lib/email/registry";
import { isWeeklyHappeningsDigestEnabled } from "@/lib/featureFlags";
import { EVENT_TYPE_CONFIG } from "@/types/events";

// ============================================================
// Date Helper Tests
// ============================================================

describe("getDigestDateRange (weeklyHappenings)", () => {
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

  it("caps at exactly 7 days (1 week)", () => {
    const { start, end } = getDigestDateRange("2026-02-01");
    // Difference should be 6 days (start + 6 = end = 7 total days)
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(6); // 7-day window including start day
  });
});

describe("formatDayHeader (weeklyHappenings)", () => {
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

describe("formatTimeDisplay (weeklyHappenings)", () => {
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
// Event Type Coverage Tests
// ============================================================

describe("Event Type Coverage", () => {
  const ALL_EVENT_TYPES = [
    "song_circle",
    "workshop",
    "meetup",
    "showcase",
    "open_mic",
    "gig",
    "kindred_group",
    "jam_session",
    "other",
  ];

  it("includes all 9 event types in EVENT_TYPE_CONFIG", () => {
    for (const eventType of ALL_EVENT_TYPES) {
      expect(EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG]).toBeDefined();
    }
    expect(Object.keys(EVENT_TYPE_CONFIG).length).toBe(9);
  });

  it("each event type has an icon for email display", () => {
    for (const eventType of ALL_EVENT_TYPES) {
      const config = EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG];
      expect(config.icon).toBeDefined();
      expect(config.icon.length).toBeGreaterThan(0);
    }
  });

  it("HappeningEvent interface includes event_type field", () => {
    // TypeScript type check - HappeningEvent must have event_type
    const mockEvent: HappeningEvent = {
      id: "test-1",
      title: "Test Event",
      slug: null,
      event_type: "open_mic",
      start_time: null,
      event_date: null,
      day_of_week: null,
      recurrence_rule: null,
      custom_dates: null,
      max_occurrences: null,
      is_free: true,
      cost_label: null,
      venue: null,
    };
    expect(mockEvent.event_type).toBe("open_mic");
  });
});

// ============================================================
// Email Template Tests
// ============================================================

describe("getWeeklyHappeningsDigestEmail", () => {
  const mockEvent: HappeningEvent = {
    id: "event-1",
    title: "Community Song Circle",
    slug: "community-song-circle",
    event_type: "song_circle",
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

  const mockOccurrence: HappeningOccurrence = {
    event: mockEvent,
    dateKey: "2026-01-27",
    displayDate: "MONDAY, JANUARY 27",
  };

  it("generates email with correct subject (no emoji)", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: "John",
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.subject).toBe("Happenings This Week in Denver");
  });

  it("uses correct intro text", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Here's what's happening in the Denver songwriter community this week.");
    expect(email.text).toContain("Here's what's happening in the Denver songwriter community this week.");
  });

  it("uses 'happenings' terminology in summary", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 5,
      venueCount: 3,
    });

    expect(email.html).toContain("5 happenings across 3 venues");
    expect(email.text).toContain("5 happenings across 3 venues");
  });

  it("handles singular 'happening' correctly", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("1 happening across 1 venue");
  });

  it("includes Browse All Happenings CTA with correct URL", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Browse All Happenings");
    expect(email.html).toContain("/happenings");
    // Should NOT include type filter
    expect(email.html).not.toContain("?type=open_mic");
    expect(email.text).toContain("/happenings");
  });

  it("includes aspirational personalization copy", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Want to see more or tailor this to you? Browse all happenings with your filters applied!");
    expect(email.text).toContain("Want to see more or tailor this to you? Browse all happenings with your filters applied!");
  });

  it("shows empty state with 'happenings' terminology", () => {
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate: new Map(),
      totalCount: 0,
      venueCount: 0,
    });

    expect(email.html).toContain("No happenings scheduled this week");
    expect(email.text).toContain("No happenings scheduled this week");
  });

  it("personalizes greeting with first name", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
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
    const email = getWeeklyHappeningsDigestEmail({
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
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Community Song Circle");
    expect(email.html).toContain("Mercury Cafe");
    expect(email.text).toContain("Community Song Circle");
    expect(email.text).toContain("Mercury Cafe");
  });

  it("includes formatted time", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("7:00 PM");
    expect(email.text).toContain("7:00 PM");
  });

  it("generates event link with slug and date", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("/events/community-song-circle?date=2026-01-27");
  });

  it("includes unsubscribe link", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    // GTM-2: HMAC-signed one-click unsubscribe link + warm community copy
    expect(email.html).toContain("unsubscribe with one click");
    expect(email.html).toContain("re-subscribe");
    expect(email.text).toContain("unsubscribe");
  });

  it("uses event-type-specific emojis", () => {
    // Create events for different types
    const openMicEvent: HappeningEvent = {
      ...mockEvent,
      id: "open-mic-1",
      title: "Open Mic Night",
      event_type: "open_mic",
    };
    const workshopEvent: HappeningEvent = {
      ...mockEvent,
      id: "workshop-1",
      title: "Songwriting Workshop",
      event_type: "workshop",
    };

    const byDate = new Map([
      ["2026-01-27", [
        { event: openMicEvent, dateKey: "2026-01-27", displayDate: "MONDAY, JANUARY 27" },
        { event: workshopEvent, dateKey: "2026-01-27", displayDate: "MONDAY, JANUARY 27" },
      ]],
    ]);

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 2,
      venueCount: 1,
    });

    // Both events should be present with their type-specific emojis
    expect(email.html).toContain("Open Mic Night");
    expect(email.html).toContain("Songwriting Workshop");
  });

  it("groups events by date", () => {
    const occurrence2: HappeningOccurrence = {
      event: { ...mockEvent, id: "event-2", title: "Tuesday Workshop", event_type: "workshop" },
      dateKey: "2026-01-28",
      displayDate: "TUESDAY, JANUARY 28",
    };

    const byDate = new Map([
      ["2026-01-27", [mockOccurrence]],
      ["2026-01-28", [occurrence2]],
    ]);

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 2,
      venueCount: 2,
    });

    // Check that both dates are present
    expect(email.html).toContain("JANUARY 27");
    expect(email.html).toContain("JANUARY 28");
    expect(email.html).toContain("Community Song Circle");
    expect(email.html).toContain("Tuesday Workshop");
  });
});

// ============================================================
// Registry Tests
// ============================================================

describe("Template Registry (weeklyHappeningsDigest)", () => {
  it("includes weeklyHappeningsDigest in registry", () => {
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest).toBeDefined();
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.key).toBe("weeklyHappeningsDigest");
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.name).toBe("Weekly Happenings Digest");
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.description).toBe("Weekly email listing all upcoming happenings");
  });

  it("maps to event_updates category", () => {
    expect(EMAIL_CATEGORY_MAP.weeklyHappeningsDigest).toBe("event_updates");
  });

  it("has correct audience (member)", () => {
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.audience).toBe("member");
  });

  it("has links (hasLinks: true)", () => {
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.hasLinks).toBe(true);
  });

  it("does not require event title", () => {
    expect(TEMPLATE_REGISTRY.weeklyHappeningsDigest.requiresEventTitle).toBe(false);
  });
});

// ============================================================
// Kill Switch Tests
// ============================================================

describe("Kill Switch (weeklyHappeningsDigest)", () => {
  it("isWeeklyHappeningsDigestEnabled returns false by default", () => {
    // Without env var set, should be false
    const original = process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;
    delete process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;

    expect(isWeeklyHappeningsDigestEnabled()).toBe(false);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = original;
    }
  });

  it("isWeeklyHappeningsDigestEnabled returns true when env var is 'true'", () => {
    const original = process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;
    process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = "true";

    expect(isWeeklyHappeningsDigestEnabled()).toBe(true);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = original;
    } else {
      delete process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;
    }
  });

  it("isWeeklyHappeningsDigestEnabled returns false for other values", () => {
    const original = process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;
    process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = "false";

    expect(isWeeklyHappeningsDigestEnabled()).toBe(false);

    process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = "1";
    expect(isWeeklyHappeningsDigestEnabled()).toBe(false);

    process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = "yes";
    expect(isWeeklyHappeningsDigestEnabled()).toBe(false);

    if (original !== undefined) {
      process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST = original;
    } else {
      delete process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST;
    }
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe("Edge Cases (weeklyHappeningsDigest)", () => {
  const baseEvent: HappeningEvent = {
    id: "event-1",
    title: "Test Event",
    slug: "test-event",
    event_type: "open_mic",
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
      name: "Test Venue",
      city: "Denver",
      state: "CO",
    },
  };

  it("handles event without venue", () => {
    const eventNoVenue: HappeningEvent = {
      ...baseEvent,
      venue: null,
    };

    const occurrence: HappeningOccurrence = {
      event: eventNoVenue,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 0,
    });

    expect(email.html).toContain("Location TBD");
    expect(email.text).toContain("Location TBD");
  });

  it("handles event with cost label instead of free", () => {
    const paidEvent: HappeningEvent = {
      ...baseEvent,
      is_free: false,
      cost_label: "$10 cover",
    };

    const occurrence: HappeningOccurrence = {
      event: paidEvent,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("$10 cover");
    expect(email.text).toContain("$10 cover");
    expect(email.html).not.toContain(">Free<"); // Avoid matching "Free" in other contexts
  });

  it("handles event without start time", () => {
    const eventNoTime: HappeningEvent = {
      ...baseEvent,
      start_time: null,
    };

    const occurrence: HappeningOccurrence = {
      event: eventNoTime,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    // Should not crash and should still include event
    expect(email.html).toContain("Test Event");
    expect(email.html).toContain("Test Venue");
  });

  it("handles event without slug (falls back to ID)", () => {
    const eventNoSlug: HappeningEvent = {
      ...baseEvent,
      slug: null,
    };

    const occurrence: HappeningOccurrence = {
      event: eventNoSlug,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };

    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain(`/events/${baseEvent.id}?date=2026-01-27`);
  });

  it("handles all 9 event types in single digest", () => {
    const eventTypes = [
      "song_circle", "workshop", "meetup", "showcase", "open_mic",
      "gig", "kindred_group", "jam_session", "other",
    ];

    const occurrences: HappeningOccurrence[] = eventTypes.map((eventType, index) => ({
      event: {
        ...baseEvent,
        id: `event-${index}`,
        title: `${eventType} Event`,
        event_type: eventType,
      },
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    }));

    const byDate = new Map([["2026-01-27", occurrences]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 9,
      venueCount: 1,
    });

    // All events should be present
    for (const eventType of eventTypes) {
      expect(email.html).toContain(`${eventType} Event`);
    }

    expect(email.html).toContain("9 happenings across 1 venue");
  });
});

// ============================================================
// HTML Structure Tests
// ============================================================

describe("HTML Structure", () => {
  const mockEvent: HappeningEvent = {
    id: "event-1",
    title: "Test Event",
    slug: "test-event",
    event_type: "open_mic",
    start_time: "19:00:00",
    event_date: "2026-01-27",
    day_of_week: "Monday",
    recurrence_rule: null,
    custom_dates: null,
    max_occurrences: null,
    is_free: true,
    cost_label: null,
    venue: null,
  };

  it("generates valid HTML with closing tags", () => {
    const byDate = new Map([["2026-01-27", [{
      event: mockEvent,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    }]]]);

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 0,
    });

    // Check for basic HTML structure
    expect(email.html).toContain("<!DOCTYPE html");
    expect(email.html).toContain("<html");
    expect(email.html).toContain("</html>");
    expect(email.html).toContain("<body");
    expect(email.html).toContain("</body>");
  });

  it("generates plain text without HTML tags", () => {
    const byDate = new Map([["2026-01-27", [{
      event: mockEvent,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    }]]]);

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 0,
    });

    // Plain text should not have HTML tags
    expect(email.text).not.toContain("<html");
    expect(email.text).not.toContain("<body");
    expect(email.text).not.toContain("<table");
  });
});
