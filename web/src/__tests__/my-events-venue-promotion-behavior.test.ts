import { beforeEach, describe, expect, it, vi } from "vitest";

type VenueCandidate = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
};

let mockSessionUserId = "user-123";
let mockIsAdmin = false;
let mockIsHost = true;
let mockVenueCandidates: VenueCandidate[] = [];
let mockVenueById: Record<string, { name: string; address: string; city: string; state: string }> = {};
let capturedEventInsertPayloads: Record<string, unknown>[] = [];
let capturedCanonicalVenueInserts: Record<string, unknown>[] = [];
let mockCanonicalVenueInsertResult: { data: VenueCandidate | null; error: Error | null } = {
  data: { id: "venue-canonical-1", name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: mockSessionUserId } }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { role: mockIsAdmin ? "admin" : "member", full_name: "Test User" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "venues") {
        return {
          select: (columns: string) => {
            if (columns.includes("id, name, address, city, state")) {
              return {
                ilike: () => ({
                  limit: async () => ({ data: mockVenueCandidates, error: null }),
                }),
              };
            }

            if (columns.includes("name, address, city, state")) {
              return {
                eq: (_field: string, id: string) => ({
                  single: async () => ({
                    data: mockVenueById[id] ?? null,
                    error: null,
                  }),
                }),
              };
            }

            return {
              eq: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            };
          },
        };
      }

      if (table === "events") {
        return {
          insert: (payload: Record<string, unknown>) => {
            capturedEventInsertPayloads.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "event-1", event_date: payload.event_date ?? null, slug: "event-1" },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "event_hosts") {
        return {
          insert: async () => ({ data: {}, error: null }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table !== "venues") {
        throw new Error(`Unexpected table for service role client: ${table}`);
      }
      return {
        insert: (payload: Record<string, unknown>) => {
          capturedCanonicalVenueInserts.push(payload);
          return {
            select: () => ({
              single: async () => mockCanonicalVenueInsertResult,
            }),
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkHostStatus: async () => mockIsHost,
}));

vi.mock("@/lib/venue/geocoding", () => ({
  processVenueGeocodingWithStatus: async (_existing: unknown, updates: Record<string, unknown>) => ({
    updates,
    geocodingStatus: { success: true },
  }),
}));

vi.mock("@/lib/email/adminEventAlerts", () => ({
  sendAdminEventAlert: async () => {},
}));

import { POST } from "@/app/api/my-events/route";

describe("POST /api/my-events venue auto-promotion behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserId = "user-123";
    mockIsAdmin = false;
    mockIsHost = true;
    mockVenueCandidates = [];
    mockVenueById = {};
    capturedEventInsertPayloads = [];
    capturedCanonicalVenueInserts = [];
    mockCanonicalVenueInsertResult = {
      data: { id: "venue-canonical-1", name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
      error: null,
    };
  });

  it("preserves hybrid mode when strong venue match is promoted and online_url exists", async () => {
    mockVenueCandidates = [
      { id: "venue-1", name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
    ];
    mockVenueById = {
      "venue-1": { name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
    };

    const request = new Request("http://localhost/api/my-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Hybrid Test Event",
        event_type: ["open_mic"],
        start_time: "19:00",
        start_date: "2026-03-09",
        location_mode: "hybrid",
        online_url: "https://zoom.us/j/123",
        custom_location_name: "The End",
        custom_address: "111 Main St",
        custom_city: "Denver",
        custom_state: "CO",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(capturedEventInsertPayloads).toHaveLength(1);
    expect(capturedEventInsertPayloads[0].venue_id).toBe("venue-1");
    expect(capturedEventInsertPayloads[0].location_mode).toBe("hybrid");
    expect(capturedEventInsertPayloads[0].custom_location_name).toBeNull();
    expect(capturedCanonicalVenueInserts).toHaveLength(0);
  });

  it("treats ambiguous same-name candidates as custom-location fallback and skips canonical create", async () => {
    mockIsAdmin = true;
    mockVenueCandidates = [
      { id: "venue-1", name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
      { id: "venue-2", name: "The End", address: "222 Main St", city: "Denver", state: "CO" },
    ];

    const request = new Request("http://localhost/api/my-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Ambiguous Venue Event",
        event_type: ["open_mic"],
        start_time: "19:00",
        start_date: "2026-03-09",
        location_mode: "venue",
        custom_location_name: "The End",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(capturedEventInsertPayloads).toHaveLength(1);
    expect(capturedEventInsertPayloads[0].venue_id).toBeNull();
    expect(capturedEventInsertPayloads[0].custom_location_name).toBe("The End");
    expect(capturedCanonicalVenueInserts).toHaveLength(0);
  });

  it("allows admin canonical venue creation only for no-match candidates", async () => {
    mockIsAdmin = true;
    mockVenueCandidates = [];
    mockVenueById = {
      "venue-canonical-1": { name: "The End", address: "111 Main St", city: "Denver", state: "CO" },
    };

    const request = new Request("http://localhost/api/my-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Admin Canonical Create",
        event_type: ["open_mic"],
        start_time: "19:00",
        start_date: "2026-03-09",
        location_mode: "venue",
        custom_location_name: "The End",
        custom_address: "111 Main St",
        custom_city: "Denver",
        custom_state: "CO",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(capturedCanonicalVenueInserts).toHaveLength(1);
    expect(capturedEventInsertPayloads).toHaveLength(1);
    expect(capturedEventInsertPayloads[0].venue_id).toBe("venue-canonical-1");
    expect(capturedEventInsertPayloads[0].location_mode).toBe("venue");
  });
});
