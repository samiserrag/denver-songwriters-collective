/**
 * Phase 4.42d: Series Creation RLS Fix Tests
 *
 * These tests verify that the unified insert builder correctly sets host_id
 * for both single events and series, preventing RLS policy violations.
 *
 * Root cause: The INSERT didn't include host_id, but the RLS policy
 * host_manage_own_events requires (auth.uid() = host_id) for writes.
 *
 * Solution: buildEventInsert() now ALWAYS sets host_id: userId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock state
let mockSession: { user: { id: string } } | null = null;
let mockIsAdmin = false;
let mockIsHost = true;
let capturedInsertPayloads: Record<string, unknown>[] = [];
let mockInsertResult: { data: { id: string; event_date: string | null } | null; error: Error | null } = {
  data: { id: "event-1", event_date: "2026-01-15" },
  error: null
};
let mockHostInsertResult: { data: unknown | null; error: Error | null } = { data: {}, error: null };

// Helper to create deeply chainable mock
const createChainable = (result: unknown) => {
  const chainable: Record<string, unknown> = {
    ...result as object,
    eq: () => chainable,
    in: () => chainable,
    not: () => chainable,
    gt: () => chainable,
    gte: () => chainable,
    is: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    single: () => result,
    maybeSingle: () => result,
  };
  return chainable;
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({
        data: { session: mockSession },
        error: null
      })
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => createChainable({
            data: mockIsAdmin ? { role: "admin" } : { role: "member" },
            error: null
          })
        };
      }
      if (table === "events") {
        return {
          insert: (payload: Record<string, unknown>) => {
            capturedInsertPayloads.push(payload);
            return {
              select: () => ({
                single: () => Promise.resolve(mockInsertResult)
              })
            };
          }
        };
      }
      if (table === "event_hosts") {
        return {
          insert: () => Promise.resolve(mockHostInsertResult)
        };
      }
      if (table === "venues") {
        return {
          select: () => createChainable({
            data: { name: "Test Venue", address: "123 Main St", city: "Denver", state: "CO" },
            error: null
          })
        };
      }
      return {
        select: () => createChainable({ data: [], error: null })
      };
    },
    rpc: () => Promise.resolve({ data: null, error: null })
  })
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: () => Promise.resolve(mockIsAdmin),
  checkHostStatus: () => Promise.resolve(mockIsHost)
}));

// Import AFTER mocks are set up
import { POST } from "@/app/api/my-events/route";

describe("POST /api/my-events - Series Creation RLS Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { user: { id: "user-123-abc" } };
    mockIsAdmin = false;
    mockIsHost = true;
    capturedInsertPayloads = [];
    mockInsertResult = { data: { id: "event-1", event_date: "2026-01-15" }, error: null };
    mockHostInsertResult = { data: {}, error: null };
  });

  describe("CRITICAL: host_id is always set", () => {
    it("sets host_id for single event creation", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Single Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
          occurrence_count: 1, // Single event
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify host_id was set in the insert payload
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].host_id).toBe("user-123-abc");
    });

    it("sets host_id for ALL events in a series", async () => {
      // Create series of 4 events
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Weekly Open Mic",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 4, // Series of 4
          day_of_week: "Wednesday",
          recurrence_rule: "weekly",
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify all 4 events have host_id set
      expect(capturedInsertPayloads.length).toBe(4);
      for (let i = 0; i < 4; i++) {
        expect(capturedInsertPayloads[i].host_id).toBe("user-123-abc");
      }
    });

    it("host_id matches session user id exactly", async () => {
      mockSession = { user: { id: "different-user-456" } };

      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          event_type: "concert",
          start_time: "20:00",
          start_date: "2026-02-01",
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 2,
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Both events should have the correct user ID
      expect(capturedInsertPayloads.length).toBe(2);
      expect(capturedInsertPayloads[0].host_id).toBe("different-user-456");
      expect(capturedInsertPayloads[1].host_id).toBe("different-user-456");
    });
  });

  describe("Series fields are correctly set", () => {
    it("single event has null series_id and series_index", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "One-off Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
          occurrence_count: 1,
        })
      });

      await POST(request);

      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].series_id).toBeNull();
      expect(capturedInsertPayloads[0].series_index).toBeNull();
    });

    it("series events share same series_id with sequential indexes", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Monthly Jam",
          event_type: "jam_session",
          start_time: "18:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 3,
        })
      });

      await POST(request);

      expect(capturedInsertPayloads.length).toBe(3);

      // All should have the same series_id (a UUID)
      const seriesId = capturedInsertPayloads[0].series_id;
      expect(seriesId).toBeTruthy();
      expect(typeof seriesId).toBe("string");
      expect(capturedInsertPayloads[1].series_id).toBe(seriesId);
      expect(capturedInsertPayloads[2].series_id).toBe(seriesId);

      // Indexes should be sequential
      expect(capturedInsertPayloads[0].series_index).toBe(0);
      expect(capturedInsertPayloads[1].series_index).toBe(1);
      expect(capturedInsertPayloads[2].series_index).toBe(2);
    });

    it("series events have correct weekly dates", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Weekly Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15", // Wed Jan 15
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 3,
        })
      });

      await POST(request);

      expect(capturedInsertPayloads.length).toBe(3);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-01-15");
      expect(capturedInsertPayloads[1].event_date).toBe("2026-01-22"); // +7 days
      expect(capturedInsertPayloads[2].event_date).toBe("2026-01-29"); // +14 days
    });
  });

  describe("RLS-required fields consistency", () => {
    it("all insert payloads have required RLS fields", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Complete Event",
          event_type: "workshop",
          start_time: "14:00",
          start_date: "2026-01-20",
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 2,
          description: "Test description",
          is_dsc_event: true,
        })
      });

      await POST(request);

      for (const payload of capturedInsertPayloads) {
        // host_id is the critical RLS field
        expect(payload.host_id).toBe("user-123-abc");

        // These fields should always be present
        expect(payload.title).toBe("Complete Event");
        expect(payload.event_type).toBe("workshop");
        expect(payload.start_time).toBe("14:00");
        expect(payload.source).toBe("community");
      }
    });

    it("buildEventInsert sets host_id as first priority", async () => {
      // Even with minimal fields, host_id must be set
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Minimal Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
        })
      });

      await POST(request);

      expect(capturedInsertPayloads.length).toBe(1);
      // host_id MUST be present - this is the fix for the RLS violation
      expect(capturedInsertPayloads[0]).toHaveProperty("host_id");
      expect(capturedInsertPayloads[0].host_id).toBe("user-123-abc");
    });
  });

  describe("Error handling", () => {
    it("returns 401 when not authenticated", async () => {
      mockSession = null;

      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("returns 400 when required fields missing", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing title
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("clamps occurrence_count to max 12", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Too Many Events",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          venue_id: "venue-1",
          series_mode: "weekly", // Phase 4.x: Must specify weekly mode for series
          occurrence_count: 100, // Exceeds max
        })
      });

      await POST(request);

      // Should be clamped to 12
      expect(capturedInsertPayloads.length).toBe(12);
    });
  });
});
