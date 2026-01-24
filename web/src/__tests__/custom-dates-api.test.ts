/**
 * Phase 4.x: Custom Dates API Tests
 *
 * Tests for the three series modes in event creation:
 * - "single": One-time event (single date)
 * - "weekly": Weekly recurring series (predictable dates)
 * - "custom": Custom dates (non-predictable, user-specified dates)
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

describe("POST /api/my-events - Series Mode Support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { user: { id: "user-123-abc" } };
    mockIsAdmin = false;
    mockIsHost = true;
    capturedInsertPayloads = [];
    mockInsertResult = { data: { id: "event-1", event_date: "2026-01-15" }, error: null };
    mockHostInsertResult = { data: {}, error: null };
  });

  describe("Single mode (default)", () => {
    it("creates one event when series_mode is 'single'", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "One-time Event",
          event_type: "gig",
          start_time: "19:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
          series_mode: "single",
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-02-14");
      expect(capturedInsertPayloads[0].series_id).toBeNull();
      expect(capturedInsertPayloads[0].series_index).toBeNull();
    });

    it("defaults to single mode when series_mode is not specified", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Event Without Mode",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
          // No series_mode specified
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should only create 1 event even though occurrence_count might be present
      expect(capturedInsertPayloads.length).toBe(1);
    });

    it("ignores occurrence_count when series_mode is 'single'", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "One-time Event",
          event_type: "gig",
          start_time: "19:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
          series_mode: "single",
          occurrence_count: 5, // Should be ignored
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(capturedInsertPayloads.length).toBe(1);
    });
  });

  describe("Weekly mode", () => {
    it("creates a single DB row with recurrence_rule='weekly' for weekly series", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Weekly Open Mic",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          day_of_week: "Wednesday",
          venue_id: "venue-1",
          series_mode: "weekly",
          occurrence_count: 0, // No end date (ongoing)
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Single DB row created (not multiple)
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-01-15");
      expect(capturedInsertPayloads[0].recurrence_rule).toBe("weekly");
      expect(capturedInsertPayloads[0].max_occurrences).toBeNull(); // infinite
      // No series_id needed for single row
      expect(capturedInsertPayloads[0].series_id).toBeNull();
    });

    it("sets max_occurrences when occurrence_count is specified", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Limited Series",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-01-15",
          day_of_week: "Wednesday",
          venue_id: "venue-1",
          series_mode: "weekly",
          occurrence_count: 6,
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].max_occurrences).toBe(6);
      expect(capturedInsertPayloads[0].recurrence_rule).toBe("weekly");
    });
  });

  describe("Custom mode (single-row model)", () => {
    it("creates a single event row with recurrence_rule='custom' and custom_dates array", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Custom Series",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-02-01",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: ["2026-02-01", "2026-02-15", "2026-03-01"],
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Single-row model: only 1 DB row created
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-02-01"); // Anchor = first sorted date
      expect(capturedInsertPayloads[0].recurrence_rule).toBe("custom");
      expect(capturedInsertPayloads[0].custom_dates).toEqual(["2026-02-01", "2026-02-15", "2026-03-01"]);
    });

    it("sorts custom dates chronologically and uses first as anchor", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Unsorted Dates",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-03-15",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: ["2026-03-15", "2026-02-01", "2026-02-20"], // Out of order
        })
      });

      await POST(request);

      // Single row with sorted dates, anchor = earliest
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-02-01");
      expect(capturedInsertPayloads[0].custom_dates).toEqual(["2026-02-01", "2026-02-20", "2026-03-15"]);
    });

    it("limits custom dates to 12", async () => {
      const manyDates = Array.from({ length: 20 }, (_, i) =>
        `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`
      );

      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Too Many Custom Dates",
          event_type: "showcase",
          start_time: "20:00",
          start_date: manyDates[0],
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: manyDates,
        })
      });

      await POST(request);

      // Single row, but custom_dates capped at 12
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].custom_dates.length).toBe(12);
    });

    it("filters out invalid date formats from custom_dates", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Mixed Dates",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-02-01",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: [
            "2026-02-01",      // Valid
            "invalid-date",    // Invalid
            "2026-02-15",      // Valid
            "02/20/2026",      // Invalid format (MM/DD/YYYY)
            "2026-03-01",      // Valid
          ],
        })
      });

      await POST(request);

      // Single row with only valid dates in custom_dates
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].custom_dates).toEqual(["2026-02-01", "2026-02-15", "2026-03-01"]);
    });

    it("falls back to single event when custom_dates array is empty", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "No Custom Dates",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-02-01",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: [], // Empty array — falls back to single mode
        })
      });

      const response = await POST(request);

      // Falls through to single mode using start_date (empty array doesn't match custom condition)
      expect(response.status).toBe(200);
      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].event_date).toBe("2026-02-01");
    });

    it("returns 400 when all custom_dates are invalid", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "All Invalid Dates",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-02-01",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: ["invalid", "also-invalid", "not-a-date"],
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("valid date");
    });

    it("creates single event with recurrence_rule='custom' for one custom date", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Single Custom Date",
          event_type: "showcase",
          start_time: "20:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
          series_mode: "custom",
          custom_dates: ["2026-02-14"],
        })
      });

      await POST(request);

      expect(capturedInsertPayloads.length).toBe(1);
      expect(capturedInsertPayloads[0].recurrence_rule).toBe("custom");
      expect(capturedInsertPayloads[0].custom_dates).toEqual(["2026-02-14"]);
    });
  });

  describe("Error handling", () => {
    it("returns 400 when start_date is missing", async () => {
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "No Start Date",
          event_type: "open_mic",
          start_time: "19:00",
          venue_id: "venue-1",
          // Missing start_date
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("start_date");
    });

    it("returns 401 when not authenticated", async () => {
      mockSession = null;

      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe("Backward compatibility", () => {
    it("old-style request with occurrence_count but no series_mode creates single event", async () => {
      // This simulates an old API call that might have occurrence_count but no series_mode
      const request = new Request("http://localhost/api/my-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Legacy Request",
          event_type: "open_mic",
          start_time: "19:00",
          start_date: "2026-02-14",
          venue_id: "venue-1",
          occurrence_count: 4, // Old-style, but no series_mode
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Default mode is "single", so only 1 event created
      expect(capturedInsertPayloads.length).toBe(1);
    });
  });
});
