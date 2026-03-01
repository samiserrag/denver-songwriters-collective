import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Phase 9A: Lightweight telemetry endpoint for client-only funnel signals.
// Logs event name + trace_id to console.info (Axiom-visible).
// No PII logged — userId is intentionally omitted (trace_id suffices).
// ---------------------------------------------------------------------------

const ALLOWED_EVENTS = new Set([
  "interpreter_impression",
  "fallback_click",
]);

// Best-effort, non-persistent in-memory rate limiter.
// Serverless functions may share or reset this state across cold starts;
// this provides coarse protection, not strict enforcement.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
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

  if (!checkRateLimit(sessionUser.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

  const traceId =
    typeof b.trace_id === "string" && /^[a-f0-9-]{1,64}$/i.test(b.trace_id)
      ? b.trace_id
      : null;
  const eventName =
    typeof b.event_name === "string" ? b.event_name : null;
  const timestamp =
    typeof b.timestamp === "string" ? b.timestamp : null;
  const surface =
    typeof b.surface === "string" ? b.surface.slice(0, 64) : null;

  if (!traceId || !eventName || !timestamp) {
    return NextResponse.json(
      { error: "trace_id, event_name, and timestamp are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json(
      { error: `Unknown event_name: ${eventName}` },
      { status: 400 }
    );
  }

  console.info("[events/telemetry]", {
    traceId,
    eventName,
    surface,
    timestamp,
  });

  return NextResponse.json({ ok: true });
}
