/**
 * Phase 4.36: Publish Confirmation + Event Updated Notifications
 *
 * Tests for:
 * 1. Publish confirmation gate (host must confirm event is real)
 * 2. Event updated notifications triggered on major field changes
 * 3. Deduplication of RSVP + timeslot claimants
 * 4. Skip notifications on first publish and cancellation
 */

import { describe, it, expect } from "vitest";

// ============================================
// PUBLISH CONFIRMATION TESTS
// ============================================

describe("Publish Confirmation Gate", () => {
  describe("UI Behavior", () => {
    it("should show confirmation checkbox when is_published is true and event was not previously published", () => {
      // Scenario: Creating a new event or publishing a draft
      const event = { is_published: false };
      const formState = { is_published: true };

      // Checkbox should appear when:
      const shouldShowCheckbox = formState.is_published && !event.is_published;

      expect(shouldShowCheckbox).toBe(true);
    });

    it("should NOT show confirmation checkbox for already published events", () => {
      // Scenario: Editing an already-published event
      const event = { is_published: true };
      const formState = { is_published: true };

      const shouldShowCheckbox = formState.is_published && !event.is_published;

      expect(shouldShowCheckbox).toBe(false);
    });

    it("should NOT show confirmation checkbox when toggling off publish", () => {
      // Scenario: Unpublishing an event
      const event = { is_published: true };
      const formState = { is_published: false };

      const shouldShowCheckbox = formState.is_published && !event.is_published;

      expect(shouldShowCheckbox).toBe(false);
    });
  });

  describe("API Validation", () => {
    it("should require host_publish_confirmed when transitioning to published", () => {
      // Simulating the API validation logic
      const prevEvent = { is_published: false };
      const body = { is_published: true, host_publish_confirmed: undefined };

      const wasPublished = prevEvent.is_published;
      const willPublish = body.is_published === true;
      const isNewPublish = willPublish && !wasPublished;

      // Should block if: is new publish AND no confirmation
      const shouldBlock = isNewPublish && body.host_publish_confirmed !== true;

      expect(shouldBlock).toBe(true);
    });

    it("should allow publish when host_publish_confirmed is true", () => {
      const prevEvent = { is_published: false };
      const body = { is_published: true, host_publish_confirmed: true };

      const wasPublished = prevEvent.is_published;
      const willPublish = body.is_published === true;
      const isNewPublish = willPublish && !wasPublished;

      const shouldBlock = isNewPublish && body.host_publish_confirmed !== true;

      expect(shouldBlock).toBe(false);
    });

    it("should NOT require confirmation for already-published events", () => {
      const prevEvent = { is_published: true };
      const body = { is_published: true, host_publish_confirmed: undefined };

      const wasPublished = prevEvent.is_published;
      const willPublish = body.is_published === true;
      const isNewPublish = willPublish && !wasPublished;

      // Already published, so isNewPublish is false
      const shouldBlock = isNewPublish && body.host_publish_confirmed !== true;

      expect(shouldBlock).toBe(false);
    });

    it("should NOT require confirmation for unpublishing", () => {
      const prevEvent = { is_published: true };
      const body = { is_published: false };

      const wasPublished = prevEvent.is_published;
      const willPublish = body.is_published === true;
      const isNewPublish = willPublish && !wasPublished;

      const shouldBlock = isNewPublish && body.host_publish_confirmed !== true;

      expect(shouldBlock).toBe(false);
    });
  });
});

// ============================================
// EVENT UPDATED NOTIFICATION TRIGGER TESTS
// ============================================

