/**
 * Track 1 PR 3 follow-up — endpoint tests for the thin
 * `/api/events/telemetry/edit-turn` outcome-forwarder.
 *
 * Asserts:
 *   - 401 without a session, no emit.
 *   - 200 + emit on a well-formed accepted body.
 *   - 200 + emit on a well-formed rejected body.
 *   - 400 (no emit) on malformed turnId.
 *   - 400 (no emit) on malformed userOutcome (`unknown` is rejected by
 *     the endpoint — outcome events must be definitive).
 *   - 400 (no emit) on missing fields.
 *   - Server sets `occurredAt`; client-supplied values are ignored.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_TURN_OUTCOME_LOG_PREFIX,
  type EditTurnOutcomeEvent,
} from "@/lib/events/editTurnTelemetry";

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockSession: { user: { id: string; email?: string | null } } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: mockSession?.user ?? null },
            error: null,
          }),
      },
    }),
}));

import { POST as editTurnOutcomePOST } from "@/app/api/events/telemetry/edit-turn/route";

const VALID_TURN_ID = "abcdef01-2345-4678-9abc-def012345678";

function captureOutcomes(): {
  events: EditTurnOutcomeEvent[];
  spy: ReturnType<typeof vi.spyOn>;
} {
  const events: EditTurnOutcomeEvent[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    if (typeof first !== "string") return;
    if (!first.startsWith(`${EDIT_TURN_OUTCOME_LOG_PREFIX} `)) return;
    const json = first.slice(EDIT_TURN_OUTCOME_LOG_PREFIX.length + 1);
    try {
      events.push(JSON.parse(json) as EditTurnOutcomeEvent);
    } catch {
      /* ignore malformed lines */
    }
  });
  return { events, spy };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockSession = { user: { id: "user-1", email: "user-1@example.com" } };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/events/telemetry/edit-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/events/telemetry/edit-turn", () => {
  it("returns 401 and does not emit when no session is present", async () => {
    mockSession = null;
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID, userOutcome: "accepted" }),
    );

    expect(response.status).toBe(401);
    expect(events).toHaveLength(0);
  });

  it("returns 200 and emits one outcome event for a well-formed accepted body", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID, userOutcome: "accepted" }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });

    expect(events).toHaveLength(1);
    expect(events[0].turnId).toBe(VALID_TURN_ID);
    expect(events[0].userOutcome).toBe("accepted");
  });

  it("returns 200 and emits one outcome event for a well-formed rejected body", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID, userOutcome: "rejected" }),
    );

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0].userOutcome).toBe("rejected");
  });

  it("returns 400 and does not emit on malformed turnId", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: "not-a-uuid", userOutcome: "accepted" }),
    );

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("returns 400 and does not emit when userOutcome is 'unknown' (must be definitive)", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID, userOutcome: "unknown" }),
    );

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("returns 400 and does not emit on enum-violating userOutcome", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID, userOutcome: "maybe" }),
    );

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("returns 400 and does not emit on missing turnId", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ userOutcome: "accepted" }),
    );

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("returns 400 and does not emit on missing userOutcome", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(
      makeRequest({ turnId: VALID_TURN_ID }),
    );

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("returns 400 and does not emit on invalid JSON body", async () => {
    const { events } = captureOutcomes();

    const response = await editTurnOutcomePOST(makeRequest("{ not json"));

    expect(response.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it("server-sets occurredAt regardless of any client-supplied value", async () => {
    const { events } = captureOutcomes();
    const startedAt = Date.now();

    // Client tries to backdate occurredAt; endpoint must overwrite.
    const response = await editTurnOutcomePOST(
      makeRequest({
        turnId: VALID_TURN_ID,
        userOutcome: "accepted",
        occurredAt: "1999-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0].occurredAt).not.toBe("1999-01-01T00:00:00.000Z");
    const emittedTime = Date.parse(events[0].occurredAt);
    expect(emittedTime).toBeGreaterThanOrEqual(startedAt);
    expect(emittedTime).toBeLessThanOrEqual(Date.now() + 100);
  });
});
