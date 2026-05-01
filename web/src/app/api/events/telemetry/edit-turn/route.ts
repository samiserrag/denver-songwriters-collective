import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildEditTurnOutcomeEvent,
  emitEditTurnOutcome,
  type EditTurnDefinitiveOutcome,
} from "@/lib/events/editTurnTelemetry";

/**
 * POST /api/events/telemetry/edit-turn
 *
 * Track 1 PR 3 follow-up: thin telemetry forwarder for client-side
 * user accept/reject signals, correlated to the initial edit-turn
 * telemetry event by `turnId`.
 *
 * Behavior:
 *   - Authenticates via the standard Supabase server-client cookie session.
 *   - Validates body shape: `{ turnId: UUIDv4, userOutcome: "accepted" | "rejected" }`.
 *   - Builds + emits one `EditTurnOutcomeEvent` via the shared `console.info`
 *     sink with the `[edit-turn-outcome]` prefix.
 *   - Server-sets `occurredAt`; any client-supplied value is ignored.
 *   - Performs no DB lookup or write — pure telemetry forwarding.
 *   - Fire-and-forget: returns `{ ok: true }` on success and never echoes
 *     the user outcome back to the caller.
 *
 * Out of scope: rate limiting (telemetry call frequency is bounded by
 * UI accept/reject gestures, not a plausible DoS vector at expected volume).
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDefinitiveOutcome(value: unknown): value is EditTurnDefinitiveOutcome {
  return value === "accepted" || value === "rejected";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser },
    error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const { turnId, userOutcome } = b;

  if (typeof turnId !== "string" || !UUID_V4_RE.test(turnId)) {
    return NextResponse.json(
      { error: "turnId must be a UUIDv4 string" },
      { status: 400 },
    );
  }

  if (!isDefinitiveOutcome(userOutcome)) {
    return NextResponse.json(
      { error: "userOutcome must be 'accepted' or 'rejected'" },
      { status: 400 },
    );
  }

  // Server-set occurredAt — client-supplied timestamps are intentionally ignored.
  emitEditTurnOutcome(buildEditTurnOutcomeEvent({ turnId, userOutcome }));

  return NextResponse.json({ ok: true });
}
