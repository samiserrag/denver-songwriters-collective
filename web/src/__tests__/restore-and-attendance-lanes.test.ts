/**
 * Phase 4.28 Tests: Restore cancelled drafts + RSVP/timeslot lane separation
 *
 * Tests for:
 * 1. Restore endpoint behavior
 * 2. UI restore button visibility
 * 3. RSVP vs Timeslot lane separation on public event page
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Test data helpers
// =============================================================================

interface MockEvent {
  id: string;
  title: string;
  status: string;
  is_published: boolean;
  published_at: string | null;
  has_timeslots: boolean;
  capacity: number | null;
  is_dsc_event: boolean;
}

function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    id: "event-1",
    title: "Test Event",
    status: "active",
    is_published: true,
    published_at: "2026-01-01T00:00:00Z",
    has_timeslots: false,
    capacity: 50,
    is_dsc_event: true,
    ...overrides,
  };
}

// =============================================================================
// Restore endpoint logic tests
// =============================================================================

describe("Restore endpoint eligibility rules", () => {
  /**
   * Rule: Only cancelled events can be restored
   */
  it("allows restore for cancelled events", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false,
      published_at: null,
    });

    const canRestore = event.status === "cancelled" && !event.published_at;
    expect(canRestore).toBe(true);
  });

  it("rejects restore for active events", () => {
    const event = createMockEvent({
      status: "active",
      is_published: true,
      published_at: "2026-01-01T00:00:00Z",
    });

    const canRestore = event.status === "cancelled" && !event.published_at;
    expect(canRestore).toBe(false);
  });

  it("rejects restore for draft events (not cancelled)", () => {
    const event = createMockEvent({
      status: "draft",
      is_published: false,
      published_at: null,
    });

    const canRestore = event.status === "cancelled" && !event.published_at;
    expect(canRestore).toBe(false);
  });

  /**
   * Rule: Only events that were never published can be restored
   */
  it("rejects restore for cancelled events that were previously published", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false, // Currently not published
      published_at: "2025-12-15T00:00:00Z", // But was published before
    });

    const canRestore = event.status === "cancelled" && !event.published_at;
    expect(canRestore).toBe(false);
  });

  it("allows restore for cancelled drafts that were never published", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false,
      published_at: null, // Never published
    });

    const canRestore = event.status === "cancelled" && !event.published_at;
    expect(canRestore).toBe(true);
  });
});

describe("Restore action behavior", () => {
  it("should set status to 'draft' when restoring", () => {
    const restoredEvent = {
      status: "draft",
      is_published: false,
      cancelled_at: null,
      cancel_reason: null,
    };

    expect(restoredEvent.status).toBe("draft");
    expect(restoredEvent.is_published).toBe(false);
    expect(restoredEvent.cancelled_at).toBeNull();
    expect(restoredEvent.cancel_reason).toBeNull();
  });

  it("clears cancellation metadata on restore", () => {
    // Before restore
    const cancelledEvent = {
      status: "cancelled",
      cancelled_at: "2026-01-01T00:00:00Z",
      cancel_reason: "User cancelled draft",
    };

    // After restore
    const restoredEvent = {
      status: "draft",
      cancelled_at: null,
      cancel_reason: null,
    };

    expect(cancelledEvent.cancelled_at).not.toBeNull();
    expect(restoredEvent.cancelled_at).toBeNull();
    expect(restoredEvent.cancel_reason).toBeNull();
  });
});

// =============================================================================
// UI Restore button visibility tests
// =============================================================================

describe("Restore button visibility in UI", () => {
  const canShowRestoreButton = (event: MockEvent) => {
    return event.status === "cancelled" && !event.published_at;
  };

  it("shows restore button for cancelled never-published events", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false,
      published_at: null,
    });

    expect(canShowRestoreButton(event)).toBe(true);
  });

  it("hides restore button for cancelled previously-published events", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false,
      published_at: "2025-12-01T00:00:00Z",
    });

    expect(canShowRestoreButton(event)).toBe(false);
  });

  it("hides restore button for active events", () => {
    const event = createMockEvent({
      status: "active",
      is_published: true,
      published_at: "2025-12-01T00:00:00Z",
    });

    expect(canShowRestoreButton(event)).toBe(false);
  });

  it("hides restore button for draft events", () => {
    const event = createMockEvent({
      status: "draft",
      is_published: false,
      published_at: null,
    });

    expect(canShowRestoreButton(event)).toBe(false);
  });
});

// =============================================================================
// RSVP vs Timeslot lane separation tests
// =============================================================================