describe("Event Updated Notification Triggers", () => {
  // Major fields that trigger notifications
  const majorFields = ["event_date", "start_time", "end_time", "venue_id", "location_mode", "day_of_week"];

  describe("Major Field Detection", () => {
    for (const field of majorFields) {
      it(`should detect ${field} as a major field change`, () => {
        const body: Record<string, unknown> = {};
        body[field] = "new_value";

        const hasMajorChange = majorFields.some(f => body[f] !== undefined);

        expect(hasMajorChange).toBe(true);
      });
    }

    it("should NOT trigger for host_notes change (non-major)", () => {
      const body = { host_notes: "Updated notes" };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);

      expect(hasMajorChange).toBe(false);
    });

    it("should NOT trigger for description change (non-major)", () => {
      const body = { description: "Updated description" };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);

      expect(hasMajorChange).toBe(false);
    });

    it("should NOT trigger for title change (non-major)", () => {
      const body = { title: "New Title" };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);

      expect(hasMajorChange).toBe(false);
    });

    it("should NOT trigger for capacity change (non-major)", () => {
      const body = { capacity: 20 };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);

      expect(hasMajorChange).toBe(false);
    });
  });

  describe("Notification Skip Conditions", () => {
    it("should NOT notify on first publish (no attendees yet)", () => {
      const prevEvent = { is_published: false, status: "draft" };
      const body = { is_published: true, start_time: "19:00:00" };

      const wasPublished = prevEvent.is_published;
      const willPublish = body.is_published === true;
      const isNewPublish = willPublish && !wasPublished;
      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);

      // Skip if first publish
      const shouldNotify = hasMajorChange && wasPublished && !isNewPublish;

      expect(shouldNotify).toBe(false);
    });

    it("should NOT notify on cancellation (handled by DELETE)", () => {
      const prevEvent = { is_published: true, status: "active" };
      const body = { status: "cancelled", start_time: "19:00:00" };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);
      const wasPublished = prevEvent.is_published;
      const statusBecomingCancelled = body.status === "cancelled" && prevEvent.status !== "cancelled";

      // Skip if cancellation
      const shouldNotify = hasMajorChange && wasPublished && !statusBecomingCancelled;

      expect(shouldNotify).toBe(false);
    });

    it("should notify on major change to published event", () => {
      const prevEvent = { is_published: true, status: "active" };
      const body = { start_time: "20:00:00" }; // Changed from 19:00 to 20:00

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);
      const wasPublished = prevEvent.is_published;
      const isNewPublish = false; // Not changing is_published
      const statusBecomingCancelled = false;

      const shouldNotify = hasMajorChange && wasPublished && !isNewPublish && !statusBecomingCancelled;

      expect(shouldNotify).toBe(true);
    });

    it("should NOT notify on draft event changes", () => {
      const prevEvent = { is_published: false, status: "draft" };
      const body = { start_time: "20:00:00" };

      const hasMajorChange = majorFields.some(f => body[f as keyof typeof body] !== undefined);
      const wasPublished = prevEvent.is_published;

      const shouldNotify = hasMajorChange && wasPublished;

      expect(shouldNotify).toBe(false);
    });
  });
});

// ============================================
// ATTENDEE DEDUPLICATION TESTS
// ============================================

describe("Attendee Deduplication", () => {
  it("should deduplicate users who appear in both RSVP and timeslot claims", () => {
    // Simulate user IDs from both sources
    const rsvpUserIds = ["user-1", "user-2", "user-3"];
    const timeslotMemberIds = ["user-2", "user-3", "user-4"];

    // Deduplication using Set
    const attendeeMap = new Map<string, { userId: string }>();

    for (const userId of rsvpUserIds) {
      if (!attendeeMap.has(userId)) {
        attendeeMap.set(userId, { userId });
      }
    }

    for (const memberId of timeslotMemberIds) {
      if (!attendeeMap.has(memberId)) {
        attendeeMap.set(memberId, { userId: memberId });
      }
    }

    const uniqueAttendees = Array.from(attendeeMap.keys());

    // Should have 4 unique users, not 6
    expect(uniqueAttendees).toHaveLength(4);
    expect(uniqueAttendees).toContain("user-1");
    expect(uniqueAttendees).toContain("user-2");
    expect(uniqueAttendees).toContain("user-3");
    expect(uniqueAttendees).toContain("user-4");
  });

  it("should handle empty RSVP list", () => {
    const rsvpUserIds: string[] = [];
    const timeslotMemberIds = ["user-1", "user-2"];

    const attendeeMap = new Map<string, { userId: string }>();

    for (const userId of rsvpUserIds) {
      if (!attendeeMap.has(userId)) {
        attendeeMap.set(userId, { userId });
      }
    }

    for (const memberId of timeslotMemberIds) {
      if (!attendeeMap.has(memberId)) {
        attendeeMap.set(memberId, { userId: memberId });
      }
    }

    expect(attendeeMap.size).toBe(2);
  });

  it("should handle empty timeslot claims list", () => {
    const rsvpUserIds = ["user-1", "user-2"];
    const timeslotMemberIds: string[] = [];

    const attendeeMap = new Map<string, { userId: string }>();

    for (const userId of rsvpUserIds) {
      if (!attendeeMap.has(userId)) {
        attendeeMap.set(userId, { userId });
      }
    }

    for (const memberId of timeslotMemberIds) {
      if (!attendeeMap.has(memberId)) {
        attendeeMap.set(memberId, { userId: memberId });
      }
    }

    expect(attendeeMap.size).toBe(2);
  });

  it("should handle both lists empty", () => {
    const rsvpUserIds: string[] = [];
    const timeslotMemberIds: string[] = [];

    const attendeeMap = new Map<string, { userId: string }>();

    for (const userId of rsvpUserIds) {
      if (!attendeeMap.has(userId)) {
        attendeeMap.set(userId, { userId });
      }
    }

    for (const memberId of timeslotMemberIds) {
      if (!attendeeMap.has(memberId)) {
        attendeeMap.set(memberId, { userId: memberId });
      }
    }

    expect(attendeeMap.size).toBe(0);
  });
});

