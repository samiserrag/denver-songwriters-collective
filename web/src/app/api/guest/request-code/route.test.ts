import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock feature flag - set before importing route
let mockFeatureFlagEnabled = false;

vi.mock("@/lib/guest-verification/config", () => ({
  isGuestVerificationEnabled: () => mockFeatureFlagEnabled,
  featureDisabledResponse: () =>
    new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  GUEST_VERIFICATION_CONFIG: {
    CODE_LENGTH: 6,
    CODE_EXPIRES_MINUTES: 15,
    CODE_CHARSET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    MAX_CODES_PER_EMAIL_PER_HOUR: 3,
    MAX_CODE_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 30,
    ACTION_TOKEN_EXPIRES_HOURS: 24,
    MAX_GUEST_CLAIMS_PER_EVENT_PERCENT: 50,
  },
}));

vi.mock("@/lib/guest-verification/crypto", () => ({
  generateVerificationCode: () => "ABC123",
  hashCode: (code: string) => `hashed_${code}`,
}));

// Mock email module
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getVerificationCodeEmail: () => ({
    subject: "Test Subject",
    html: "<p>Test HTML</p>",
    text: "Test text",
  }),
}));

// Mock state
let mockEvent: { id: string; title: string; is_published: boolean; has_timeslots: boolean } | null = null;
let mockTimeslot: { id: string } | null = null;
let mockExistingClaims: Array<{ id: string; status: string; timeslot_id: string }> = [];
let mockRecentCodes: Array<{ id: string; created_at: string }> = [];
let mockLockedVerification: { id: string; locked_until: string } | null = null;
let mockInsertResult: { data: { id: string } | null; error: Error | null } = {
  data: { id: "verification-1" },
  error: null,
};

// Helper to create deeply chainable mock that returns result at any depth
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

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "events") {
        return {
          select: () => createChainable({
            data: mockEvent,
            error: mockEvent ? null : new Error("Not found"),
          }),
        };
      }
      if (table === "event_timeslots") {
        return {
          select: () => createChainable({
            data: mockTimeslot,
            error: mockTimeslot ? null : new Error("Not found"),
          }),
        };
      }
      if (table === "timeslot_claims") {
        return {
          select: () => createChainable({
            data: mockExistingClaims,
            error: null,
          }),
        };
      }
      if (table === "guest_verifications") {
        // Track query context to return appropriate data
        const queryContext = { isLockedQuery: false };

        // Create chainable that returns recentCodes data at gte() terminal
        const createGvChainable = (): Record<string, unknown> => {
          const chainable: Record<string, unknown> = {
            eq: () => chainable,
            not: () => {
              queryContext.isLockedQuery = true;
              return chainable;
            },
            gt: () => chainable,
            gte: () => ({
              // gte is terminal for recentCodes query
              data: mockRecentCodes,
              error: null,
            }),
            is: () => chainable,
            maybeSingle: () => ({
              data: queryContext.isLockedQuery ? mockLockedVerification : null,
              error: null,
            }),
            data: [],
            error: null,
          };
          return chainable;
        };

        return {
          select: () => {
            // Reset context for each select call
            queryContext.isLockedQuery = false;
            return createGvChainable();
          },
          delete: () => createChainable({ data: null, error: null }),
          insert: () => ({
            select: () => ({
              single: () => mockInsertResult,
            }),
          }),
        };
      }
      return {
        select: () => createChainable({ data: [], error: null }),
      };
    },
  }),
}));

import { POST } from "./route";

describe("POST /api/guest/request-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagEnabled = true;
    mockEvent = null;
    mockTimeslot = null;
    mockExistingClaims = [];
    mockRecentCodes = [];
    mockLockedVerification = null;
    mockInsertResult = { data: { id: "verification-1" }, error: null };
  });

  it("returns 404 when feature flag is OFF", async () => {
    mockFeatureFlagEnabled = false;

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        // missing other fields
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing");
  });

  it("returns 400 for invalid email format", async () => {
    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "not-an-email",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("email");
  });

  it("returns 404 when event not found", async () => {
    mockEvent = null;

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "nonexistent",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when event is not published", async () => {
    mockEvent = { id: "event-1", title: "Test Open Mic", is_published: false, has_timeslots: true };

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("published");
  });

  it("returns 400 when event does not support timeslots", async () => {
    mockEvent = { id: "event-1", title: "Test Open Mic", is_published: true, has_timeslots: false };

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("timeslots");
  });

  it("returns 429 when rate limited", async () => {
    mockEvent = { id: "event-1", title: "Test Open Mic", is_published: true, has_timeslots: true };
    mockTimeslot = { id: "slot-1" };
    mockRecentCodes = [
      { id: "1", created_at: new Date().toISOString() },
      { id: "2", created_at: new Date().toISOString() },
      { id: "3", created_at: new Date().toISOString() },
    ];

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many");
    expect(json.retry_after).toBeDefined();
  });

  it("returns 429 when locked out", async () => {
    mockEvent = { id: "event-1", title: "Test Open Mic", is_published: true, has_timeslots: true };
    mockTimeslot = { id: "slot-1" };
    mockLockedVerification = {
      id: "v-1",
      locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("failed attempts");
  });

  it("returns success with verification_id and expires_at", async () => {
    mockEvent = { id: "event-1", title: "Test Open Mic", is_published: true, has_timeslots: true };
    mockTimeslot = { id: "slot-1" };

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.verification_id).toBe("verification-1");
    expect(json.expires_at).toBeDefined();
    expect(json.message).toContain("code sent");
  });
});

describe("request-code validation", () => {
  it("validates slot index is non-negative", async () => {
    mockFeatureFlagEnabled = true;

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: -1,
        guest_name: "Test Guest",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid slot");
  });

  it("validates guest name minimum length", async () => {
    mockFeatureFlagEnabled = true;

    const req = new Request("http://localhost/api/guest/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "event-1",
        slot_index: 0,
        guest_name: "A",
        guest_email: "test@example.com",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Guest name");
  });
});
