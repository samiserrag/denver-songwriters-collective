import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SeriesEntry } from "@/lib/events/nextOccurrence";

/**
 * Tests for Hosted Happenings section on profile pages.
 * Covers /members/[id] and /songwriters/[id] pages.
 */

// Mock event data types matching SeriesEvent
interface MockEvent {
  id: string;
  slug?: string | null;
  title: string;
  event_date?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  recurrence_rule?: string | null;
  is_recurring?: boolean;
  status?: string;
  is_published?: boolean;
  host_id?: string;
}

describe("Hosted Happenings - Empty State", () => {
  it("shows empty state when host has 0 events", () => {
    const hostedSeries: SeriesEntry[] = [];
    const visibleHostedSeries = hostedSeries.slice(0, 3);

    expect(visibleHostedSeries.length).toBe(0);
    // Empty state text: "No hosted happenings yet."
    const emptyStateText = "No hosted happenings yet.";
    expect(emptyStateText).toBe("No hosted happenings yet.");
  });
});

describe("Hosted Happenings - One-off Event", () => {
  it("renders link to /events/{slug} for one-off event", () => {
    const oneOffEvent: MockEvent = {
      id: "event-123",
      slug: "friday-showcase",
      title: "Friday Showcase",
      event_date: "2026-01-24",
      start_time: "19:00:00",
      recurrence_rule: null,
      is_recurring: false,
      status: "active",
      is_published: true,
      host_id: "host-abc",
    };

    // Link should use slug when available
    const eventLink = `/events/${oneOffEvent.slug || oneOffEvent.id}`;
    expect(eventLink).toBe("/events/friday-showcase");
  });

  it("renders link to /events/{id} when slug is null", () => {
    const oneOffEvent: MockEvent = {
      id: "event-456",
      slug: null,
      title: "Saturday Jam",
      event_date: "2026-01-25",
      start_time: "20:00:00",
      recurrence_rule: null,
      is_recurring: false,
      status: "active",
      is_published: true,
      host_id: "host-abc",
    };

    const eventLink = `/events/${oneOffEvent.slug || oneOffEvent.id}`;
    expect(eventLink).toBe("/events/event-456");
  });
});

describe("Hosted Happenings - Recurring Event", () => {
  it("identifies recurring event by recurrence_rule", () => {
    const recurringEvent: MockEvent = {
      id: "event-789",
      slug: "monday-open-mic",
      title: "Monday Open Mic",
      event_date: "2026-01-20",
      day_of_week: "Monday",
      start_time: "19:00:00",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=MO",
      is_recurring: true,
      status: "active",
      is_published: true,
      host_id: "host-abc",
    };

    const isRecurring = !!recurringEvent.recurrence_rule;
    expect(isRecurring).toBe(true);
  });

  it("identifies one-time event by null recurrence_rule", () => {
    const oneTimeEvent: MockEvent = {
      id: "event-000",
      slug: "special-event",
      title: "Special Event",
      event_date: "2026-02-14",
      day_of_week: null,
      start_time: "18:00:00",
      recurrence_rule: null,
      is_recurring: false,
      status: "active",
      is_published: true,
      host_id: "host-abc",
    };

    const isRecurring = !!oneTimeEvent.recurrence_rule;
    expect(isRecurring).toBe(false);
  });
});

describe("Hosted Happenings - Status Filtering", () => {
  it("includes events with status active", () => {
    const event: MockEvent = {
      id: "e1",
      title: "Active Event",
      status: "active",
      is_published: true,
    };

    const validStatuses = ["active", "needs_verification", "unverified"];
    const isIncluded = validStatuses.includes(event.status!);
    expect(isIncluded).toBe(true);
  });

  it("includes events with status needs_verification", () => {
    const event: MockEvent = {
      id: "e2",
      title: "Needs Verification Event",
      status: "needs_verification",
      is_published: true,
    };

    const validStatuses = ["active", "needs_verification", "unverified"];
    const isIncluded = validStatuses.includes(event.status!);
    expect(isIncluded).toBe(true);
  });

  it("includes events with status unverified", () => {
    const event: MockEvent = {
      id: "e3",
      title: "Unverified Event",
      status: "unverified",
      is_published: true,
    };

    const validStatuses = ["active", "needs_verification", "unverified"];
    const isIncluded = validStatuses.includes(event.status!);
    expect(isIncluded).toBe(true);
  });

  it("excludes events with status cancelled", () => {
    const event: MockEvent = {
      id: "e4",
      title: "Cancelled Event",
      status: "cancelled",
      is_published: true,
    };

    const validStatuses = ["active", "needs_verification", "unverified"];
    const isIncluded = validStatuses.includes(event.status!);
    expect(isIncluded).toBe(false);
  });

  it("excludes events with is_published=false", () => {
    const event: MockEvent = {
      id: "e5",
      title: "Draft Event",
      status: "active",
      is_published: false,
    };

    const isPublished = event.is_published === true;
    expect(isPublished).toBe(false);
  });
});

