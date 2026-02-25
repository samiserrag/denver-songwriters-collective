import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import {
  buildInterpretResponseSchema,
  buildQualityHints,
  IMAGE_INPUT_LIMITS,
  sanitizeInterpretDraftPayload,
  validateImageInputs,
  validateInterpretMode,
  validateNextAction,
  validateSanitizedDraftPayload,
  type ExtractionMetadata,
  type ImageInput,
  type InterpretEventRequestBody,
} from "@/lib/events/interpretEventContract";
import {
  resolveVenue,
  shouldResolveVenue,
  type VenueCatalogEntry,
  type VenueResolutionOutcome,
} from "@/lib/events/venueResolver";

/** Vercel serverless function timeout — two LLM calls need headroom. */
export const maxDuration = 60;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INTERPRETER_MODEL = "gpt-5.2";
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Persistent rate-limit policy:
// 30 requests per 15 minutes per authenticated user.
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
  source: "rpc" | "memory_fallback";
}

function checkRateLimitFallback(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: new Date(resetAt).toISOString(),
      source: "memory_fallback",
    };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt).toISOString(),
      source: "memory_fallback",
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(RATE_LIMIT_MAX - entry.count, 0),
    resetAt: new Date(entry.resetAt).toISOString(),
    source: "memory_fallback",
  };
}

function parseRateLimitResult(value: unknown): { allowed: boolean; remaining: number; resetAt: string | null } | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (typeof obj.allowed !== "boolean") return null;
  if (typeof obj.remaining !== "number") return null;
  const resetAt = obj.reset_at;
  if (resetAt !== null && typeof resetAt !== "string") return null;
  return {
    allowed: obj.allowed,
    remaining: Math.max(0, Math.floor(obj.remaining)),
    resetAt,
  };
}

async function checkRateLimit(supabase: SupabaseServerClient, userId: string): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_events_interpret_rate_limit", {
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_requests: RATE_LIMIT_MAX,
  });

  if (error) {
    console.error("[events/interpret] rate-limit rpc error; using memory fallback", {
      userId,
      message: error.message,
      code: error.code ?? null,
    });
    return checkRateLimitFallback(userId);
  }

  const parsed = parseRateLimitResult(data);
  if (!parsed) {
    console.error("[events/interpret] rate-limit rpc returned malformed payload; using memory fallback", {
      userId,
      data,
    });
    return checkRateLimitFallback(userId);
  }

  return {
    ...parsed,
    source: "rpc",
  };
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
  return /\b(venue|location|address|move|moved|switch|relocat|different venue|online|virtual|zoom|livestream)\b/i.test(
    message
  );
}

// ---------------------------------------------------------------------------
// Phase A — Vision extraction
// ---------------------------------------------------------------------------

const VISION_TIMEOUT_MS = 15_000;

const VISION_EXTRACTION_PROMPT = [
  "Extract ALL event details visible in the image(s).",
  "Return a structured plain-text summary with these fields when present:",
  "- Event title / name",
  "- Date(s) (use YYYY-MM-DD when possible)",
  "- Time(s) (use 24h HH:MM when possible)",
  "- Venue / location name",
  "- Address (street, city, state)",
  "- Cost / price / cover charge",
  "- Event type (open mic, concert, jam session, workshop, etc.)",
  "- Description / tagline",
  "- Signup details (URL, method)",
  "- Age policy (all ages, 21+, etc.)",
  "- Any other relevant details",
  "",
  "Be thorough but concise. If a field is not visible, omit it.",
  "If multiple images, combine all information into one summary.",
].join("\n");

interface VisionExtractionResult {
  extractedText: string;
  metadata: ExtractionMetadata;
}

