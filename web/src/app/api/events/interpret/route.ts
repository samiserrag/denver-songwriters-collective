import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import {
  buildInterpretResponseSchema,
  buildQualityHints,
  sanitizeInterpretDraftPayload,
  validateInterpretMode,
  validateNextAction,
  validateSanitizedDraftPayload,
  type InterpretEventRequestBody,
} from "@/lib/events/interpretEventContract";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INTERPRETER_MODEL = "gpt-5.2";

// PREVIEW-ONLY RATE LIMITER:
// This in-memory map does not survive cold starts or multi-instance serverless routing.
// TODO(before main/GA): replace with persistent atomic storage (e.g., Redis/KV/Supabase RPC).
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractResponseText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  for (const chunk of output) {
    const chunkObj = parseJsonObject(chunk);
    if (!chunkObj) continue;
    const content = Array.isArray(chunkObj.content) ? chunkObj.content : [];
    for (const part of content) {
      const partObj = parseJsonObject(part);
      if (!partObj) continue;
      if (typeof partObj.text === "string" && partObj.text.trim().length > 0) {
        return partObj.text;
      }
    }
  }

  return null;
}

function redactEmails(input: string): string {
  return input.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]");
}

function truncate(input: string, max = 2000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}

function normalizeHistory(history: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const row = parseJsonObject(entry);
      if (!row) return null;
      const role = row.role;
      const content = row.content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      const trimmed = content.trim();
      if (!trimmed) return null;
      return { role, content: trimmed.slice(0, 500) };
    })
    .filter((row): row is { role: "user" | "assistant"; content: string } => row !== null)
    .slice(-8);
}

function requestsVenueCatalog(mode: string, message: string): boolean {
  if (mode === "create") return true;
  return /\b(venue|location|address|move|moved|switch|relocat|different venue)\b/i.test(message);
}

function buildSystemPrompt() {
  return [
    "You are an event interpretation service for a host dashboard.",
    "You translate natural language into structured draft payloads only.",
    "Never output prose outside strict JSON.",
    "Rules:",
    "- Ask only blocking clarifications needed for the next server action.",
    "- Do not append conversational tails like 'anything else'.",
    "- RSVP remains default platform behavior; do not disable it.",
    "- Timeslots are optional. Encourage for open_mic, jam_session, workshop when relevant.",
    "- Prefer safe scope when ambiguous: occurrence edits over series-wide edits.",
    "- Use date format YYYY-MM-DD and 24h times HH:MM:SS when possible.",
    "- If venue match is uncertain, leave venue_id null and include blocking field.",
    "- Keep human_summary concise and deterministic.",
  ].join("\n");
}

function buildUserPrompt(input: {
  mode: string;
  message: string;
  dateKey?: string;
  eventId?: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  venueCatalog: Array<{ id: string; name: string }>;
  currentEvent: Record<string, unknown> | null;
}) {
  return JSON.stringify(
    {
      task: "interpret_event_message",
      mode: input.mode,
      message: input.message,
      date_key: input.dateKey ?? null,
      event_id: input.eventId ?? null,
      current_event: input.currentEvent,
      venue_catalog: input.venueCatalog,
      conversation_history: input.conversationHistory,
      required_output_shape: {
        next_action: "ask_clarification | show_preview | await_confirmation | done",
        confidence: "number 0..1",
        human_summary: "string",
        clarification_question: "string|null",
        blocking_fields: "string[]",
        draft_payload: "object",
      },
    },
    null,
    2
  );
}

function pickCurrentEventContext(event: Record<string, unknown>): Record<string, unknown> {
  const contextFields = [
    "id",
    "title",
    "event_type",
    "event_date",
    "day_of_week",
    "start_time",
    "end_time",
    "recurrence_rule",
    "location_mode",
    "venue_id",
    "venue_name",
    "is_free",
    "cost_label",
    "signup_mode",
    "signup_url",
    "signup_time",
    "has_timeslots",
    "total_slots",
    "slot_duration_minutes",
    "is_published",
    "status",
  ];

  const safe: Record<string, unknown> = {};
  for (const field of contextFields) {
    if (event[field] !== undefined) safe[field] = event[field];
  }
  return safe;
}

