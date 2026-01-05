/**
 * Tests for Phase 4.38 slug routing and verification pills
 */

import { describe, it, expect } from "vitest";
import { getPublicVerificationState } from "@/lib/events/verification";

describe("Slug routing - canonical URL behavior", () => {
  describe("Event detail route", () => {
    it("UUID format is valid UUID", () => {
      const uuid = "42d7e4c6-49e9-4169-830e-040d6a911c62";
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
      expect(isUUID).toBe(true);
    });

    it("slug format is not UUID", () => {
      const slug = "test-time-slot-event";
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      expect(isUUID).toBe(false);
    });

    it("mixed case UUID is detected", () => {
      const uuid = "42D7E4C6-49E9-4169-830E-040D6A911C62";
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
      expect(isUUID).toBe(true);
    });
  });

  describe("Songwriter/profile route", () => {
    it("sami-serrag slug is not UUID", () => {
      const slug = "sami-serrag";
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      expect(isUUID).toBe(false);
    });

    it("collision slug with suffix is not UUID", () => {
      const slug = "john-smith-2";
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      expect(isUUID).toBe(false);
    });
  });
});

describe("Verification pill display logic (Phase 4.40)", () => {
  describe("All events unconfirmed until verified", () => {
    it("returns unconfirmed for any event without last_verified_at", () => {
      const result = getPublicVerificationState({
        status: "active",
        host_id: "user-123",
        source: "community",
        is_published: true,
        last_verified_at: null,
      });
      // Phase 4.40: all events start unconfirmed
      expect(result.state).toBe("unconfirmed");
    });

    it("returns confirmed only when last_verified_at is set", () => {
      const result = getPublicVerificationState({
        status: "active",
        host_id: "user-123",
        source: "community",
        is_published: true,
        last_verified_at: "2026-01-15T12:00:00Z",
      });
      expect(result.state).toBe("confirmed");
    });

    it("returns cancelled for cancelled status", () => {
      const result = getPublicVerificationState({
        status: "cancelled",
        host_id: "user-123",
      });
      expect(result.state).toBe("cancelled");
    });

    it("returns unconfirmed for needs_verification status", () => {
      const result = getPublicVerificationState({
        status: "needs_verification",
        host_id: null,
      });
      expect(result.state).toBe("unconfirmed");
    });
  });

  describe("HappeningCard verification pill variants", () => {
    it("verified events should show green success pill", () => {
      const result = getPublicVerificationState({
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: "2026-01-15T12:00:00Z",
      });
      // In the card, this maps to variant="success" with green styling
      expect(result.state).toBe("confirmed");
    });

    it("unverified events should show amber warning pill", () => {
      const result = getPublicVerificationState({
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
      });
      // In the card, this maps to variant="warning" with amber styling
      expect(result.state).toBe("unconfirmed");
    });

    it("cancelled events should show red danger pill", () => {
      const result = getPublicVerificationState({
        status: "cancelled",
      });
      // In the card, this maps to variant="danger" with red styling
      expect(result.state).toBe("cancelled");
    });
  });
});

describe("URL helper patterns", () => {
  describe("slug || id pattern", () => {
    it("prefers slug when available", () => {
      const event = { id: "uuid-123", slug: "test-event" };
      const identifier = event.slug || event.id;
      expect(identifier).toBe("test-event");
    });

    it("falls back to id when no slug", () => {
      const event = { id: "uuid-123", slug: null };
      const identifier = event.slug || event.id;
      expect(identifier).toBe("uuid-123");
    });

    it("handles undefined slug", () => {
      const event = { id: "uuid-123" } as { id: string; slug?: string };
      const identifier = event.slug || event.id;
      expect(identifier).toBe("uuid-123");
    });
  });
});
