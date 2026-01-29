/**
 * Phase 5.08: Signup Time + Online Signup Meta Tests
 *
 * Tests for:
 * 1. getSignupMeta helper function - precedence rules
 * 2. Timeline card (HappeningCard) rendering
 * 3. Series card (SeriesCard) interface
 * 4. Event detail page display
 *
 * Note: formatTimeToAMPM omits ":00" for whole hours (e.g., "7 PM" not "7:00 PM")
 */

import { describe, it, expect } from "vitest";
import { getSignupMeta } from "@/lib/events/signupMeta";

// ============================================================================
// Test 1: getSignupMeta helper - Core precedence rules
// ============================================================================
describe("Phase 5.08: getSignupMeta helper", () => {
  describe("Rule 1: Timeslots take precedence", () => {
    it("should return 'Online signup' when hasTimeslots is true", () => {
      const result = getSignupMeta({
        hasTimeslots: true,
        signupTime: null,
      });

      expect(result.show).toBe(true);
      expect(result.label).toBe("Online signup");
      expect(result.type).toBe("online");
    });

    it("should return 'Online signup' even when signupTime is also set", () => {
      // Timeslots take precedence - ignores signup_time
      const result = getSignupMeta({
        hasTimeslots: true,
        signupTime: "18:30:00",
      });

      expect(result.show).toBe(true);
      expect(result.label).toBe("Online signup");
      expect(result.type).toBe("online");
    });
  });

  describe("Rule 2: In-person signup time fallback", () => {
    it("should return formatted signup time when timeslots disabled", () => {
      const result = getSignupMeta({
        hasTimeslots: false,
        signupTime: "18:30:00",
      });

      expect(result.show).toBe(true);
      expect(result.label).toBe("Signups at 6:30 PM");
      expect(result.type).toBe("in_person");
    });

    it("should return formatted signup time when hasTimeslots is null", () => {
      const result = getSignupMeta({
        hasTimeslots: null,
        signupTime: "19:00:00",
      });

      expect(result.show).toBe(true);
      // formatTimeToAMPM omits ":00" for whole hours
      expect(result.label).toBe("Signups at 7 PM");
      expect(result.type).toBe("in_person");
    });

    it("should return formatted signup time when hasTimeslots is undefined", () => {
      const result = getSignupMeta({
        hasTimeslots: undefined,
        signupTime: "20:00:00",
      });

      expect(result.show).toBe(true);
      // formatTimeToAMPM omits ":00" for whole hours
      expect(result.label).toBe("Signups at 8 PM");
      expect(result.type).toBe("in_person");
    });
  });

  describe("Rule 3: No signup method configured", () => {
    it("should return show=false when both fields are null", () => {
      const result = getSignupMeta({
        hasTimeslots: null,
        signupTime: null,
      });

      expect(result.show).toBe(false);
      expect(result.label).toBeNull();
      expect(result.type).toBeNull();
    });

    it("should return show=false when timeslots=false and signupTime=null", () => {
      const result = getSignupMeta({
        hasTimeslots: false,
        signupTime: null,
      });

      expect(result.show).toBe(false);
      expect(result.label).toBeNull();
      expect(result.type).toBeNull();
    });

    it("should return show=false when both are undefined", () => {
      const result = getSignupMeta({
        hasTimeslots: undefined,
        signupTime: undefined,
      });

      expect(result.show).toBe(false);
      expect(result.label).toBeNull();
      expect(result.type).toBeNull();
    });
  });
});

// ============================================================================
// Test 2: Time formatting edge cases
// ============================================================================
describe("Phase 5.08: Time formatting", () => {
  it("should format morning times correctly (AM)", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "10:30:00",
    });

    expect(result.label).toBe("Signups at 10:30 AM");
  });

  it("should format noon correctly (whole hour)", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "12:00:00",
    });

    // formatTimeToAMPM omits ":00" for whole hours
    expect(result.label).toBe("Signups at 12 PM");
  });

  it("should format midnight correctly (whole hour)", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "00:00:00",
    });

    // formatTimeToAMPM omits ":00" for whole hours
    expect(result.label).toBe("Signups at 12 AM");
  });

  it("should handle HH:MM format (without seconds)", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "18:00",
    });

    // formatTimeToAMPM omits ":00" for whole hours
    expect(result.label).toBe("Signups at 6 PM");
  });

  it("should preserve minutes when not on the hour", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "18:15:00",
    });

    expect(result.label).toBe("Signups at 6:15 PM");
  });
});

