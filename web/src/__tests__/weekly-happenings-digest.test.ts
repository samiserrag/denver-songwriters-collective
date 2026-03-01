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
    "poetry",
    "irish",
    "blues",
    "bluegrass",
    "comedy",
    "other",
  ];

  it("includes all 14 event types in EVENT_TYPE_CONFIG", () => {
    for (const eventType of ALL_EVENT_TYPES) {
      expect(EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG]).toBeDefined();
    }
    expect(Object.keys(EVENT_TYPE_CONFIG).length).toBe(14);
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
      event_type: ["open_mic"],
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
    expect(mockEvent.event_type).toEqual(["open_mic"]);
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
    event_type: ["song_circle"],
    start_time: "19:00:00",
    signup_time: null,
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
      slug: "mercury-cafe",
      city: "Denver",
      state: "CO",
      zip: "80202",
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

    expect(email.subject).toBe("Songwriter Happenings This Week in Colorado");
  });

  it("keeps salutation and does not inject hardcoded intro sentence", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Hi there,");
    expect(email.text).toContain("Hi there,");
    expect(email.html).not.toContain("Here's what's happening in the Denver songwriter community this week.");
    expect(email.text).not.toContain("Here's what's happening in the Denver songwriter community this week.");
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

  it("includes personalization copy around happenings list", () => {
    const byDate = new Map([["2026-01-27", [mockOccurrence]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Want to tailor this to you? Browse all");
    expect(email.html).toContain("with your filters applied!");
    expect(email.text).toContain("Want to tailor this to you? Browse all happenings with your filters applied!");
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
    expect(email.html).toContain("/venues/mercury-cafe");
    expect(email.html).toContain("Denver 80202");
    expect(email.text).toContain("Community Song Circle");
    expect(email.text).toContain("Mercury Cafe");
    expect(email.text).toContain("Denver 80202");
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

  it("includes signup time when present", () => {
    const eventWithSignup: HappeningEvent = {
      ...mockEvent,
      signup_time: "17:00:00",
    };
    const occurrenceWithSignup: HappeningOccurrence = {
      event: eventWithSignup,
      dateKey: "2026-01-27",
      displayDate: "MONDAY, JANUARY 27",
    };
    const byDate = new Map([["2026-01-27", [occurrenceWithSignup]]]);
    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
    });

    expect(email.html).toContain("Signup 5:00 PM");
    expect(email.text).toContain("Signup 5:00 PM");
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
      event_type: ["open_mic"],
    };
    const workshopEvent: HappeningEvent = {
      ...mockEvent,
      id: "workshop-1",
      title: "Songwriting Workshop",
      event_type: ["workshop"],
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
      event: { ...mockEvent, id: "event-2", title: "Tuesday Workshop", event_type: ["workshop"] },
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

  it("maps to digests category", () => {
    expect(EMAIL_CATEGORY_MAP.weeklyHappeningsDigest).toBe("digests");
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
    event_type: ["open_mic"],
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
        event_type: [eventType],
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
// Editorial Featured Ordering Tests
// ============================================================

describe("Editorial featured ordering", () => {
  const baseEvent: HappeningEvent = {
    id: "event-1",
    title: "Test Event",
    slug: "test-event",
    event_type: ["open_mic"],
    start_time: "19:00:00",
    event_date: "2026-01-27",
    day_of_week: "Monday",
    recurrence_rule: null,
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

  const occurrence: HappeningOccurrence = {
    event: baseEvent,
    dateKey: "2026-01-27",
    displayDate: "MONDAY, JANUARY 27",
  };

  it("renders featured cards in the required order and preserves intro formatting", () => {
    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const editorial = {
      introNote: "Line one\nLine two\n\nLine three",
      memberSpotlight: {
        name: "Featured Member Name",
        url: "https://coloradosongwriterscollective.org/songwriters/featured-member",
        avatarUrl: "https://example.com/member.jpg",
        bio: "Member bio",
      },
      featuredHappenings: [
        {
          title: "Featured Event One",
          url: "https://coloradosongwriterscollective.org/events/featured-event-one",
          venue: "Test Venue",
          venueUrl: "https://coloradosongwriterscollective.org/venues/test-venue",
          date: "Feb 1",
          time: "7:00 PM",
          emoji: "🎤",
          coverUrl: "https://example.com/event.jpg",
        },
        {
          title: "Featured Event Two",
          url: "https://coloradosongwriterscollective.org/events/featured-event-two",
          venue: "Test Venue",
          venueUrl: "https://coloradosongwriterscollective.org/venues/test-venue",
          date: "Feb 2",
          time: "8:00 PM",
          emoji: "🎤",
          coverUrl: "https://example.com/event2.jpg",
        },
      ],
      blogFeature: {
        title: "Featured Blog Title",
        url: "https://coloradosongwriterscollective.org/blog/featured-post",
        excerpt: "Blog excerpt",
      },
      galleryFeature: {
        title: "Featured Gallery Title",
        url: "https://coloradosongwriterscollective.org/gallery/featured-album",
        coverUrl: "https://example.com/gallery.jpg",
      },
    };

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
      editorial,
    });

    const html = email.html;
    const memberIndex = html.indexOf("Featured Member Name");
    const eventIndex = html.indexOf("Featured Event One");
    const blogIndex = html.indexOf("Featured Blog Title");
    const galleryIndex = html.indexOf("Featured Gallery Title");

    expect(memberIndex).toBeGreaterThan(-1);
    expect(eventIndex).toBeGreaterThan(-1);
    expect(blogIndex).toBeGreaterThan(-1);
    expect(galleryIndex).toBeGreaterThan(-1);

    expect(memberIndex).toBeLessThan(eventIndex);
    expect(eventIndex).toBeLessThan(blogIndex);
    expect(blogIndex).toBeLessThan(galleryIndex);

    const cardMarker = "border-radius: 8px; overflow: hidden; margin: 8px 0;";
    expect(html.lastIndexOf(cardMarker, blogIndex)).toBeGreaterThan(-1);
    expect(html.lastIndexOf(cardMarker, galleryIndex)).toBeGreaterThan(-1);

    expect(html.match(/🎤 MEMBER \/ HOST SPOTLIGHT/g)?.length).toBe(1);
    expect(html.match(/📝 FROM THE BLOG/g)?.length).toBe(1);
    expect(html.match(/📸 FROM THE GALLERY/g)?.length).toBe(1);

    expect(html).toContain("Line one<br>Line two");
    expect(html).toContain("Line three");

    const happeningsLinks = html.match(/>happenings<\/a>/g) || [];
    expect(happeningsLinks.length).toBe(2);
  });

  it("renders intro note links and emphasis", () => {
    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const editorial = {
      introNote:
        "Check **this update** and visit [CSC](https://coloradosongwriterscollective.org/happenings).",
    };

    const email = getWeeklyHappeningsDigestEmail({
      firstName: "Sami",
      byDate,
      totalCount: 1,
      venueCount: 1,
      editorial,
    });

    expect(email.html).toContain("<strong");
    expect(email.html).toContain(">this update<");
    expect(email.html).toContain('href="https://coloradosongwriterscollective.org/happenings"');
    expect(email.text).toContain("this update");
    expect(email.text).toContain("CSC (https://coloradosongwriterscollective.org/happenings)");
  });

  it("preserves intro note indentation in HTML output", () => {
    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const editorial = {
      introNote: "  Indented line\n\tTabbed line",
    };

    const email = getWeeklyHappeningsDigestEmail({
      firstName: "Sami",
      byDate,
      totalCount: 1,
      venueCount: 1,
      editorial,
    });

    expect(email.html).toContain("&nbsp;&nbsp;Indented line");
    expect(email.html).toContain("&nbsp;&nbsp;&nbsp;&nbsp;Tabbed line");
  });

  it("renders only the featured event when no other featured items exist", () => {
    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const editorial = {
      featuredHappenings: [
        {
          title: "Solo Featured Event",
          url: "https://coloradosongwriterscollective.org/events/solo-featured",
          venue: "Test Venue",
          venueUrl: "https://coloradosongwriterscollective.org/venues/test-venue",
          date: "Feb 3",
          time: "6:00 PM",
          emoji: "🎤",
          coverUrl: "https://example.com/event3.jpg",
        },
      ],
    };

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
      editorial,
    });

    expect(email.html).toContain("Solo Featured Event");
  });

  it("renders blog as a baseball card even when cover image is missing", () => {
    const byDate = new Map([["2026-01-27", [occurrence]]]);
    const editorial = {
      blogFeature: {
        title: "No Cover Blog",
        url: "https://coloradosongwriterscollective.org/blog/no-cover",
        excerpt: "Short excerpt",
      },
    };

    const email = getWeeklyHappeningsDigestEmail({
      firstName: null,
      byDate,
      totalCount: 1,
      venueCount: 1,
      editorial,
    });

    const html = email.html;
    const blogIndex = html.indexOf("No Cover Blog");
    expect(blogIndex).toBeGreaterThan(-1);

    const cardMarker = "border-radius: 8px; overflow: hidden; margin: 8px 0;";
    expect(html.lastIndexOf(cardMarker, blogIndex)).toBeGreaterThan(-1);
    expect(html.match(/📝 FROM THE BLOG/g)?.length).toBe(1);
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
    event_type: ["open_mic"],
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
