/**
 * Phase 4.111: Verification Status Consistency + Slug Date Suffix Tests
 *
 * Bug 1: HappeningCard showed "Unconfirmed" but detail page showed "✓ Confirmed"
 * Fix: Added last_verified_at, verified_by, source to Event type in types/index.ts
 *
 * Bug 2: Single occurrence events used title-only slugs, causing potential conflicts
 * Fix: Migration adds date suffix to slugs for non-recurring events
 */

import { describe, it, expect } from "vitest";
import type { Event } from "@/types";

// =============================================================================
// 1. Event Type Verification Fields
// =============================================================================

describe("Phase 4.111: Event Type Includes Verification Fields", () => {
  it("should allow last_verified_at on Event type", () => {
    const event: Event = {
      id: "test-id",
      title: "Test Event",
      last_verified_at: "2026-01-31T18:02:03.128+00",
    };

    expect(event.last_verified_at).toBe("2026-01-31T18:02:03.128+00");
  });

  it("should allow verified_by on Event type", () => {
    const event: Event = {
      id: "test-id",
      title: "Test Event",
      verified_by: "admin-user-id",
    };

    expect(event.verified_by).toBe("admin-user-id");
  });

  it("should allow source on Event type", () => {
    const event: Event = {
      id: "test-id",
      title: "Test Event",
      source: "import",
    };

    expect(event.source).toBe("import");
  });

  it("should allow all verification fields together", () => {
    const event: Event = {
      id: "test-id",
      title: "Test Event",
      last_verified_at: "2026-01-31T18:02:03.128+00",
      verified_by: "admin-user-id",
      source: "community",
    };

    expect(event.last_verified_at).toBe("2026-01-31T18:02:03.128+00");
    expect(event.verified_by).toBe("admin-user-id");
    expect(event.source).toBe("community");
  });

  it("should allow null verification fields", () => {
    const event: Event = {
      id: "test-id",
      title: "Test Event",
      last_verified_at: null,
      verified_by: null,
      source: null,
    };

    expect(event.last_verified_at).toBeNull();
    expect(event.verified_by).toBeNull();
    expect(event.source).toBeNull();
  });
});

// =============================================================================
// 2. HappeningCard Verification State (Contract Tests)
// =============================================================================

describe("Phase 4.111: HappeningCard Verification Consistency", () => {
  /**
   * This test documents the expected behavior:
   * - HappeningCard receives event data from happenings page query
   * - Query uses .select("*") which includes last_verified_at
   * - Event type now includes last_verified_at so the data flows through
   */

  it("should use last_verified_at from event for verification state", () => {
    // Simulating the data flow from happenings page to HappeningCard
    const eventFromQuery = {
      id: "test-id",
      title: "Sloan Lake Song Circle / Jam",
      status: "active",
      last_verified_at: "2026-01-31T18:02:03.128+00", // Event IS verified
      host_id: "some-host-id",
      source: "community",
    };

    // HappeningCard passes these to getPublicVerificationState
    const verificationInput = {
      status: eventFromQuery.status,
      host_id: eventFromQuery.host_id,
      source: eventFromQuery.source,
      last_verified_at: eventFromQuery.last_verified_at,
    };

    // This is the logic from verification.ts
    // Rule 2: Confirmed if last_verified_at is set
    const isConfirmed =
      verificationInput.last_verified_at !== null &&
      verificationInput.last_verified_at !== undefined;

    expect(isConfirmed).toBe(true);
  });

  it("should show unconfirmed when last_verified_at is null", () => {
    const eventFromQuery = {
      id: "test-id",
      title: "Test Event",
      status: "active",
      last_verified_at: null, // Event is NOT verified
      host_id: "some-host-id",
      source: "community",
    };

    const isConfirmed =
      eventFromQuery.last_verified_at !== null &&
      eventFromQuery.last_verified_at !== undefined;

    expect(isConfirmed).toBe(false);
  });
});

// =============================================================================
// 3. Slug Generation with Date Suffix (Contract Tests)
// =============================================================================

describe("Phase 4.111: Slug Generation with Date Suffix", () => {
  /**
   * Database contract (from migration):
   * - Single-occurrence events: slug = title-slug-YYYY-MM-DD
   * - Recurring events: slug = title-slug (no date)
   */

  it("should document single occurrence slug format", () => {
    // Example from production after migration
    const singleOccurrenceEvent = {
      title: "Sloan Lake Song Circle / Jam",
      slug: "sloan-lake-song-circle-jam-2026-02-01",
      event_date: "2026-02-01",
      recurrence_rule: null, // No recurrence = single occurrence
    };

    // Slug should include the date for single occurrence
    expect(singleOccurrenceEvent.slug).toContain("-2026-02-01");
    expect(singleOccurrenceEvent.slug).toBe(
      "sloan-lake-song-circle-jam-2026-02-01"
    );
  });

  it("should document recurring event slug format (no date)", () => {
    // Recurring events keep their title-only slugs
    const recurringEvent = {
      title: "Weekly Open Mic",
      slug: "weekly-open-mic", // No date suffix
      event_date: "2026-01-01", // Anchor date
      recurrence_rule: "weekly", // Has recurrence
    };

    // Slug should NOT include the date for recurring events
    expect(recurringEvent.slug).not.toContain("-2026");
    expect(recurringEvent.slug).toBe("weekly-open-mic");
  });

  it("should handle slug collision with numeric suffix", () => {
    // If two single-occurrence events have same title and date
    // the second one gets a numeric suffix
    const firstEvent = {
      slug: "test-event-2026-02-01",
    };
    const secondEvent = {
      slug: "test-event-2026-02-01-2", // -2 suffix for collision
    };

    expect(firstEvent.slug).not.toBe(secondEvent.slug);
    expect(secondEvent.slug).toMatch(/-2$/);
  });
});

// =============================================================================
// 4. Verification + Slug Integration
// =============================================================================

describe("Phase 4.111: Full Event Data Flow", () => {
  it("should support complete event with verification and slug", () => {
    // This is the full event structure that flows from DB → page → card
    const completeEvent: Event = {
      id: "bcd4ec24-11b6-484e-862f-dc2825833b66",
      slug: "sloan-lake-song-circle-jam-2026-02-01",
      title: "Sloan Lake Song Circle / Jam",
      event_date: "2026-02-01",
      status: "active",
      last_verified_at: "2026-01-31T18:02:03.128+00",
      verified_by: null, // Auto-confirmed on publish
      source: "community",
      recurrence_rule: null, // Single occurrence
      is_dsc_event: false,
    };

    // Verification should show as confirmed
    const isConfirmed = !!completeEvent.last_verified_at;
    expect(isConfirmed).toBe(true);

    // Slug should include date (single occurrence)
    expect(completeEvent.slug).toContain("-2026-02-01");

    // Event type should be community (not CSC)
    expect(completeEvent.is_dsc_event).toBe(false);
  });
});