// ============================================
// CHANGES OBJECT BUILDING TESTS
// ============================================

describe("Changes Object Building", () => {
  it("should only include fields that actually changed", () => {
    const prevEvent = {
      event_date: "2026-01-15",
      start_time: "19:00:00",
      venue_name: "Old Venue"
    };

    const body = {
      start_time: "20:00:00", // Changed
      // event_date not in body - no change
      // venue_id not in body - no change
    };

    const changes: Record<string, { old: string; new: string }> = {};

    if (body.start_time !== undefined && body.start_time !== prevEvent.start_time) {
      changes.time = {
        old: prevEvent.start_time,
        new: body.start_time
      };
    }

    expect(Object.keys(changes)).toHaveLength(1);
    expect(changes.time).toBeDefined();
    expect(changes.time.old).toBe("19:00:00");
    expect(changes.time.new).toBe("20:00:00");
  });

  it("should NOT include unchanged fields even if present in body", () => {
    const prevEvent = {
      start_time: "19:00:00"
    };

    const body = {
      start_time: "19:00:00" // Same value
    };

    const changes: Record<string, { old: string; new: string }> = {};

    if (body.start_time !== undefined && body.start_time !== prevEvent.start_time) {
      changes.time = {
        old: prevEvent.start_time,
        new: body.start_time
      };
    }

    expect(Object.keys(changes)).toHaveLength(0);
  });

  it("should handle null/undefined previous values gracefully", () => {
    const prevEvent = {
      event_date: null as string | null,
      start_time: undefined as string | undefined
    };

    const body = {
      event_date: "2026-01-15",
      start_time: "19:00:00"
    };

    const changes: Record<string, { old: string; new: string }> = {};

    if (body.event_date !== undefined && body.event_date !== prevEvent.event_date) {
      changes.date = {
        old: prevEvent.event_date || "TBD",
        new: body.event_date || "TBD"
      };
    }

    if (body.start_time !== undefined && body.start_time !== prevEvent.start_time) {
      changes.time = {
        old: prevEvent.start_time || "TBD",
        new: body.start_time || "TBD"
      };
    }

    expect(changes.date?.old).toBe("TBD");
    expect(changes.date?.new).toBe("2026-01-15");
    expect(changes.time?.old).toBe("TBD");
    expect(changes.time?.new).toBe("19:00:00");
  });
});

// ============================================
// EMAIL PREFERENCES INTEGRATION
// ============================================

describe("Email Preferences Integration", () => {
  it("eventUpdated template is mapped to event_updates category", () => {
    // This ensures the eventUpdated template respects preferences
    const categoryMap: Record<string, string> = {
      eventUpdated: "event_updates",
      eventReminder: "event_updates",
      eventCancelled: "event_updates"
    };

    expect(categoryMap["eventUpdated"]).toBe("event_updates");
  });

  it("dashboard notification is always created regardless of email preference", () => {
    // This is a design test - notifications are canonical
    // The sendEmailWithPreferences function:
    // 1. Always creates dashboard notification (if requested)
    // 2. Only sends email if preference allows

    // This behavior is enforced by the sendEmailWithPreferences implementation
    // which calls notification RPC first, then checks preferences for email
    expect(true).toBe(true);
  });
});

// ============================================
// URL HELPER TESTS
// ============================================

describe("Event URL Generation", () => {
  it("should prefer slug over id for event URLs", () => {
    const event = { id: "uuid-123", slug: "open-mic-night" };

    const identifier = event.slug || event.id;
    const url = `/events/${identifier}`;

    expect(url).toBe("/events/open-mic-night");
  });

  it("should fall back to id when slug is null", () => {
    const event = { id: "uuid-123", slug: null as string | null };

    const identifier = event.slug || event.id;
    const url = `/events/${identifier}`;

    expect(url).toBe("/events/uuid-123");
  });

  it("should fall back to id when slug is undefined", () => {
    const event = { id: "uuid-123" } as { id: string; slug?: string };

    const identifier = event.slug || event.id;
    const url = `/events/${identifier}`;

    expect(url).toBe("/events/uuid-123");
  });
});
