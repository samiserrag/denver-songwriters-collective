/**
 * Route-level tests for PATCH /api/my-events/[id] timeslot behavior
 *
 * Tests:
 * 1. 409 when claims exist + attempt to change total_slots
 * 2. 200 + RPC called when no claims + enable has_timeslots
 * 3. 200 when claims exist + change title only (non-regen update)
 * 4. allow_guests → allow_guest_slots mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock state
let mockSession: { user: { id: string } } | null = null;
let mockIsAdmin = false;
let mockIsHost = true;
let mockCurrentEvent: {
  id: string;
  has_timeslots: boolean;
  total_slots: number | null;
  slot_duration_minutes: number | null;
  published_at: string | null;
  event_date?: string | null;
  day_of_week?: string | null;
  recurrence_rule?: string | null;
  max_occurrences?: number | null;
  custom_dates?: string[] | null;
} | null = null;
let mockExistingSlots: { id: string }[] = [];
let mockClaimCount = 0;
let mockUpdateResult: { data: Record<string, unknown> | null; error: Error | null } = {
  data: { id: "event-1" },
  error: null
};
let mockRpcCalled = false;
let mockRpcError: Error | null = null;
let capturedUpdatePayload: Record<string, unknown> | null = null;
let mockTimeslotInsertCalled = false;

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
      }),
      getUser: () => Promise.resolve({
        data: { user: mockSession?.user ?? null },
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
      if (table === "event_hosts") {
        return {
          select: () => createChainable({
            data: mockIsHost ? { role: "host" } : null,
            error: null
          })
        };
      }
      if (table === "events") {
        return {
          select: () => createChainable({
            data: mockCurrentEvent,
            error: mockCurrentEvent ? null : new Error("Not found")
          }),
          update: (payload: Record<string, unknown>) => {
            capturedUpdatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve(mockUpdateResult)
                })
              })
            };
          }
        };
      }
      if (table === "event_timeslots") {
        return {
          select: () => createChainable({
            data: mockExistingSlots,
            error: null
          }),
          delete: () => createChainable({ error: null }),
          insert: () => {
            mockTimeslotInsertCalled = true;
            return Promise.resolve({ error: null });
          }
        };
      }
      if (table === "timeslot_claims") {
        return {
          select: () => ({
            in: () => ({
              in: () => ({
                data: [],
                error: null,
                count: mockClaimCount
              })
            })
          })
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
    rpc: (funcName: string) => {
      if (funcName === "generate_event_timeslots") {
        mockRpcCalled = true;
        return Promise.resolve({ data: null, error: mockRpcError });
      }
      return Promise.resolve({ data: null, error: null });
    }
  })
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: () => Promise.resolve(mockIsAdmin),
  checkHostStatus: () => Promise.resolve(mockIsHost)
}));

// Mock nextOccurrence for Phase 5.02 TypeScript-based regeneration
vi.mock("@/lib/events/nextOccurrence", () => ({
  getTodayDenver: () => "2026-01-28",
  expandOccurrencesForEvent: () => [
    { dateKey: "2026-01-28" },
    { dateKey: "2026-02-04" },
    { dateKey: "2026-02-11" }
  ]
}));

// Import AFTER mocks are set up
import { PATCH } from "@/app/api/my-events/[id]/route";

describe("PATCH /api/my-events/[id] - Timeslot behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { user: { id: "user-1" } };
    mockIsAdmin = false;
    mockIsHost = true;
    mockCurrentEvent = {
      id: "event-1",
      has_timeslots: true,
      total_slots: 10,
      slot_duration_minutes: 15,
      published_at: null,
      event_date: "2026-02-12",
      day_of_week: "thursday",
      recurrence_rule: "custom",
      max_occurrences: null,
      custom_dates: ["2026-02-12", "2026-02-19"]
    };
    mockExistingSlots = [{ id: "slot-1" }, { id: "slot-2" }];
    mockClaimCount = 0;
    mockUpdateResult = { data: { id: "event-1" }, error: null };
    mockRpcCalled = false;
    mockRpcError = null;
    capturedUpdatePayload = null;
    mockTimeslotInsertCalled = false;
  });

  describe("409 Conflict - Claims exist + regen-needed change", () => {
    it("returns 409 when trying to change total_slots with existing claims", async () => {
      mockClaimCount = 3; // 3 existing claims

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 15 // Changed from 10 to 15
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      // Phase 5.02: Error message updated to mention "future signups"
      expect(data.error).toContain("Can't change slot configuration while future signups exist");
      expect(mockRpcCalled).toBe(false); // RPC should NOT be called
      expect(capturedUpdatePayload).toBeNull(); // Update should NOT be called
    });

    it("returns 409 when trying to change slot_duration_minutes with existing claims", async () => {
      mockClaimCount = 1;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          slot_duration_minutes: 20 // Changed from 15 to 20
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(409);
      expect(mockRpcCalled).toBe(false);
    });

    it("returns 409 when enabling timeslots on event that already has claimed slots", async () => {
      mockCurrentEvent = {
        id: "event-1",
        has_timeslots: false,
        total_slots: null,
        slot_duration_minutes: null,
        published_at: null
      };
      mockClaimCount = 2;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 10
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(409);
    });
  });

  describe("200 OK - No claims + regen-needed change", () => {
    it("returns 200 and calls RPC when enabling timeslots with no claims", async () => {
      mockCurrentEvent = {
        id: "event-1",
        has_timeslots: false,
        total_slots: null,
        slot_duration_minutes: null,
        published_at: null
      };
      mockExistingSlots = []; // No existing slots
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 10,
          slot_duration_minutes: 15
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      // Phase 5.02: Regeneration now uses TypeScript-based insert, not RPC
      expect(mockTimeslotInsertCalled).toBe(true);
      expect(capturedUpdatePayload).not.toBeNull(); // Update should be called
    });

    it("returns 200 and regenerates when changing total_slots with no claims", async () => {
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 15 // Changed from 10
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      // Phase 5.02: Regeneration now uses TypeScript-based insert, not RPC
      expect(mockTimeslotInsertCalled).toBe(true);
    });

    it("returns 200 and regenerates when custom_dates change on timeslot-enabled series", async () => {
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrence_rule: "custom",
          custom_dates: ["2026-02-12", "2026-02-19", "2026-02-26"]
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      expect(mockTimeslotInsertCalled).toBe(true);
    });
  });

  describe("200 OK - Non-regen changes allowed even with claims", () => {
    it("returns 200 when changing title only (claims exist)", async () => {
      mockClaimCount = 5; // Many claims exist

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Event Title"
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      // Phase 5.02: No regen needed, so no insert should be called
      expect(mockTimeslotInsertCalled).toBe(false);
      expect(capturedUpdatePayload).not.toBeNull();
      expect(capturedUpdatePayload?.title).toBe("Updated Event Title");
    });

    it("returns 200 when changing description only (claims exist)", async () => {
      mockClaimCount = 3;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Updated description"
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
    });

    it("returns 200 when keeping same slot config (no actual change)", async () => {
      mockClaimCount = 3;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 10, // Same as current
          slot_duration_minutes: 15 // Same as current
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      // No regen needed since values didn't change
      expect(response.status).toBe(200);
      expect(mockRpcCalled).toBe(false);
    });

    it("returns 200 without regeneration when custom_dates payload matches existing series", async () => {
      mockClaimCount = 3;
      mockCurrentEvent = {
        ...mockCurrentEvent!,
        day_of_week: null,
      };

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurrence_rule: "custom",
          custom_dates: ["2026-02-12", "2026-02-19"]
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      expect(mockTimeslotInsertCalled).toBe(false);
    });
  });

  describe("allow_guests → allow_guest_slots mapping", () => {
    it("maps allow_guests to allow_guest_slots in update payload", async () => {
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allow_guests: true
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      expect(capturedUpdatePayload).not.toBeNull();
      expect(capturedUpdatePayload?.allow_guest_slots).toBe(true);
      // Form field should not be in payload
      expect(capturedUpdatePayload?.allow_guests).toBeUndefined();
    });

    it("maps allow_guests=false correctly", async () => {
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allow_guests: false
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      expect(capturedUpdatePayload?.allow_guest_slots).toBe(false);
    });
  });

  describe("Timeslot fields in allowedFields", () => {
    it("persists has_timeslots field", async () => {
      mockCurrentEvent = {
        id: "event-1",
        has_timeslots: false,
        total_slots: null,
        slot_duration_minutes: null,
        published_at: null
      };
      mockExistingSlots = [];
      mockClaimCount = 0;

      const request = new Request("http://localhost/api/my-events/event-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_timeslots: true,
          total_slots: 8,
          slot_duration_minutes: 10
        })
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "event-1" }) });

      expect(response.status).toBe(200);
      expect(capturedUpdatePayload?.has_timeslots).toBe(true);
      expect(capturedUpdatePayload?.total_slots).toBe(8);
      expect(capturedUpdatePayload?.slot_duration_minutes).toBe(10);
    });
  });
});
