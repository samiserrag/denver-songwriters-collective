import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock feature flag - uses kill switch (true = disabled, false = enabled)
let mockFeatureFlagDisabled = false;

vi.mock("@/lib/guest-verification/config", () => ({
  isGuestVerificationDisabled: () => mockFeatureFlagDisabled,
  featureDisabledResponse: () =>
    new Response(JSON.stringify({ error: "Guest verification temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
}));

// Mock crypto
let mockTokenPayload: {
  email: string;
  claim_id: string;
  action: "confirm" | "cancel";
  verification_id: string;
} | null = null;

vi.mock("@/lib/guest-verification/crypto", () => ({
  verifyActionToken: async () => mockTokenPayload,
  createActionToken: async () => "mock-token-123",
}));

// Mock email module
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getWaitlistOfferEmail: () => ({
    subject: "Test Subject",
    html: "<p>Test HTML</p>",
    text: "Test text",
  }),
}));

// Mock state
let mockVerification: { id: string; token_used: boolean; claim_id: string } | null = null;
let mockClaim: {
  id: string;
  status: string;
  guest_email: string;
  timeslot_id: string;
  offer_expires_at: string | null;
  event_timeslots: { event_id: string };
} | null = null;
let mockEvent: { id: string; title: string; slot_offer_window_minutes: number } | null = null;
const mockPromotedClaim: { id: string; guest_email: string; guest_name: string; offer_expires_at: string; guest_verification_id: string } | null = null;
let mockRpcCalled = false;

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "guest_verifications") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: mockVerification,
                error: mockVerification ? null : new Error("Not found"),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ data: null, error: null }),
          }),
        };
      }
      if (table === "timeslot_claims") {
        // Track query context
        let queryingOffered = false;
        const claimsChainable: Record<string, unknown> = {
          eq: (col: string, val: string) => {
            if (col === "status" && val === "offered") queryingOffered = true;
            return claimsChainable;
          },
          single: () => ({
            data: mockClaim,
            error: mockClaim ? null : new Error("Not found"),
          }),
          maybeSingle: () => ({
            data: queryingOffered ? mockPromotedClaim : null,
            error: null,
          }),
        };
        return {
          select: () => claimsChainable,
          update: () => ({
            eq: () => ({ data: null, error: null }),
          }),
        };
      }
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: mockEvent,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ data: [], error: null }) }),
      };
    },
    rpc: () => {
      mockRpcCalled = true;
      return { data: null, error: null };
    },
  }),
}));

import { POST } from "./route";

describe("POST /api/guest/action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagDisabled = false;
    mockTokenPayload = {
      email: "test@example.com",
      claim_id: "claim-1",
      action: "confirm",
      verification_id: "v-1",
    };
    mockVerification = {
      id: "v-1",
      token_used: false,
      claim_id: "claim-1",
    };
    mockClaim = {
      id: "claim-1",
      status: "offered",
      guest_email: "test@example.com",
      timeslot_id: "slot-1",
      offer_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      event_timeslots: { event_id: "event-1" },
    };
    mockEvent = { slot_offer_window_minutes: 120 };
    mockRpcCalled = false;
  });

  it("returns 503 when kill switch is ON", async () => {
    mockFeatureFlagDisabled = true;

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Guest verification temporarily unavailable");
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        // missing action
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid action", async () => {
    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "invalid",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid action");
  });

  it("returns 400 for invalid token", async () => {
    mockTokenPayload = null;

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "invalid-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid or expired");
  });

  it("returns 400 when action does not match token", async () => {
    mockTokenPayload!.action = "cancel";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm", // Token says cancel
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("mismatch");
  });

  it("returns 400 when token already used", async () => {
    mockVerification!.token_used = true;

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already been used");
  });

  it("returns 403 when email does not match claim", async () => {
    mockClaim!.guest_email = "other@example.com";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("does not match");
  });
});

describe("confirm action", () => {
  beforeEach(() => {
    mockFeatureFlagDisabled = false;
    mockTokenPayload = {
      email: "test@example.com",
      claim_id: "claim-1",
      action: "confirm",
      verification_id: "v-1",
    };
    mockVerification = { id: "v-1", token_used: false, claim_id: "claim-1" };
    mockClaim = {
      id: "claim-1",
      status: "offered",
      guest_email: "test@example.com",
      timeslot_id: "slot-1",
      offer_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      event_timeslots: { event_id: "event-1" },
    };
  });

  it("confirms an offered slot", async () => {
    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Slot confirmed");
  });

  it("returns 400 when slot not in offered status", async () => {
    mockClaim!.status = "waitlist";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not in offered");
  });

  it("returns 400 when already confirmed", async () => {
    mockClaim!.status = "confirmed";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already confirmed");
  });

  it("returns 400 when offer expired", async () => {
    mockClaim!.offer_expires_at = new Date(Date.now() - 1000).toISOString();

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("expired");
  });
});

describe("cancel action", () => {
  beforeEach(() => {
    mockFeatureFlagDisabled = false;
    mockTokenPayload = {
      email: "test@example.com",
      claim_id: "claim-1",
      action: "cancel",
      verification_id: "v-1",
    };
    mockVerification = { id: "v-1", token_used: false, claim_id: "claim-1" };
    mockClaim = {
      id: "claim-1",
      status: "confirmed",
      guest_email: "test@example.com",
      timeslot_id: "slot-1",
      offer_expires_at: null,
      event_timeslots: { event_id: "event-1" },
    };
    mockEvent = { slot_offer_window_minutes: 120 };
    mockRpcCalled = false;
  });

  it("cancels a confirmed claim", async () => {
    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "cancel",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Claim cancelled");
  });

  it("triggers waitlist promotion on cancel", async () => {
    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "cancel",
      }),
    });

    await POST(req);
    expect(mockRpcCalled).toBe(true);
  });

  it("cancels a waitlist claim without promotion", async () => {
    mockClaim!.status = "waitlist";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "cancel",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockRpcCalled).toBe(false); // No promotion for waitlist cancels
  });

  it("returns 400 when claim already cancelled", async () => {
    mockClaim!.status = "cancelled";

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "cancel",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("cannot be cancelled");
  });
});

describe("public data protection", () => {
  it("never exposes full email in success responses", async () => {
    mockFeatureFlagDisabled = false;
    mockTokenPayload = {
      email: "test@example.com",
      claim_id: "claim-1",
      action: "confirm",
      verification_id: "v-1",
    };
    mockVerification = { id: "v-1", token_used: false, claim_id: "claim-1" };
    mockClaim = {
      id: "claim-1",
      status: "offered",
      guest_email: "test@example.com",
      timeslot_id: "slot-1",
      offer_expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      event_timeslots: { event_id: "event-1" },
    };

    const req = new Request("http://localhost/api/guest/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "some-token",
        action: "confirm",
      }),
    });

    const res = await POST(req);
    const text = await res.text();

    // Response should not contain the full email
    expect(text).not.toContain("test@example.com");
  });
});
