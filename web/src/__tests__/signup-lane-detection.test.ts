/**
 * Phase 4.32: Signup Lane Detection Tests
 *
 * Tests the hasSignupLane helper function that determines if an event
 * has a functioning signup lane (timeslots or RSVP capacity).
 */

import { describe, it, expect } from "vitest";

/**
 * Inline copy of hasSignupLane for unit testing
 * (the original is in events/[id]/page.tsx as a local function)
 */
function hasSignupLane(
  event: { has_timeslots?: boolean | null; capacity?: number | null },
  timeslotCount: number
): boolean {
  if (event.has_timeslots) {
    // Timeslot lane exists only if timeslot rows exist
    return timeslotCount > 0;
  } else {
    // RSVP lane exists only if capacity is set
    return event.capacity !== null && event.capacity !== undefined;
  }
}

describe("Phase 4.32: Signup Lane Detection", () => {
  describe("Timeslot events (has_timeslots=true)", () => {
    it("returns false when has_timeslots=true but timeslotCount=0", () => {
      const event = { has_timeslots: true, capacity: null };
      expect(hasSignupLane(event, 0)).toBe(false);
    });

    it("returns true when has_timeslots=true and timeslotCount > 0", () => {
      const event = { has_timeslots: true, capacity: null };
      expect(hasSignupLane(event, 8)).toBe(true);
    });

    it("ignores capacity when has_timeslots=true", () => {
      // Even with capacity set, timeslot events use timeslotCount
      const event = { has_timeslots: true, capacity: 50 };
      expect(hasSignupLane(event, 0)).toBe(false);
    });
  });

  describe("RSVP events (has_timeslots=false)", () => {
    it("returns false when has_timeslots=false and capacity=null", () => {
      const event = { has_timeslots: false, capacity: null };
      expect(hasSignupLane(event, 0)).toBe(false);
    });

    it("returns true when has_timeslots=false and capacity is set", () => {
      const event = { has_timeslots: false, capacity: 25 };
      expect(hasSignupLane(event, 0)).toBe(true);
    });

    it("returns true when capacity is 0 (explicit zero capacity)", () => {
      // capacity=0 is explicitly set (waitlist-only mode)
      const event = { has_timeslots: false, capacity: 0 };
      expect(hasSignupLane(event, 0)).toBe(true);
    });

    it("ignores timeslotCount when has_timeslots=false", () => {
      // Even with timeslots generated somehow, RSVP events use capacity
      const event = { has_timeslots: false, capacity: null };
      expect(hasSignupLane(event, 10)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles undefined has_timeslots as falsy", () => {
      const event = { capacity: 30 };
      expect(hasSignupLane(event, 0)).toBe(true);
    });

    it("handles null has_timeslots as falsy", () => {
      const event = { has_timeslots: null, capacity: 30 };
      expect(hasSignupLane(event, 0)).toBe(true);
    });

    it("handles undefined capacity as no signup lane", () => {
      const event = { has_timeslots: false };
      expect(hasSignupLane(event, 0)).toBe(false);
    });
  });
});

describe("Phase 4.32: Host/Admin Banner Visibility", () => {
  /**
   * These are contract tests that document expected UI behavior.
   * The actual rendering is in events/[id]/page.tsx but we test the logic here.
   */

  it("banner should show when: has_timeslots=true AND timeslotCount=0 AND canManageEvent=true", () => {
    const event = { has_timeslots: true, capacity: null, is_dsc_event: true };
    const signupLaneExists = hasSignupLane(event, 0);
    const canManageEvent = true;

    // Banner shows when: canManageEvent && is_dsc_event && !signupLaneExists
    const showBanner = canManageEvent && event.is_dsc_event && !signupLaneExists;
    expect(showBanner).toBe(true);
  });

  it("banner should show when: has_timeslots=false AND capacity=null AND canManageEvent=true", () => {
    const event = { has_timeslots: false, capacity: null, is_dsc_event: true };
    const signupLaneExists = hasSignupLane(event, 0);
    const canManageEvent = true;

    const showBanner = canManageEvent && event.is_dsc_event && !signupLaneExists;
    expect(showBanner).toBe(true);
  });

  it("banner should NOT show when: has_timeslots=true AND timeslotCount > 0", () => {
    const event = { has_timeslots: true, capacity: null, is_dsc_event: true };
    const signupLaneExists = hasSignupLane(event, 8);
    const canManageEvent = true;

    const showBanner = canManageEvent && event.is_dsc_event && !signupLaneExists;
    expect(showBanner).toBe(false);
  });

  it("banner should NOT show when: has_timeslots=false AND capacity is set", () => {
    const event = { has_timeslots: false, capacity: 25, is_dsc_event: true };
    const signupLaneExists = hasSignupLane(event, 0);
    const canManageEvent = true;

    const showBanner = canManageEvent && event.is_dsc_event && !signupLaneExists;
    expect(showBanner).toBe(false);
  });

  it("banner should NOT show to public viewers (canManageEvent=false)", () => {
    const event = { has_timeslots: true, capacity: null, is_dsc_event: true };
    const signupLaneExists = hasSignupLane(event, 0);
    const canManageEvent = false;

    // Phase 4.XX: Banner now shows for ALL events (not just CSC), but only to managers
    const showBanner = canManageEvent && !signupLaneExists;
    expect(showBanner).toBe(false);
  });

  it("banner DOES show for non-CSC events when user can manage", () => {
    // Phase 4.XX: Banner now shows for ALL events (not just CSC)
    const event = { has_timeslots: false, capacity: null, is_dsc_event: false };
    const signupLaneExists = hasSignupLane(event, 0);
    const canManageEvent = true;

    const showBanner = canManageEvent && !signupLaneExists;
    expect(showBanner).toBe(true);
  });
});
