/**
 * Track 1 PR 3-wiring — wiring tests for edit-turn telemetry emission
 * at the two server call sites:
 *   - POST /api/events/interpret
 *   - PATCH /api/my-events/[id]
 *
 * Asserts:
 *   - Each handler emits exactly one telemetry event on the success path
 *     with the expected shape.
 *   - Non-AI PATCHes do NOT emit.
 *   - 4xx validation exits do NOT emit.
 *   - Interpret upstream parse failures do NOT emit.
 *
 * The telemetry sink is `console.info` with the
 * `[edit-turn-telemetry]` prefix; we capture by spying on `console.info`
 * and parsing the structured line. This mirrors the PR 3 module test
 * pattern and stays decoupled from any future production-sink swap.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_TURN_TELEMETRY_LOG_PREFIX,
  type EditTurnTelemetryEvent,
} from "@/lib/events/editTurnTelemetry";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockSession: { user: { id: string; email?: string | null } } | null = null;
let mockIsAdmin = false;
let mockIsHost = true;
let mockCurrentEvent: Record<string, unknown> | null = null;
let mockUpdateResult: { data: Record<string, unknown> | null; error: { message: string } | null } = {
  data: null,
  error: null,
};
let mockOpenAiResponseBody: unknown = null;
let mockOpenAiResponseOk = true;

const createChainable = (result: unknown): Record<string, unknown> => {
  const chainable: Record<string, unknown> = {
    ...(result as object),
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
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: mockSession?.user ?? null },
            error: null,
          }),
        getSession: () =>
          Promise.resolve({
            data: { session: mockSession },
            error: null,
          }),
      },
      rpc: () =>
        // Force rate-limit RPC to error so the in-memory fallback is used
        // and tests do not depend on RPC return shape.
        Promise.resolve({ data: null, error: { message: "rpc-mock-skip", code: "P0001" } }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () =>
              createChainable({
                data: mockIsAdmin ? { role: "admin", full_name: "Admin" } : { role: "member", full_name: "Member" },
                error: null,
              }),
          };
        }
        if (table === "event_hosts") {
          return {
            select: () =>
              createChainable({
                data: mockIsHost ? { role: "host" } : null,
                error: null,
              }),
          };
        }
        if (table === "events") {
          return {
            select: () =>
              createChainable({
                data: mockCurrentEvent,
                error: mockCurrentEvent ? null : { message: "not_found" },
              }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve(mockUpdateResult),
                }),
              }),
            }),
          };
        }
        if (table === "event_timeslots") {
          return {
            select: () => createChainable({ data: [], error: null }),
            delete: () => createChainable({ error: null }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === "timeslot_claims" || table === "event_rsvps") {
          return {
            select: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: [], error: null, count: 0 }),
              }),
              in: () => ({
                in: () => Promise.resolve({ data: [], error: null, count: 0 }),
              }),
            }),
          };
        }
        if (table === "venues") {
          // Venues is queried two ways:
          //   - interpret route: .select().order().limit() → expects array
          //   - my-events route: .select().eq().single() → expects single row
          const rows = [
            { id: "venue-1", name: "Test Venue", slug: "test-venue", address: "1 Main", city: "Denver", state: "CO" },
          ];
          return {
            select: () => {
              const chainable: Record<string, unknown> = {
                data: rows,
                error: null,
              };
              chainable.eq = () => chainable;
              chainable.in = () => chainable;
              chainable.order = () => chainable;
              chainable.limit = () => chainable;
              chainable.single = () => ({ data: rows[0], error: null });
              chainable.maybeSingle = () => ({ data: rows[0], error: null });
              return chainable;
            },
          };
        }
        return {
          select: () => createChainable({ data: [], error: null }),
        };
      },
    }),
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: () => Promise.resolve(mockIsAdmin),
  checkHostStatus: () => Promise.resolve(mockIsHost),
}));

vi.mock("@/lib/events/eventManageAuth", () => ({
  canManageEvent: () => Promise.resolve(true),
  canEditEventVisibility: () => Promise.resolve(true),
}));

vi.mock("@/lib/notifications/eventUpdated", () => ({
  sendEventUpdatedNotifications: () => Promise.resolve(),
}));

vi.mock("@/lib/notifications/eventCancelled", () => ({
  sendEventCancelledNotifications: () => Promise.resolve(),
}));

vi.mock("@/lib/email/adminEventAlerts", () => ({
  sendAdminEventAlert: () => Promise.resolve(),
}));

vi.mock("@/lib/events/sharePreview", () => ({
  warmEventSharePreview: () => Promise.resolve(),
}));

vi.mock("@/lib/mediaEmbedsServer", () => ({
  upsertMediaEmbeds: () => Promise.resolve(),
}));

vi.mock("@/lib/events/nextOccurrence", () => ({
  getTodayDenver: () => "2026-05-01",
  expandOccurrencesForEvent: () => [],
}));

// ---------------------------------------------------------------------------
// Imports must follow vi.mock declarations
// ---------------------------------------------------------------------------

import { POST as interpretPOST } from "@/app/api/events/interpret/route";
import { PATCH as myEventsPATCH } from "@/app/api/my-events/[id]/route";

// ---------------------------------------------------------------------------
// Telemetry capture helpers
// ---------------------------------------------------------------------------

function captureTelemetry(): {
  events: EditTurnTelemetryEvent[];
  spy: ReturnType<typeof vi.spyOn>;
} {
  const events: EditTurnTelemetryEvent[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first !== "string") return;
    if (!first.startsWith(`${EDIT_TURN_TELEMETRY_LOG_PREFIX} `)) return;
    const json = first.slice(EDIT_TURN_TELEMETRY_LOG_PREFIX.length + 1);
    try {
      events.push(JSON.parse(json) as EditTurnTelemetryEvent);
    } catch {
      /* ignore non-telemetry [edit-turn-telemetry] noise */
    }
  });
  return { events, spy };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  mockSession = { user: { id: "user-1", email: "user-1@example.com" } };
  mockIsAdmin = false;
  mockIsHost = true;
  mockCurrentEvent = null;
  mockUpdateResult = { data: null, error: null };
  mockOpenAiResponseBody = null;
  mockOpenAiResponseOk = true;
  process.env = { ...ORIGINAL_ENV };
  process.env.ENABLE_NL_EVENTS_INTERPRETER = "true";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_EVENT_INTERPRETER_MODEL = "test-interpreter-model";
  process.env.OPENAI_EVENT_VISION_MODEL = "test-vision-model";
  process.env.OPENAI_EVENT_DRAFT_VERIFIER_MODEL = "test-verifier-model";
  process.env.OPENAI_EVENT_WEB_SEARCH_MODEL = "test-search-model";
  // Disable web search to keep tests deterministic; default is enabled.
  process.env.OPENAI_EVENT_WEB_SEARCH_ENABLED = "false";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