// ============================================================================
// Test 3: Interface contracts for components
// ============================================================================
describe("Phase 5.08: Component interface contracts", () => {
  it("HappeningCard should have signupMeta fields in event type", () => {
    // HappeningCard receives event with has_timeslots and signup_time
    // This test verifies the expected input structure
    const eventWithSignup = {
      id: "test-id",
      title: "Test Event",
      has_timeslots: true,
      signup_time: "18:30:00",
    };

    const result = getSignupMeta({
      hasTimeslots: eventWithSignup.has_timeslots,
      signupTime: eventWithSignup.signup_time,
    });

    // When timeslots enabled, should show Online signup
    expect(result.show).toBe(true);
    expect(result.label).toBe("Online signup");
  });

  it("SeriesCard should pass through signup fields from SeriesEvent", () => {
    // SeriesCard has signup_time and has_timeslots in SeriesEvent interface
    const seriesEvent = {
      id: "series-id",
      title: "Weekly Open Mic",
      has_timeslots: false,
      signup_time: "19:00:00",
    };

    const result = getSignupMeta({
      hasTimeslots: seriesEvent.has_timeslots,
      signupTime: seriesEvent.signup_time,
    });

    // When timeslots disabled but signup_time set, should show time
    // formatTimeToAMPM omits ":00" for whole hours
    expect(result.show).toBe(true);
    expect(result.label).toBe("Signups at 7 PM");
  });

  it("Event detail page should display correct meta", () => {
    // Event detail page computes signupMeta from event fields
    const eventFromDb = {
      has_timeslots: true,
      signup_time: "18:30:00", // This should be ignored
    };

    const result = getSignupMeta({
      hasTimeslots: eventFromDb.has_timeslots,
      signupTime: eventFromDb.signup_time,
    });

    // Timeslots take precedence
    expect(result.type).toBe("online");
    expect(result.label).toBe("Online signup");
  });
});

// ============================================================================
// Test 4: Display rendering contracts
// ============================================================================
describe("Phase 5.08: Display rendering contracts", () => {
  it("should provide correct emoji type for online signup", () => {
    const result = getSignupMeta({
      hasTimeslots: true,
      signupTime: null,
    });

    // Event detail page uses different emoji for online vs in-person
    expect(result.type).toBe("online");
    // Frontend should render: "🎫" for online
  });

  it("should provide correct emoji type for in-person signup", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: "18:30:00",
    });

    expect(result.type).toBe("in_person");
    // Frontend should render: "📝" for in_person
  });

  it("should handle null type for no signup method", () => {
    const result = getSignupMeta({
      hasTimeslots: false,
      signupTime: null,
    });

    expect(result.type).toBeNull();
    // Frontend should not render anything when type is null
  });
});

// ============================================================================
// Test 5: Integration with existing signup_time usage
// ============================================================================
describe("Phase 5.08: Backward compatibility", () => {
  it("should not break existing signup_time display when timeslots disabled", () => {
    // Existing events with signup_time but no timeslots should still work
    const legacyEvent = {
      has_timeslots: false,
      signup_time: "18:00:00",
    };

    const result = getSignupMeta({
      hasTimeslots: legacyEvent.has_timeslots,
      signupTime: legacyEvent.signup_time,
    });

    expect(result.show).toBe(true);
    // formatTimeToAMPM omits ":00" for whole hours
    expect(result.label).toBe("Signups at 6 PM");
  });

  it("should gracefully handle events with no signup configuration", () => {
    // Events without timeslots or signup_time (common case)
    const minimalEvent = {
      has_timeslots: null,
      signup_time: null,
    };

    const result = getSignupMeta({
      hasTimeslots: minimalEvent.has_timeslots,
      signupTime: minimalEvent.signup_time,
    });

    expect(result.show).toBe(false);
    // No chip should be rendered
  });
});
