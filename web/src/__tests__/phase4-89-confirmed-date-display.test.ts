/**
 * Phase 4.89: Confirmed Date Display Tests
 *
 * Tests that confirmed events display the confirmation date,
 * and unconfirmed events do not show a date.
 */

import { describe, it, expect } from "vitest";
import { formatVerifiedDate, getPublicVerificationState } from "@/lib/events/verification";

describe("Phase 4.89: Confirmed Date Display", () => {
  describe("formatVerifiedDate", () => {
    it("returns null for null input", () => {
      expect(formatVerifiedDate(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(formatVerifiedDate(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(formatVerifiedDate("")).toBeNull();
    });

    it("returns null for invalid date string", () => {
      expect(formatVerifiedDate("not-a-date")).toBeNull();
    });

    it("formats valid ISO date correctly", () => {
      // Feb 16, 2026 in UTC
      const result = formatVerifiedDate("2026-02-16T10:00:00Z");
      expect(result).toBe("Feb 16, 2026");
    });

    it("formats date in America/Denver timezone", () => {
      // This timestamp is Feb 17, 2026 00:00 UTC, which is Feb 16, 2026 in Denver (MST = UTC-7)
      const result = formatVerifiedDate("2026-02-17T02:00:00Z");
      // At 2:00 UTC, Denver is at 19:00 (7pm) on Feb 16
      expect(result).toBe("Feb 16, 2026");
    });

    it("handles dates at midnight UTC", () => {
      const result = formatVerifiedDate("2026-01-01T00:00:00Z");
      // Jan 1, 2026 00:00 UTC = Dec 31, 2025 in Denver
      expect(result).toBe("Dec 31, 2025");
    });

    it("handles dates at end of day UTC", () => {
      const result = formatVerifiedDate("2026-01-01T23:59:59Z");
      // Jan 1, 2026 23:59 UTC = Jan 1, 2026 16:59 in Denver
      expect(result).toBe("Jan 1, 2026");
    });
  });

  describe("getPublicVerificationState", () => {
    it("returns 'cancelled' for cancelled events regardless of verification", () => {
      const event = {
        status: "cancelled",
        last_verified_at: "2026-01-15T10:00:00Z",
        source: "community",
      };
      expect(getPublicVerificationState(event).state).toBe("cancelled");
    });

    it("returns 'confirmed' for events with last_verified_at", () => {
      const event = {
        status: "active",
        last_verified_at: "2026-01-15T10:00:00Z",
        source: "community",
      };
      expect(getPublicVerificationState(event).state).toBe("confirmed");
    });

    it("returns 'unconfirmed' for events without last_verified_at", () => {
      const event = {
        status: "active",
        last_verified_at: null,
        source: "community",
      };
      expect(getPublicVerificationState(event).state).toBe("unconfirmed");
    });

    it("returns 'unconfirmed' for imported events without verification", () => {
      const event = {
        status: "active",
        last_verified_at: null,
        source: "import",
      };
      expect(getPublicVerificationState(event).state).toBe("unconfirmed");
    });

    it("returns 'confirmed' for imported events that were manually verified", () => {
      const event = {
        status: "active",
        last_verified_at: "2026-01-20T15:30:00Z",
        source: "import",
      };
      expect(getPublicVerificationState(event).state).toBe("confirmed");
    });
  });

  describe("Confirmed date display logic (UI contract)", () => {
    it("confirmed event should render date when last_verified_at exists", () => {
      const event = {
        status: "active",
        last_verified_at: "2026-02-16T10:00:00Z",
        source: "community",
      };
      const verificationState = getPublicVerificationState(event).state;
      const formattedDate = formatVerifiedDate(event.last_verified_at);

      expect(verificationState).toBe("confirmed");
      expect(formattedDate).toBe("Feb 16, 2026");
      // UI contract: when confirmed AND date exists, show "Confirmed: {date}"
    });

    it("unconfirmed event should NOT render date", () => {
      const event = {
        status: "active",
        last_verified_at: null,
        source: "import",
      };
      const verificationState = getPublicVerificationState(event).state;
      const formattedDate = formatVerifiedDate(event.last_verified_at);

      expect(verificationState).toBe("unconfirmed");
      expect(formattedDate).toBeNull();
      // UI contract: when unconfirmed, no date is shown
    });

    it("cancelled event should NOT render confirmed date even if verified", () => {
      const event = {
        status: "cancelled",
        last_verified_at: "2026-02-16T10:00:00Z",
        source: "community",
      };
      const verificationState = getPublicVerificationState(event).state;

      expect(verificationState).toBe("cancelled");
      // UI contract: cancelled state takes precedence, no confirmed date shown
    });
  });

  describe("Auto-confirmation contract", () => {
    it("community events auto-confirm on publish (verified_by is null)", () => {
      // This documents the expected behavior of community event creation
      // When a community event is published:
      // - last_verified_at is set to the publish timestamp
      // - verified_by remains null (indicating auto-confirm, not admin verify)
      const autoConfirmedEvent = {
        status: "active",
        last_verified_at: "2026-01-26T10:00:00Z",
        verified_by: null, // null = auto-confirmed
        source: "community",
      };

      expect(getPublicVerificationState(autoConfirmedEvent).state).toBe("confirmed");
      expect(autoConfirmedEvent.verified_by).toBeNull();
    });

    it("admin-verified events have verified_by set", () => {
      const adminVerifiedEvent = {
        status: "active",
        last_verified_at: "2026-01-26T10:00:00Z",
        verified_by: "admin-user-id-123",
        source: "import",
      };

      expect(getPublicVerificationState(adminVerifiedEvent).state).toBe("confirmed");
      expect(adminVerifiedEvent.verified_by).not.toBeNull();
    });

    it("imported events start unconfirmed by design", () => {
      const importedEvent = {
        status: "active",
        last_verified_at: null,
        verified_by: null,
        source: "import",
      };

      expect(getPublicVerificationState(importedEvent).state).toBe("unconfirmed");
    });
  });
});
