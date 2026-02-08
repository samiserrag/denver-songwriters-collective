/**
 * P0 Fix: CSC TEST Unconfirmed Badge Suppression Tests
 *
 * Tests the shouldShowUnconfirmedBadge() helper that suppresses "Unconfirmed"
 * UI for CSC TEST series (internal testing events).
 *
 * Rule: If is_dsc_event=true AND title starts with "TEST", hide badge.
 */

import { describe, it, expect } from "vitest";
import {
  shouldShowUnconfirmedBadge,
  getPublicVerificationState,
} from "@/lib/events/verification";

describe("shouldShowUnconfirmedBadge", () => {
  describe("CSC TEST events (badge should be hidden)", () => {
    it("hides badge for CSC event with title starting with 'TEST'", () => {
      const event = {
        title: "TEST Open Mic Thursdays Series",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for CSC event with title 'TEST CSC Song Circle'", () => {
      const event = {
        title: "TEST CSC Song Circle",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for CSC event with title 'TEST' (exact match)", () => {
      const event = {
        title: "TEST",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for CSC event with 'TEST' followed by space", () => {
      const event = {
        title: "TEST Event Name",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });
  });

  describe("Non-CSC unverified events (badge should be shown)", () => {
    it("shows badge for non-CSC unverified event", () => {
      const event = {
        title: "Community Open Mic Night",
        is_dsc_event: false,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for non-CSC event with TEST in title", () => {
      const event = {
        title: "TEST Community Event",
        is_dsc_event: false,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for event with null is_dsc_event", () => {
      const event = {
        title: "TEST Something",
        is_dsc_event: null,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for event with undefined is_dsc_event", () => {
      const event = {
        title: "TEST Something",
        is_dsc_event: undefined,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });
  });

  describe("CSC non-TEST unverified events (badge should be shown)", () => {
    it("shows badge for CSC event without TEST prefix", () => {
      const event = {
        title: "CSC Song Circle at Brewery",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for CSC event with 'test' lowercase (case-sensitive)", () => {
      const event = {
        title: "test Open Mic",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for CSC event with TEST in middle of title", () => {
      const event = {
        title: "Open Mic TEST Night",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("shows badge for CSC event with 'Testing' prefix (not exact TEST)", () => {
      const event = {
        title: "Testing New Format",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });
  });

  describe("Verified events (badge should never show)", () => {
    it("hides badge for verified CSC TEST event", () => {
      const event = {
        title: "TEST Open Mic",
        is_dsc_event: true,
        status: "active",
        last_verified_at: "2026-01-15T12:00:00Z",
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for verified non-CSC event", () => {
      const event = {
        title: "Community Open Mic",
        is_dsc_event: false,
        status: "active",
        last_verified_at: "2026-01-15T12:00:00Z",
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for verified CSC event", () => {
      const event = {
        title: "CSC Song Circle",
        is_dsc_event: true,
        status: "active",
        last_verified_at: "2026-01-15T12:00:00Z",
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });
  });

  describe("Cancelled events (badge should never show)", () => {
    it("hides badge for cancelled CSC TEST event", () => {
      const event = {
        title: "TEST Open Mic",
        is_dsc_event: true,
        status: "cancelled",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });

    it("hides badge for cancelled non-CSC event", () => {
      const event = {
        title: "Community Open Mic",
        is_dsc_event: false,
        status: "cancelled",
        last_verified_at: null,
      };
      expect(shouldShowUnconfirmedBadge(event)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles null title defensively", () => {
      const event = {
        title: null,
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      // Null title should show badge (can't match TEST prefix)
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("handles undefined title defensively", () => {
      const event = {
        title: undefined,
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      // Undefined title should show badge (can't match TEST prefix)
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });

    it("handles empty title", () => {
      const event = {
        title: "",
        is_dsc_event: true,
        status: "active",
        last_verified_at: null,
      };
      // Empty title should show badge (doesn't start with TEST)
      expect(shouldShowUnconfirmedBadge(event)).toBe(true);
    });
  });
});

describe("getPublicVerificationState", () => {
  it("returns unconfirmed for events without last_verified_at", () => {
    const result = getPublicVerificationState({
      status: "active",
      last_verified_at: null,
    });
    expect(result.state).toBe("unconfirmed");
  });

  it("returns confirmed for events with last_verified_at", () => {
    const result = getPublicVerificationState({
      status: "active",
      last_verified_at: "2026-01-15T12:00:00Z",
    });
    expect(result.state).toBe("confirmed");
  });

  it("returns cancelled for cancelled events regardless of verification", () => {
    const result = getPublicVerificationState({
      status: "cancelled",
      last_verified_at: "2026-01-15T12:00:00Z",
    });
    expect(result.state).toBe("cancelled");
  });
});