async function extractTextFromImages(
  openAiKey: string,
  images: ImageInput[],
  modelName: string
): Promise<VisionExtractionResult> {
  const contentBlocks: Array<Record<string, unknown>> = [
    { type: "input_text", text: VISION_EXTRACTION_PROMPT },
    ...images.map((img) => ({
      type: "input_image",
      image_url: `data:${img.mime_type};base64,${img.data}`,
    })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        input: [{ role: "user", content: contentBlocks }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[events/interpret] vision extraction upstream error", {
        status: response.status,
        data,
      });
      return {
        extractedText: "",
        metadata: {
          images_processed: images.length,
          confidence: 0,
          extracted_fields: [],
          warnings: [`Vision API returned ${response.status}`],
        },
      };
    }

    const dataObj = parseJsonObject(data);
    const outputText = dataObj ? extractResponseText(dataObj) : null;

    if (!outputText) {
      return {
        extractedText: "",
        metadata: {
          images_processed: images.length,
          confidence: 0,
          extracted_fields: [],
          warnings: ["Vision API returned empty output"],
        },
      };
    }

    // Infer which fields were extracted by checking for common keywords
    const extractedFields: string[] = [];
    const lower = outputText.toLowerCase();
    if (/\btitle\b|\bname\b/.test(lower)) extractedFields.push("title");
    if (/\bdate\b|\b\d{4}-\d{2}-\d{2}\b/.test(lower)) extractedFields.push("date");
    if (/\btime\b|\b\d{1,2}:\d{2}\b/.test(lower)) extractedFields.push("time");
    if (/\bvenue\b|\blocation\b|\baddress\b/.test(lower)) extractedFields.push("venue");
    if (/\bcost\b|\bprice\b|\bfree\b|\bcover\b|\$/.test(lower)) extractedFields.push("cost");
    if (/\btype\b|\bopen mic\b|\bconcert\b|\bjam\b|\bworkshop\b/.test(lower)) extractedFields.push("event_type");

    return {
      extractedText: outputText.trim(),
      metadata: {
        images_processed: images.length,
        confidence: extractedFields.length >= 3 ? 0.8 : extractedFields.length >= 1 ? 0.5 : 0.2,
        extracted_fields: extractedFields,
        warnings: [],
      },
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.error("[events/interpret] vision extraction failed", {
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      extractedText: "",
      metadata: {
        images_processed: images.length,
        confidence: 0,
        extracted_fields: [],
        warnings: [isTimeout ? "Vision extraction timed out" : "Vision extraction failed"],
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

async function readJsonBodyWithSizeLimit<T>(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  // Fast-path reject when Content-Length is present and exceeds limit.
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Request body exceeds ${maxBytes / 1024 / 1024}MB limit.` },
          { status: 413 }
        ),
      };
    }
  }

  // Robust path for missing/incorrect Content-Length: stream and enforce byte cap.
  if (!request.body) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let rawBody = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // no-op: best effort cancellation
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Request body exceeds ${maxBytes / 1024 / 1024}MB limit.` },
          { status: 413 }
        ),
      };
    }

    rawBody += decoder.decode(value, { stream: true });
  }
  rawBody += decoder.decode();

  try {
    return { ok: true, body: JSON.parse(rawBody) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
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
    "- If venue match is uncertain, leave venue_id null and set venue_name to your best guess of the venue the user intended. The server will attempt deterministic resolution.",
    "- Keep human_summary concise and deterministic.",
  ].join("\n");
}

function buildUserPrompt(input: {
  mode: string;
  message: string;
  dateKey?: string;
  eventId?: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  venueCatalog: VenueCatalogEntry[];
  currentEvent: Record<string, unknown> | null;
  extractedImageText?: string;
}) {
  // Send only id+name to the LLM (slug is used server-side for resolution only)
  const llmVenueCatalog = input.venueCatalog.map((v) => ({ id: v.id, name: v.name }));
  return JSON.stringify(
    {
      task: "interpret_event_message",
      mode: input.mode,
      message: input.message,
      date_key: input.dateKey ?? null,
      event_id: input.eventId ?? null,
      current_event: input.currentEvent,
      venue_catalog: llmVenueCatalog,
      conversation_history: input.conversationHistory,
      ...(input.extractedImageText
        ? {
            extracted_image_text: input.extractedImageText,
            image_extraction_note:
              "The user attached image(s) of an event flyer. The extracted_image_text field contains OCR/vision output from those images. Use this data to populate the draft_payload fields. The user's message may provide additional context or corrections.",
          }
        : {}),
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
    "cover_image_url",
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

  const rateLimit = await checkRateLimit(supabase, sessionUser.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        rate_limit: {
          limit: RATE_LIMIT_MAX,
          remaining: rateLimit.remaining,
          reset_at: rateLimit.resetAt,
          source: rateLimit.source,
        },
      },
      { status: 429 }
    );
  }

  const parsedBody = await readJsonBodyWithSizeLimit<InterpretEventRequestBody>(
    request,
    IMAGE_INPUT_LIMITS.requestBodyMaxBytes
  );
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.body;

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

  // Validate image inputs (count, mime type, decoded size).
  const imageValidation = validateImageInputs(body.image_inputs);
  if (!imageValidation.ok) {
    return NextResponse.json({ error: imageValidation.error }, { status: imageValidation.status });
  }
  const validatedImages = imageValidation.images;

  if ((mode === "edit_series" || mode === "edit_occurrence") && !eventId) {
    return NextResponse.json({ error: "eventId is required for edit modes." }, { status: 400 });
  }
  if (mode === "edit_occurrence" && (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey))) {
    return NextResponse.json({ error: "dateKey is required for edit_occurrence mode (YYYY-MM-DD)." }, { status: 400 });
  }

  let currentEvent: Record<string, unknown> | null = null;
  if (eventId) {
    const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
    console.info("[events/interpret] authz", {
      userId: sessionUser.id,
      mode,
      eventId,
      allowed: canManage,
    });

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select(`
        id, title, event_type, event_date, day_of_week, start_time, end_time, recurrence_rule,
        location_mode, venue_id, venue_name, is_free, cost_label,
        signup_mode, signup_url, signup_time, has_timeslots, total_slots, slot_duration_minutes,
        is_published, status, cover_image_url
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
  let venueCatalog: VenueCatalogEntry[] = [];

  if (shouldSendVenueCatalog) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(venueQueryLimit);

    venueCatalog = (venueRows || []).map((v) => ({ id: v.id, name: v.name, slug: v.slug ?? null }));
  } else if (typeof currentEvent?.venue_id === "string" && typeof currentEvent?.venue_name === "string") {
    // Keep context lightweight for non-venue edits by only supplying the current venue.
    venueCatalog = [{ id: currentEvent.venue_id, name: currentEvent.venue_name }];
  }

  // ---------------------------------------------------------------------------
  // Phase A — Vision extraction (only when images are present)
  // ---------------------------------------------------------------------------
  let extractionMetadata: ExtractionMetadata | undefined;
  let extractedImageText: string | undefined;

  if (validatedImages.length > 0) {
    console.info("[events/interpret] starting Phase A vision extraction", {
      userId: sessionUser.id,
      imageCount: validatedImages.length,
    });

    const extraction = await extractTextFromImages(openAiKey, validatedImages, model);
    extractionMetadata = extraction.metadata;

    if (extraction.extractedText) {
      extractedImageText = extraction.extractedText;
      console.info("[events/interpret] Phase A complete", {
        userId: sessionUser.id,
        extractedFields: extraction.metadata.extracted_fields,
        confidence: extraction.metadata.confidence,
        textLength: extraction.extractedText.length,
      });
    } else {
      console.warn("[events/interpret] Phase A produced no text", {
        userId: sessionUser.id,
        warnings: extraction.metadata.warnings,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Phase B — Structured interpretation
  // ---------------------------------------------------------------------------
  const userPrompt = buildUserPrompt({
    mode,
    message: normalizedMessage,
    dateKey,
    eventId,
    conversationHistory,
    venueCatalog,
    currentEvent,
    extractedImageText,
  });

  console.info("[events/interpret] request", {
    userId: sessionUser.id,
    mode,
    eventId: eventId ?? null,
    dateKey: dateKey ?? null,
    model,
    hasImages: validatedImages.length > 0,
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

  // ---------------------------------------------------------------------------
  // Phase 5 — Deterministic venue resolution (post-LLM)
  // ---------------------------------------------------------------------------
  let venueResolution: VenueResolutionOutcome | null = null;
  let resolvedNextAction = responsePayload.next_action as string;
  const resolvedBlockingFields = (responsePayload.blocking_fields as string[]).map((f) => f.trim()).filter(Boolean);
  let resolvedClarificationQuestion =
    typeof responsePayload.clarification_question === "string"
      ? responsePayload.clarification_question.trim()
      : null;

  if (
    shouldResolveVenue({
      mode,
      hasLocationIntent: shouldSendVenueCatalog,
      draftPayload: sanitizedDraft,
    })
  ) {
    const isCustomLocation =
      typeof sanitizedDraft.custom_location_name === "string" &&
      (sanitizedDraft.custom_location_name as string).trim().length > 0 &&
      !sanitizedDraft.venue_id;

    venueResolution = resolveVenue({
      draftVenueId: sanitizedDraft.venue_id as string | null | undefined,
      draftVenueName: (sanitizedDraft.venue_name as string | null | undefined) ??
        (sanitizedDraft.custom_location_name as string | null | undefined),
      userMessage: normalizedMessage,
      venueCatalog,
      draftLocationMode: sanitizedDraft.location_mode as string | null | undefined,
      draftOnlineUrl: sanitizedDraft.online_url as string | null | undefined,
      isCustomLocation,
    });

    // Apply resolution outcome — only escalate, never downgrade
    if (venueResolution.status === "resolved") {
      sanitizedDraft.venue_id = venueResolution.venueId;
      sanitizedDraft.venue_name = venueResolution.venueName;
      if (!sanitizedDraft.location_mode || sanitizedDraft.location_mode === "online") {
        sanitizedDraft.location_mode = "venue";
      }
    } else if (venueResolution.status === "ambiguous") {
      // Only escalate — if LLM already asked for clarification, don't override
      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        const candidateList = venueResolution.candidates
          .map((c, i) => `${i + 1}. ${c.name}`)
          .join(", ");
        resolvedClarificationQuestion =
          `I found multiple possible venues matching "${venueResolution.inputName}": ${candidateList}. Which one did you mean?`;
      }
      if (!resolvedBlockingFields.includes("venue_id")) {
        resolvedBlockingFields.push("venue_id");
      }
    } else if (venueResolution.status === "unresolved") {
      const needsOnlineUrl =
        sanitizedDraft.location_mode === "online" &&
        !(
          typeof sanitizedDraft.online_url === "string" &&
          sanitizedDraft.online_url.trim().length > 0
        );

      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        if (needsOnlineUrl) {
          resolvedClarificationQuestion =
            "Please provide the online event URL (Zoom, YouTube, etc.) for this online event.";
        } else {
          const inputHint = venueResolution.inputName
            ? ` matching "${venueResolution.inputName}"`
            : "";
          resolvedClarificationQuestion =
            `I couldn't find a known venue${inputHint}. Could you provide the venue name, or specify if this is an online event?`;
        }
      }
      const blockingField = needsOnlineUrl ? "online_url" : "venue_id";
      if (!resolvedBlockingFields.includes(blockingField)) {
        resolvedBlockingFields.push(blockingField);
      }
    }
    // online_explicit / custom_location → no changes needed
  }

  const qualityHints = buildQualityHints(sanitizedDraft);

  const response = {
    mode,
    next_action: resolvedNextAction,
    confidence: responsePayload.confidence,
    human_summary: responsePayload.human_summary.trim(),
    clarification_question: resolvedClarificationQuestion,
    blocking_fields: resolvedBlockingFields,
    draft_payload: sanitizedDraft,
    quality_hints: qualityHints,
    ...(extractionMetadata ? { extraction_metadata: extractionMetadata } : {}),
  };

  console.info("[events/interpret] response", {
    userId: sessionUser.id,
    mode,
    nextAction: response.next_action,
    confidence: response.confidence,
    blockingFields: response.blocking_fields,
    draft: redactEmails(truncate(JSON.stringify(response.draft_payload), 1200)),
    ...(venueResolution
      ? {
          venueResolution: {
            status: venueResolution.status,
            ...(venueResolution.status === "resolved"
              ? {
                  source: venueResolution.source,
                  confidence: venueResolution.confidence,
                  venueId: venueResolution.venueId,
                }
              : {}),
            ...(venueResolution.status === "ambiguous"
              ? {
                  candidateCount: venueResolution.candidates.length,
                  inputName: venueResolution.inputName,
                }
              : {}),
            ...(venueResolution.status === "unresolved"
              ? { inputName: venueResolution.inputName }
              : {}),
          },
        }
      : {}),
    ...(extractionMetadata
      ? {
          extraction: {
            imagesProcessed: extractionMetadata.images_processed,
            extractedFields: extractionMetadata.extracted_fields,
            confidence: extractionMetadata.confidence,
          },
        }
      : {}),
  });

  return NextResponse.json(response);
}