export async function POST(request: Request) {
  if (process.env.ENABLE_NL_EVENTS_INTERPRETER !== "true") {
    return NextResponse.json(
      { error: "Conversational interpreter is disabled in this environment." },
      { status: 503 }
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 503 });
  }

  const model = process.env.OPENAI_EVENT_INTERPRETER_MODEL?.trim() || DEFAULT_INTERPRETER_MODEL;

  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(sessionUser.id)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: InterpretEventRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!validateInterpretMode(body?.mode)) {
    return NextResponse.json({ error: "mode must be create | edit_series | edit_occurrence." }, { status: 400 });
  }
  if (typeof body?.message !== "string" || body.message.trim().length === 0) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const normalizedMessage = body.message.trim().slice(0, 3000);
  const mode = body.mode;
  const dateKey = typeof body.dateKey === "string" ? body.dateKey : undefined;
  const eventId = typeof body.eventId === "string" ? body.eventId : undefined;
  const conversationHistory = normalizeHistory(body.conversationHistory);

  if ((mode === "edit_series" || mode === "edit_occurrence") && !eventId) {
    return NextResponse.json({ error: "eventId is required for edit modes." }, { status: 400 });
  }
  if (mode === "edit_occurrence" && (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey))) {
    return NextResponse.json({ error: "dateKey is required for edit_occurrence mode (YYYY-MM-DD)." }, { status: 400 });
  }

  let currentEvent: Record<string, unknown> | null = null;
  if (eventId) {
    const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select(`
        id, title, event_type, event_date, day_of_week, start_time, end_time, recurrence_rule,
        location_mode, venue_id, venue_name, is_free, cost_label,
        signup_mode, signup_url, signup_time, has_timeslots, total_slots, slot_duration_minutes,
        is_published, status
      `)
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    currentEvent = pickCurrentEventContext(eventRow as Record<string, unknown>);
  }

  const shouldSendVenueCatalog = requestsVenueCatalog(mode, normalizedMessage);
  const venueQueryLimit = mode === "create" ? 200 : 80;
  let venueCatalog: Array<{ id: string; name: string }> = [];

  if (shouldSendVenueCatalog) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(venueQueryLimit);

    venueCatalog = (venueRows || []).map((v) => ({ id: v.id, name: v.name }));
  } else if (typeof currentEvent?.venue_id === "string" && typeof currentEvent?.venue_name === "string") {
    // Keep context lightweight for non-venue edits by only supplying the current venue.
    venueCatalog = [{ id: currentEvent.venue_id, name: currentEvent.venue_name }];
  }

  const userPrompt = buildUserPrompt({
    mode,
    message: normalizedMessage,
    dateKey,
    eventId,
    conversationHistory,
    venueCatalog,
    currentEvent,
  });

  console.info("[events/interpret] request", {
    userId: sessionUser.id,
    mode,
    eventId: eventId ?? null,
    dateKey: dateKey ?? null,
    model,
    prompt: redactEmails(truncate(userPrompt, 1200)),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let responsePayload: Record<string, unknown>;
  try {
    const llmResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: buildSystemPrompt(),
        input: userPrompt,
        text: {
          format: {
            type: "json_schema",
            name: "event_interpretation",
            strict: true,
            schema: buildInterpretResponseSchema(),
          },
        },
      }),
    });

    const llmData = await llmResponse.json();
    if (!llmResponse.ok) {
      console.error("[events/interpret] upstream error", llmData);
      return NextResponse.json({ error: "Interpreter upstream error." }, { status: 502 });
    }

    const llmDataObj = parseJsonObject(llmData);
    if (!llmDataObj) {
      return NextResponse.json({ error: "Interpreter returned malformed response." }, { status: 502 });
    }

    const outputText = extractResponseText(llmDataObj);
    if (!outputText) {
      return NextResponse.json({ error: "Interpreter returned empty output." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch (parseError) {
      console.error("[events/interpret] non-json model output", {
        parseError,
        outputPreview: redactEmails(truncate(outputText, 200)),
      });
      return NextResponse.json({ error: "Interpreter returned non-JSON output." }, { status: 502 });
    }

    const parsedObj = parseJsonObject(parsed);
    if (!parsedObj) {
      return NextResponse.json({ error: "Interpreter output is not a JSON object." }, { status: 502 });
    }
    responsePayload = parsedObj;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Interpreter timeout." }, { status: 504 });
    }
    console.error("[events/interpret] parse/call error", error);
    return NextResponse.json({ error: "Interpreter call failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!validateNextAction(responsePayload.next_action)) {
    return NextResponse.json({ error: "Interpreter output missing valid next_action." }, { status: 502 });
  }
  if (typeof responsePayload.confidence !== "number" || responsePayload.confidence < 0 || responsePayload.confidence > 1) {
    return NextResponse.json({ error: "Interpreter output missing valid confidence." }, { status: 502 });
  }
  if (typeof responsePayload.human_summary !== "string" || responsePayload.human_summary.trim().length === 0) {
    return NextResponse.json({ error: "Interpreter output missing human_summary." }, { status: 502 });
  }
  if (responsePayload.clarification_question !== null && typeof responsePayload.clarification_question !== "string") {
    return NextResponse.json({ error: "Interpreter output has invalid clarification_question." }, { status: 502 });
  }
  if (!Array.isArray(responsePayload.blocking_fields) || responsePayload.blocking_fields.some((f) => typeof f !== "string")) {
    return NextResponse.json({ error: "Interpreter output has invalid blocking_fields." }, { status: 502 });
  }

  const sanitizedDraft = sanitizeInterpretDraftPayload(mode, responsePayload.draft_payload, dateKey);
  if (responsePayload.next_action !== "ask_clarification") {
    const draftValidation = validateSanitizedDraftPayload(mode, sanitizedDraft);
    if (!draftValidation.ok) {
      return NextResponse.json(
        {
          error: "Interpreter output failed server-side validation.",
          details: draftValidation.error,
          blocking_field: draftValidation.blockingField ?? null,
        },
        { status: 422 }
      );
    }
  }

  const qualityHints = buildQualityHints(sanitizedDraft);

  const response = {
    mode,
    next_action: responsePayload.next_action,
    confidence: responsePayload.confidence,
    human_summary: responsePayload.human_summary.trim(),
    clarification_question:
      typeof responsePayload.clarification_question === "string"
        ? responsePayload.clarification_question.trim()
        : null,
    blocking_fields: (responsePayload.blocking_fields as string[]).map((f) => f.trim()).filter(Boolean),
    draft_payload: sanitizedDraft,
    quality_hints: qualityHints,
  };

  console.info("[events/interpret] response", {
    userId: sessionUser.id,
    mode,
    nextAction: response.next_action,
    confidence: response.confidence,
    blockingFields: response.blocking_fields,
    draft: redactEmails(truncate(JSON.stringify(response.draft_payload), 1200)),
  });

  return NextResponse.json(response);
}