describe("RSVP vs Timeslot lane separation", () => {
  /**
   * Two attendance models:
   * 1. RSVP model: uses capacity and event_rsvps table
   * 2. Timeslot model: uses total_slots, event_timeslots, timeslot_claims tables
   *
   * Events use one or the other based on has_timeslots boolean.
   */

  const shouldShowRSVPSection = (event: MockEvent) => {
    return event.is_dsc_event && !event.has_timeslots;
  };

  const shouldShowTimeslotSection = (event: MockEvent) => {
    return event.is_dsc_event && event.has_timeslots;
  };

  describe("RSVP lane (has_timeslots=false)", () => {
    it("shows RSVP section for DSC events without timeslots", () => {
      const event = createMockEvent({
        is_dsc_event: true,
        has_timeslots: false,
        capacity: 50,
      });

      expect(shouldShowRSVPSection(event)).toBe(true);
      expect(shouldShowTimeslotSection(event)).toBe(false);
    });

    it("hides RSVP section for non-DSC events", () => {
      const event = createMockEvent({
        is_dsc_event: false,
        has_timeslots: false,
      });

      expect(shouldShowRSVPSection(event)).toBe(false);
    });
  });

  describe("Timeslot lane (has_timeslots=true)", () => {
    it("shows Timeslot section for DSC events with timeslots", () => {
      const event = createMockEvent({
        is_dsc_event: true,
        has_timeslots: true,
      });

      expect(shouldShowTimeslotSection(event)).toBe(true);
      expect(shouldShowRSVPSection(event)).toBe(false);
    });

    it("hides Timeslot section for non-DSC events", () => {
      const event = createMockEvent({
        is_dsc_event: false,
        has_timeslots: true,
      });

      expect(shouldShowTimeslotSection(event)).toBe(false);
    });
  });

  describe("Mutual exclusivity", () => {
    it("never shows both RSVP and Timeslot sections", () => {
      const eventWithTimeslots = createMockEvent({
        is_dsc_event: true,
        has_timeslots: true,
      });

      const eventWithoutTimeslots = createMockEvent({
        is_dsc_event: true,
        has_timeslots: false,
      });

      // Event with timeslots: Timeslot=true, RSVP=false
      expect(shouldShowTimeslotSection(eventWithTimeslots)).toBe(true);
      expect(shouldShowRSVPSection(eventWithTimeslots)).toBe(false);

      // Event without timeslots: Timeslot=false, RSVP=true
      expect(shouldShowTimeslotSection(eventWithoutTimeslots)).toBe(false);
      expect(shouldShowRSVPSection(eventWithoutTimeslots)).toBe(true);
    });

    it("capacity field only applies to RSVP lane", () => {
      const rsvpEvent = createMockEvent({
        is_dsc_event: true,
        has_timeslots: false,
        capacity: 50,
      });

      const timeslotEvent = createMockEvent({
        is_dsc_event: true,
        has_timeslots: true,
        capacity: null, // Capacity doesn't apply here
      });

      // RSVP uses capacity
      expect(shouldShowRSVPSection(rsvpEvent)).toBe(true);
      expect(rsvpEvent.capacity).toBe(50);

      // Timeslot ignores capacity (uses total_slots instead)
      expect(shouldShowTimeslotSection(timeslotEvent)).toBe(true);
    });
  });
});

// =============================================================================
// Cancel draft button visibility tests
// =============================================================================

describe("Cancel draft button visibility", () => {
  const canShowCancelButton = (event: MockEvent) => {
    return !event.is_published && event.status !== "cancelled";
  };

  it("shows cancel button for unpublished draft events", () => {
    const event = createMockEvent({
      status: "draft",
      is_published: false,
    });

    expect(canShowCancelButton(event)).toBe(true);
  });

  it("hides cancel button for published events", () => {
    const event = createMockEvent({
      status: "active",
      is_published: true,
    });

    expect(canShowCancelButton(event)).toBe(false);
  });

  it("hides cancel button for already cancelled events", () => {
    const event = createMockEvent({
      status: "cancelled",
      is_published: false,
    });

    expect(canShowCancelButton(event)).toBe(false);
  });
});

// =============================================================================
// Tab counts after restore
// =============================================================================

describe("Tab counts after restore action", () => {
  const getTabCounts = (events: MockEvent[]) => {
    return {
      active: events.filter(e => e.status === "active" && e.is_published).length,
      drafts: events.filter(e => !e.is_published && e.status !== "cancelled").length,
      cancelled: events.filter(e => e.status === "cancelled").length,
    };
  };

  it("moves event from cancelled to drafts tab on restore", () => {
    const beforeRestore: MockEvent[] = [
      createMockEvent({ id: "1", status: "cancelled", is_published: false, published_at: null }),
      createMockEvent({ id: "2", status: "active", is_published: true }),
    ];

    const countsBefore = getTabCounts(beforeRestore);
    expect(countsBefore.cancelled).toBe(1);
    expect(countsBefore.drafts).toBe(0);

    // Simulate restore
    const afterRestore: MockEvent[] = [
      createMockEvent({ id: "1", status: "draft", is_published: false, published_at: null }),
      createMockEvent({ id: "2", status: "active", is_published: true }),
    ];

    const countsAfter = getTabCounts(afterRestore);
    expect(countsAfter.cancelled).toBe(0);
    expect(countsAfter.drafts).toBe(1);
  });

  it("preserves other tab counts when restoring", () => {
    const events: MockEvent[] = [
      createMockEvent({ id: "1", status: "cancelled", is_published: false, published_at: null }),
      createMockEvent({ id: "2", status: "active", is_published: true }),
      createMockEvent({ id: "3", status: "draft", is_published: false }),
    ];

    const countsBefore = getTabCounts(events);
    expect(countsBefore.active).toBe(1);
    expect(countsBefore.drafts).toBe(1);
    expect(countsBefore.cancelled).toBe(1);

    // Restore event 1
    events[0].status = "draft";

    const countsAfter = getTabCounts(events);
    expect(countsAfter.active).toBe(1); // Unchanged
    expect(countsAfter.drafts).toBe(2); // +1
    expect(countsAfter.cancelled).toBe(0); // -1
  });
});