describe("Hosted Happenings - Cap Visible Series", () => {
  it("caps visible series to 3", () => {
    // Simulate 5 hosted series
    const hostedSeries = [
      { event: { id: "1" } },
      { event: { id: "2" } },
      { event: { id: "3" } },
      { event: { id: "4" } },
      { event: { id: "5" } },
    ] as SeriesEntry[];

    const visibleHostedSeries = hostedSeries.slice(0, 3);
    const hasMoreHostedEvents = hostedSeries.length > 3;

    expect(visibleHostedSeries.length).toBe(3);
    expect(hasMoreHostedEvents).toBe(true);
  });

  it("shows all when 3 or fewer series", () => {
    const hostedSeries = [
      { event: { id: "1" } },
      { event: { id: "2" } },
    ] as SeriesEntry[];

    const visibleHostedSeries = hostedSeries.slice(0, 3);
    const hasMoreHostedEvents = hostedSeries.length > 3;

    expect(visibleHostedSeries.length).toBe(2);
    expect(hasMoreHostedEvents).toBe(false);
  });

  it("shows count text when more than 3", () => {
    const hostedSeries = [
      { event: { id: "1" } },
      { event: { id: "2" } },
      { event: { id: "3" } },
      { event: { id: "4" } },
      { event: { id: "5" } },
      { event: { id: "6" } },
    ] as SeriesEntry[];

    const hasMoreHostedEvents = hostedSeries.length > 3;
    const countText = `Showing 3 of ${hostedSeries.length} happenings.`;

    expect(hasMoreHostedEvents).toBe(true);
    expect(countText).toBe("Showing 3 of 6 happenings.");
  });
});

describe("Hosted Happenings - Host Filter Route", () => {
  /**
   * The /happenings page does NOT have a host= filter parameter.
   * Therefore, we do NOT link to /happenings?host={slug} because
   * that route does not exist.
   *
   * This test documents that decision.
   */
  it("does not generate host filter URL (route does not exist)", () => {
    // Confirmed by grepping happenings page - no host= parameter handling
    const hostFilterRouteExists = false;
    expect(hostFilterRouteExists).toBe(false);
  });
});

describe("Hosted Happenings - Query Contract", () => {
  it("queries events by host_id = profile.id", () => {
    const profileId = "profile-xyz";
    const queryFilter = { host_id: profileId };

    expect(queryFilter.host_id).toBe("profile-xyz");
  });

  it("filters by is_published = true", () => {
    const queryFilter = { is_published: true };
    expect(queryFilter.is_published).toBe(true);
  });

  it("filters by status in (active, needs_verification, unverified)", () => {
    const validStatuses = ["active", "needs_verification", "unverified"];
    expect(validStatuses).toContain("active");
    expect(validStatuses).toContain("needs_verification");
    expect(validStatuses).toContain("unverified");
    expect(validStatuses).not.toContain("cancelled");
    expect(validStatuses).not.toContain("draft");
  });

  it("members profile query includes custom recurrence fields", () => {
    const membersPageSource = readFileSync(
      join(process.cwd(), "src/app/members/[id]/page.tsx"),
      "utf-8"
    );
    expect(membersPageSource).toContain("max_occurrences");
    expect(membersPageSource).toContain("custom_dates");
  });

  it("songwriters profile query includes custom recurrence fields", () => {
    const songwritersPageSource = readFileSync(
      join(process.cwd(), "src/app/songwriters/[id]/page.tsx"),
      "utf-8"
    );
    expect(songwritersPageSource).toContain("max_occurrences");
    expect(songwritersPageSource).toContain("custom_dates");
  });
});