// Build an OpenAI Responses API success body whose embedded JSON satisfies
// the interpret route's parser (next_action, confidence, summary, scope).
function buildOpenAiResponse(payload: Record<string, unknown>): unknown {
  return {
    id: "resp_test",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(payload),
          },
        ],
      },
    ],
  };
}

function installFetchMock(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(global, "fetch").mockImplementation(async () => {
    if (!mockOpenAiResponseOk) {
      return new Response(JSON.stringify({ error: "upstream" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const body = mockOpenAiResponseBody ?? buildOpenAiResponse({
      next_action: "show_preview",
      confidence: 0.9,
      human_summary: "Drafted from the input.",
      clarification_question: null,
      blocking_fields: [],
      scope: "series",
      draft_payload: { title: "Tuesday Open Mic" },
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

// ---------------------------------------------------------------------------
// POST /api/events/interpret
// ---------------------------------------------------------------------------

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("POST /api/events/interpret — edit-turn telemetry wiring", () => {
  it("emits exactly one telemetry event for a successful create-mode interpretation", async () => {
    installFetchMock();
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/events/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "create",
        message: "Open mic next Tuesday at 7pm at Lost Lake",
        use_web_search: false,
      }),
    });

    const response = await interpretPOST(request);

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.mode).toBe("create");
    expect(event.currentEventId).toBeNull();
    expect(event.priorStateHash).toBeNull();
    expect(event.scopeDecision).toBe("series");
    expect(event.proposedChangedFields).toContain("title");
    expect(event.modelId).toBe("test-interpreter-model");
    expect(typeof event.modelId).toBe("string");
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(event.userOutcome).toBe("unknown");
    // PR 3 follow-up: turnId is generated server-side per request and
    // shaped as UUIDv4. Same id is echoed in the response body below.
    expect(event.turnId).toMatch(UUID_V4_RE);
    const body = await response.json();
    expect(body.editTurnId).toBe(event.turnId);
  });

  it("interpret error responses do NOT include editTurnId", async () => {
    installFetchMock();

    const request = new Request("http://localhost/api/events/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "not_a_real_mode",
        message: "anything",
      }),
    });

    const response = await interpretPOST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).not.toHaveProperty("editTurnId");
  });

  it("emits with currentEventId, priorStateHash, and scopeDecision for an edit_series interpretation", async () => {
    installFetchMock();
    mockCurrentEvent = {
      id: "evt-42",
      title: "Existing Event",
      event_date: "2026-05-15",
      start_time: "19:00:00",
    };
    mockOpenAiResponseBody = buildOpenAiResponse({
      next_action: "show_preview",
      confidence: 0.85,
      human_summary: "Updated start time.",
      clarification_question: null,
      blocking_fields: [],
      scope: "series",
      draft_payload: { start_time: "20:00:00" },
    });
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/events/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "edit_series",
        eventId: "evt-42",
        message: "Move start time to 8pm",
        use_web_search: false,
      }),
    });

    const response = await interpretPOST(request);

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.mode).toBe("edit_series");
    expect(event.currentEventId).toBe("evt-42");
    expect(event.priorStateHash).toMatch(/^[0-9a-f]{16}$/);
    expect(event.scopeDecision).toBe("series");
    expect(event.proposedChangedFields).toContain("start_time");
    expect(event.modelId).toBe("test-interpreter-model");
  });

  it("does NOT emit when the interpret route exits early on a 4xx validation failure", async () => {
    installFetchMock();
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/events/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "not_a_real_mode",
        message: "anything",
      }),
    });

    const response = await interpretPOST(request);

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("does NOT emit when the upstream OpenAI call fails (502 exit)", async () => {
    mockOpenAiResponseOk = false;
    installFetchMock();
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/events/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "create",
        message: "Open mic next Tuesday",
        use_web_search: false,
      }),
    });

    const response = await interpretPOST(request);

    expect(response.status).toBe(502);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/my-events/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/my-events/[id] — edit-turn telemetry wiring", () => {
  beforeEach(() => {
    mockCurrentEvent = {
      id: "event-99",
      title: "Old Title",
      description: "Old description",
      event_type: ["open_mic"],
      is_published: true,
      start_time: "18:00:00",
      end_time: "21:00:00",
      event_date: "2026-05-15",
      day_of_week: "friday",
      recurrence_rule: null,
      max_occurrences: null,
      custom_dates: null,
      has_timeslots: false,
      total_slots: null,
      slot_duration_minutes: null,
      venue_id: null,
      venue_name: null,
      venue_address: null,
      cover_image_url: null,
    };
    mockUpdateResult = {
      data: {
        id: "event-99",
        slug: "event-99-slug",
        updated_at: "2026-05-01T12:00:00Z",
        is_published: true,
      },
      error: null,
    };
  });

  it("emits exactly one telemetry event for an AI-origin PATCH that successfully writes", async () => {
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Brand new description from AI",
        ai_write_source: "conversational_create_ui_auto_apply",
        ai_confirm_published_high_risk: true,
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.mode).toBe("edit_series");
    expect(event.currentEventId).toBe("event-99");
    expect(event.priorStateHash).toMatch(/^[0-9a-f]{16}$/);
    expect(event.scopeDecision).toBe("series");
    expect(event.proposedChangedFields).toContain("description");
    expect(["low", "medium", "high"]).toContain(event.riskTier);
    expect(["enforced", "shadow"]).toContain(event.enforcementMode);
    expect(Array.isArray(event.blockedFields)).toBe(true);
    expect(event.verifierAutoPatchedFields).toEqual([]);
    expect(event.modelId).toBeNull();
    expect(event.userOutcome).toBe("unknown");
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    // PR 3 follow-up: turnId is UUIDv4 and echoed in the response body
    // for the AI-origin success path.
    expect(event.turnId).toMatch(UUID_V4_RE);
    const body = await response.json();
    expect(body.editTurnId).toBe(event.turnId);
  });

  it("non-AI manual PATCH success response does NOT include editTurnId", async () => {
    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Manual host edit, no AI",
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("editTurnId");
  });

  it("populates blockedFields with high+enforced changes for an AI-origin PATCH that touches a high-risk field", async () => {
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_time: "19:00:00",
        ai_write_source: "conversational_create_ui_auto_apply",
        ai_confirm_published_high_risk: true,
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.blockedFields).toContain("start_time");
    expect(event.riskTier).toBe("high");
    expect(event.enforcementMode).toBe("enforced");
  });

  it("does NOT emit for a non-AI manual PATCH that successfully writes", async () => {
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Manual host edit, no AI",
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(200);
    expect(events).toHaveLength(0);
  });

  it("does NOT emit when the AI PATCH is blocked early by the published-event gate (409)", async () => {
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_time: "19:00:00",
        ai_write_source: "conversational_create_ui_auto_apply",
        // No ai_confirm_published_high_risk — gate should block.
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(409);
    expect(events).toHaveLength(0);
  });

  it("does NOT emit when an AI PATCH exits early on a 400 validation failure", async () => {
    const { events } = captureTelemetry();

    const request = new Request("http://localhost/api/my-events/event-99", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: [],
        ai_write_source: "conversational_create_ui_auto_apply",
        ai_confirm_published_high_risk: true,
      }),
    });

    const response = await myEventsPATCH(request, {
      params: Promise.resolve({ id: "event-99" }),
    });

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });
});
