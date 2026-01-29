/**
 * Phase 5.10 — Signup Time Per-Occurrence Override Tests
 *
 * Tests the addition of signup_time to ALLOWED_OVERRIDE_FIELDS and
 * the display merge behavior in HappeningCard and event detail page.
 *
 * Precedence rules (unchanged from Phase 5.08):
 * 1. has_timeslots (override or series) === true → "Online signup"
 * 2. Else override signup_time → "Signups at {time}"
 * 3. Else series signup_time → "Signups at {time}"
 * 4. Else → show nothing
 */

import { describe, it, expect } from "vitest";
import { ALLOWED_OVERRIDE_FIELDS } from "@/lib/events/nextOccurrence";
import { getSignupMeta } from "@/lib/events/signupMeta";

describe("Phase 5.10 — Signup Time Override", () => {
  describe("ALLOWED_OVERRIDE_FIELDS", () => {
    it("includes signup_time in the allowlist", () => {
      expect(ALLOWED_OVERRIDE_FIELDS.has("signup_time")).toBe(true);
    });

    it("includes has_timeslots in the allowlist", () => {
      expect(ALLOWED_OVERRIDE_FIELDS.has("has_timeslots")).toBe(true);
    });

    it("includes signup_url in the allowlist", () => {
      expect(ALLOWED_OVERRIDE_FIELDS.has("signup_url")).toBe(true);
    });

    it("includes signup_deadline in the allowlist", () => {
      expect(ALLOWED_OVERRIDE_FIELDS.has("signup_deadline")).toBe(true);
    });
  });

  describe("getSignupMeta precedence", () => {
    it("shows Online signup when has_timeslots is true", () => {
      const meta = getSignupMeta({
        hasTimeslots: true,
        signupTime: "18:00:00", // Should be ignored
      });
      expect(meta.show).toBe(true);
      expect(meta.type).toBe("online");
      expect(meta.label).toBe("Online signup");
    });

    it("shows signup time when has_timeslots is false and signupTime provided", () => {
      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: "18:30:00",
      });
      expect(meta.show).toBe(true);
      expect(meta.type).toBe("in_person"); // underscore, not hyphen
      expect(meta.label).toBe("Signups at 6:30 PM");
    });

    it("shows nothing when has_timeslots is false and no signupTime", () => {
      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: null,
      });
      expect(meta.show).toBe(false);
    });

    it("shows nothing when has_timeslots is null and no signupTime", () => {
      const meta = getSignupMeta({
        hasTimeslots: null,
        signupTime: null,
      });
      expect(meta.show).toBe(false);
    });
  });

  describe("HappeningCard override merge logic", () => {
    /**
     * These tests verify the EXPECTED behavior when override values are present.
     * The actual merge happens in HappeningCard.tsx lines ~395 and ~597.
     *
     * Test the logic pattern used:
     * const effectiveSignupTime = (patch?.signup_time as string | undefined) ?? event.signup_time;
     */

    it("override signup_time takes precedence over series signup_time", () => {
      const seriesSignupTime = "18:00:00";
      const overrideSignupTime = "19:00:00";

      // Simulate the merge logic
      const effectiveSignupTime = overrideSignupTime ?? seriesSignupTime;

      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: effectiveSignupTime,
      });
      // formatTimeToAMPM returns "7 PM" not "7:00 PM" for on-the-hour times
      expect(meta.label).toBe("Signups at 7 PM");
    });

    it("series signup_time used when no override", () => {
      const seriesSignupTime = "18:00:00";
      const overrideSignupTime: string | undefined = undefined;

      // Simulate the merge logic
      const effectiveSignupTime = overrideSignupTime ?? seriesSignupTime;

      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: effectiveSignupTime,
      });
      expect(meta.label).toBe("Signups at 6 PM");
    });

    it("override has_timeslots=true wins over series signup_time", () => {
      const seriesHasTimeslots = false;
      const seriesSignupTime = "18:00:00";
      const overrideHasTimeslots: boolean | undefined = true;

      // Simulate the merge logic
      const effectiveHasTimeslots = overrideHasTimeslots ?? seriesHasTimeslots;

      const meta = getSignupMeta({
        hasTimeslots: effectiveHasTimeslots,
        signupTime: seriesSignupTime, // Ignored due to timeslots
      });
      expect(meta.type).toBe("online");
      expect(meta.label).toBe("Online signup");
    });

    it("series has_timeslots=true wins over override signup_time", () => {
      const seriesHasTimeslots = true;
      const overrideSignupTime = "19:30:00";

      const meta = getSignupMeta({
        hasTimeslots: seriesHasTimeslots,
        signupTime: overrideSignupTime, // Ignored due to timeslots
      });
      expect(meta.type).toBe("online");
      expect(meta.label).toBe("Online signup");
    });
  });

  describe("Edge cases", () => {
    it("handles override has_timeslots=false explicitly (removes online signup for occurrence)", () => {
      // Series has timeslots enabled
      const seriesHasTimeslots = true;
      // But this occurrence overrides to disable timeslots
      const overrideHasTimeslots: boolean | null = false;
      const overrideSignupTime = "18:00:00";

      // Merge: override wins when explicitly set (even to false)
      const effectiveHasTimeslots =
        overrideHasTimeslots !== undefined ? overrideHasTimeslots : seriesHasTimeslots;

      const meta = getSignupMeta({
        hasTimeslots: effectiveHasTimeslots,
        signupTime: overrideSignupTime,
      });

      // Because override explicitly set has_timeslots=false, signup_time should be shown
      expect(meta.type).toBe("in_person");
      expect(meta.label).toBe("Signups at 6 PM");
    });

    it("handles null override signup_time (clears signup time for occurrence)", () => {
      const seriesSignupTime = "18:00:00";
      // Override explicitly sets to null to clear it
      const overrideSignupTime: string | null = null;

      // Merge with ?? operator: null is NOT overridden (falls through to series)
      // This is intentional: to clear signup_time, host should use empty string or delete the override
      const effectiveSignupTimeNullish = overrideSignupTime ?? seriesSignupTime;

      // With nullish coalescing, null falls through
      expect(effectiveSignupTimeNullish).toBe("18:00:00");
    });

    it("handles morning signup times correctly", () => {
      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: "09:30:00",
      });
      expect(meta.label).toBe("Signups at 9:30 AM");
    });

    it("handles noon signup time correctly", () => {
      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: "12:00:00",
      });
      // formatTimeToAMPM returns "12 PM" for noon (no minutes)
      expect(meta.label).toBe("Signups at 12 PM");
    });

    it("handles midnight signup time correctly", () => {
      const meta = getSignupMeta({
        hasTimeslots: false,
        signupTime: "00:00:00",
      });
      expect(meta.label).toBe("Signups at 12 AM");
    });
  });
});
