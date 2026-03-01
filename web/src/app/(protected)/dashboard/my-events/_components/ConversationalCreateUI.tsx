"use client";

import { Fragment, useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  type InterpretMode,
  type ImageInput,
  IMAGE_INPUT_LIMITS,
} from "@/lib/events/interpretEventContract";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  uploadCoverForEvent,
  softDeleteCoverImageRow,
} from "@/lib/events/uploadCoverForEvent";
import type { NextAction } from "@/lib/events/interpretEventContract";
import { normalizeSignupMode } from "@/lib/events/signupModeContract";
import { humanizeRecurrence } from "@/lib/recurrenceHumanizer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StagedImage {
  id: string;
  file: File;
  previewUrl: string;
  /** base64 data (no prefix) produced after client-side resize */
  base64: string;
  mime_type: string;
}

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
}

interface QualityHint {
  field: string;
  hint: string;
}

// ---------------------------------------------------------------------------
// Phase 8D: Post-create summary for confidence UX
// ---------------------------------------------------------------------------

interface CreatedEventSummary {
  eventId: string;
  slug: string | null;
  title: string | null;
  eventType: string | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  seriesMode: string | null;
  recurrenceRule: string | null;
  dayOfWeek: string | null;
  locationMode: string | null;
  venueName: string | null;
  signupMode: string | null;
  costLabel: string | null;
  hasCover: boolean;
  coverNote: string | null;
}

function normalizeSnakeCaseDisplay(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.replace(/_/g, " ") : null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)
      .map((entry) => entry.replace(/_/g, " "));

    return parts.length > 0 ? parts.join(", ") : null;
  }

  return null;
}

function buildCreatedEventSummary(
  eventId: string,
  slug: string | null,
  draft: Record<string, unknown>,
  hasCover: boolean,
  coverNote: string | null
): CreatedEventSummary {
  return {
    eventId,
    slug,
    title: (draft.title as string) ?? null,
    eventType: normalizeSnakeCaseDisplay(draft.event_type),
    startDate: (draft.start_date as string) ?? null,
    startTime: (draft.start_time as string) ?? null,
    endTime: (draft.end_time as string) ?? null,
    seriesMode: (draft.series_mode as string) ?? null,
    recurrenceRule: (draft.recurrence_rule as string) ?? null,
    dayOfWeek: (draft.day_of_week as string) ?? null,
    locationMode: (draft.location_mode as string) ?? null,
    venueName: (draft.venue_name as string) ?? (draft.custom_location_name as string) ?? null,
    signupMode: normalizeSnakeCaseDisplay(draft.signup_mode),
    costLabel: (draft.cost_label as string) ?? null,
    hasCover,
    coverNote,
  };
}

// ---------------------------------------------------------------------------
// Phase 8C: Field-specific input format hints for clarification UX
// ---------------------------------------------------------------------------

const FIELD_INPUT_HINTS: Record<string, { label: string; examples: string[] }> = {
  start_time: { label: "Time", examples: ["7:00 PM", "18:30", "6pm"] },
  end_time: { label: "End time", examples: ["9:00 PM", "21:00"] },
  start_date: { label: "Date", examples: ["2026-03-15", "March 15", "next Tuesday"] },
  event_date: { label: "Date", examples: ["2026-03-15", "March 15", "next Tuesday"] },
  venue_id: { label: "Venue", examples: ["Dazzle Jazz", "Long Table Brewhouse", "LTB"] },
  venue_name: { label: "Venue", examples: ["Dazzle Jazz", "Long Table Brewhouse"] },
  online_url: { label: "URL", examples: ["https://zoom.us/j/123", "https://meet.google.com/..."] },
  external_url: { label: "URL", examples: ["https://eventbrite.com/...", "https://example.com"] },
  signup_url: { label: "Signup URL", examples: ["https://signup.example.com"] },
  title: { label: "Title", examples: ["Open Mic Night", "Songwriter Circle"] },
  event_type: { label: "Type", examples: ["open_mic", "concert", "workshop", "jam_session"] },
  location_mode: { label: "Location", examples: ["venue", "online", "hybrid"] },
  description: { label: "Description", examples: ["A brief description of the event..."] },
  capacity: { label: "Capacity", examples: ["30", "50", "100"] },
  cost_label: { label: "Cost", examples: ["Free", "$10", "$5 suggested donation"] },
};

function getFieldHint(field: string): { label: string; examples: string[] } | null {
  return FIELD_INPUT_HINTS[field] ?? null;
}

interface ResponseGuidance {
  next_action: string;
  human_summary: string | null;
  clarification_question: string | null;
  blocking_fields: string[];
  confidence: number | null;
  draft_payload: Record<string, unknown> | null;
  quality_hints: QualityHint[];
}

// ---------------------------------------------------------------------------
// Feature flag: client-side gate for write actions in the lab.
// Set NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES=true in env to enable.
// ---------------------------------------------------------------------------

const LAB_WRITES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES === "true";

// ---------------------------------------------------------------------------
// Helpers: client-side canvas resize → base64
// ---------------------------------------------------------------------------

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;
const ACCEPTED_MIMES = [...IMAGE_INPUT_LIMITS.acceptedMimes];

function resizeImageToBase64(file: File): Promise<{ base64: string; mime_type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

      ctx.drawImage(img, 0, 0, width, height);

      // Always output as JPEG for consistent compression
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mime_type: "image/jpeg" });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert a base64 JPEG string back into a File suitable for uploadCoverForEvent.
 * Uses .jpg extension so the helper derives the correct storage path extension.
 */
function base64ToJpegFile(base64: string): File {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new File([bytes], `cover-${crypto.randomUUID()}.jpg`, {
    type: "image/jpeg",
  });
}

// ---------------------------------------------------------------------------
// Phase 4B: Allowed next_action values for create write
// ---------------------------------------------------------------------------

const CREATABLE_NEXT_ACTIONS: ReadonlySet<NextAction> = new Set([
  "show_preview",
  "await_confirmation",
  "done",
]);

// ---------------------------------------------------------------------------
// Phase 4B: Map interpreter draft_payload → POST /api/my-events body
// ---------------------------------------------------------------------------

/** Fields required by POST /api/my-events */
const CREATE_REQUIRED_FIELDS = ["title", "event_type", "start_time", "start_date"] as const;

/**
 * Optional fields that pass through directly from the interpreter draft_payload
 * to the create API body when present and non-null.
 */
const CREATE_PASSTHROUGH_OPTIONALS = [
  "description",
  "series_mode",
  "recurrence_rule",
  "end_time",
  "capacity",
  "is_free",
  "cost_label",
  "signup_mode",
  "signup_url",
  "signup_deadline",
  "signup_time",
  "age_policy",
  "external_url",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "allow_guests",
  "categories",
  "max_occurrences",
  "occurrence_count",
  "custom_dates",
  "timezone",
  "host_notes",
  "online_url",
  "venue_name",
  "day_of_week",
] as const;

type MapResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

const GOOGLE_MAPS_LINK_REGEX =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps\/[^\s]+|maps\.google\.com\/[^\s]+)\b/i;

function isGoogleMapsUrl(value: unknown): value is string {
  return typeof value === "string" && GOOGLE_MAPS_LINK_REGEX.test(value.trim());
}

function normalizeStartDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (mdY) {
    const month = Number.parseInt(mdY[1], 10);
    const day = Number.parseInt(mdY[2], 10);
    const yearInput = Number.parseInt(mdY[3], 10);
    const year = mdY[3].length === 2 ? 2000 + yearInput : yearInput;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    }
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }

  return null;
}

function collectUserIntentText(
  history: ConversationEntry[],
  currentMessage: string
): string {
  const userTurns = history
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content);
  return [...userTurns, currentMessage].join("\n").toLowerCase();
}

function explicitlyRequestsTimeslots(intentText: string): boolean {
  if (!intentText.trim()) return false;
  const explicitSignals = [
    /\btimeslots?\b/i,
    /\btime\s*slots?\b/i,
    /\bslot\s*duration\b/i,
    /\blineup\b/i,
    /\b\d+\s+(?:performer\s+)?slots?\b/i,
    /\benable\s+(?:performer\s+)?slots?\b/i,
  ];
  return explicitSignals.some((pattern) => pattern.test(intentText));
}

function explicitlyRequestsVenueDirectoryCreate(intentText: string): boolean {
  if (!intentText.trim()) return false;
  return /\b(new venue|create venue|add venue|add to venues|add this venue)\b/i.test(intentText);
}

function extractGoogleMapsUrl(intentText: string): string | null {
  const match = intentText.match(GOOGLE_MAPS_LINK_REGEX);
  return match ? match[0].trim() : null;
}

type CanonicalLocationMode = "venue" | "online" | "hybrid";

/**
 * Normalize interpreter location modes to DB-supported enum values.
 * DB constraint supports: venue | online | hybrid.
 */
function normalizeLocationMode(
  value: unknown,
  fallback: CanonicalLocationMode
): CanonicalLocationMode {
  if (typeof value !== "string") return fallback;
  const mode = value.trim().toLowerCase();

  if (
    mode === "venue" ||
    mode === "in_person" ||
    mode === "in-person" ||
    mode === "in_person_custom" ||
    mode === "in_person_venue" ||
    mode === "physical" ||
    mode === "onsite" ||
    mode === "on_site" ||
    mode === "custom" ||
    mode === "custom_location"
  ) {
    return "venue";
  }

  if (
    mode === "online" ||
    mode === "virtual" ||
    mode === "zoom" ||
    mode === "livestream" ||
    mode === "live_stream" ||
    mode === "remote"
  ) {
    return "online";
  }

  if (mode === "hybrid") return "hybrid";
  return fallback;
}

/**
 * Normalize monthly RRULE variants into forms already supported by recurrence parsing.
 * Converts:
 * - FREQ=MONTHLY;BYDAY=TU;BYSETPOS=4  -> FREQ=MONTHLY;BYDAY=4TU
 * - FREQ=MONTHLY;BYSETPOS=4;BYDAY=TU  -> FREQ=MONTHLY;BYDAY=4TU
 */
function normalizeRecurrenceRuleForCreate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const raw = value.trim();

  const bydayThenSetpos = raw.match(
    /^FREQ=MONTHLY;BYDAY=([A-Z]{2});BYSETPOS=(-?\d+)$/i
  );
  if (bydayThenSetpos) {
    return `FREQ=MONTHLY;BYDAY=${bydayThenSetpos[2]}${bydayThenSetpos[1].toUpperCase()}`;
  }

  const setposThenByday = raw.match(
    /^FREQ=MONTHLY;BYSETPOS=(-?\d+);BYDAY=([A-Z]{2})$/i
  );
  if (setposThenByday) {
    return `FREQ=MONTHLY;BYDAY=${setposThenByday[1]}${setposThenByday[2].toUpperCase()}`;
  }

  return raw;
}

/**
 * Map an interpreter sanitized draft_payload into a body suitable for
 * POST /api/my-events. Returns an error if required fields are missing.
 *
 * Venue handling:
 * - If draft has `venue_id` (UUID), pass it through.
 * - Else if draft has `custom_location_name`, use custom location path.
 * - Else if draft has `online_url`, use online location path.
 * - Else return a mapper error (no silent fallback).
 */
function mapDraftToCreatePayload(
  draft: Record<string, unknown>,
  intentText: string
): MapResult {
  // 1. Check required fields
  for (const field of CREATE_REQUIRED_FIELDS) {
    const val = draft[field];
    if (val === undefined || val === null || val === "") {
      return { ok: false, error: `Missing required field: ${field}` };
    }
  }

  // event_type must be a non-empty array
  const eventType = draft.event_type;
  if (!Array.isArray(eventType) || eventType.length === 0) {
    return { ok: false, error: "event_type must be a non-empty array" };
  }

  // 2. Build base payload with required fields
  const normalizedStartDate = normalizeStartDate(draft.start_date);
  if (!normalizedStartDate) {
    return { ok: false, error: "start_date must be a valid date (YYYY-MM-DD)." };
  }

  const body: Record<string, unknown> = {
    title: draft.title,
    event_type: eventType,
    start_time: draft.start_time,
    start_date: normalizedStartDate,
  };

  // 3. Venue / location resolution
  const hasVenueId =
    typeof draft.venue_id === "string" && draft.venue_id.trim().length > 0;
  const hasCustomLocationName =
    typeof draft.custom_location_name === "string" &&
    (draft.custom_location_name as string).trim().length > 0;
  const hasOnlineUrl =
    typeof draft.online_url === "string" && draft.online_url.trim().length > 0;

  if (hasVenueId) {
    body.venue_id = (draft.venue_id as string).trim();
    body.location_mode = normalizeLocationMode(draft.location_mode, "venue");
  } else if (hasCustomLocationName) {
    body.custom_location_name = (draft.custom_location_name as string).trim();
    body.location_mode = normalizeLocationMode(draft.location_mode, "venue");
    // Pass through optional custom location fields
    for (const f of ["custom_address", "custom_city", "custom_state", "custom_latitude", "custom_longitude", "location_notes"] as const) {
      if (draft[f] !== undefined && draft[f] !== null) {
        body[f] = draft[f];
      }
    }
  } else if (hasOnlineUrl) {
    body.location_mode = normalizeLocationMode(draft.location_mode, "online");
    body.online_url = (draft.online_url as string).trim();
  } else {
    // No valid location resolved for create payload
    return {
      ok: false,
      error:
        "Missing location: provide venue_id, custom_location_name, or online_url",
    };
  }

  // 4. Pass through optional fields
  for (const field of CREATE_PASSTHROUGH_OPTIONALS) {
    const val = draft[field];
    if (val !== undefined && val !== null) {
      body[field] = val;
    }
  }

  // 4b. Canonicalize recurrence rule for downstream recurrence parsing.
  const normalizedRecurrence = normalizeRecurrenceRuleForCreate(body.recurrence_rule);
  if (normalizedRecurrence) {
    body.recurrence_rule = normalizedRecurrence;
  }

  // 4c. Guard against half-configured timeslots.
  if (body.has_timeslots === true) {
    const hasExplicitTimeslotIntent = explicitlyRequestsTimeslots(intentText);
    if (!hasExplicitTimeslotIntent) {
      body.has_timeslots = false;
      body.total_slots = null;
      body.slot_duration_minutes = null;
      body.allow_guests = false;
    }

    const slots = typeof body.total_slots === "number" ? body.total_slots : Number.NaN;
    if (!Number.isFinite(slots) || slots <= 0) {
      body.has_timeslots = false;
      body.total_slots = null;
      body.slot_duration_minutes = null;
      body.allow_guests = false;
    }
  }

  // 4d. Google Maps links are location hints, not event external websites.
  if (isGoogleMapsUrl(body.external_url)) {
    body.external_url = null;
  }

  // 4e. Enforce DB-safe signup_mode enum values.
  body.signup_mode = normalizeSignupMode(body.signup_mode);

  // 5. series_mode default
  if (!body.series_mode) {
    body.series_mode = "single";
  }

  return { ok: true, body };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ConversationalCreateVariant = "lab" | "host";

export function ConversationalCreateUI({
  variant = "lab",
}: {
  variant?: ConversationalCreateVariant;
}) {
  // Phase 8E: host variant forces create mode and enables writes without lab flag
  const isHostVariant = variant === "host";
  const writesEnabled = isHostVariant || LAB_WRITES_ENABLED;

  // ---- core state (unchanged from original) ----
  const [mode, setMode] = useState<InterpretMode>("create");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- image staging ----
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // P1 fix: ref-based count prevents concurrent stageFiles() from exceeding max
  const stagedCountRef = useRef(0);
  useEffect(() => { stagedCountRef.current = stagedImages.length; }, [stagedImages.length]);

  // P2 fix: track all created object URLs for reliable cleanup on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // ---- Phase 9A: telemetry ----
  const [traceId] = useState(() => crypto.randomUUID());
  const impressionSent = useRef(false);

  const sendTelemetry = useCallback(
    (eventName: string) => {
      fetch("/api/events/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trace_id: traceId,
          event_name: eventName,
          surface: isHostVariant ? "host" : "lab",
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Fire-and-forget — telemetry failures must not affect UX.
      });
    },
    [traceId, isHostVariant]
  );

  useEffect(() => {
    if (!impressionSent.current) {
      impressionSent.current = true;
      sendTelemetry("interpreter_impression");
    }
  }, [sendTelemetry]);

  // ---- conversation history ----
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);

  // ---- Phase 4A: cover candidate state ----
  const [coverCandidateId, setCoverCandidateId] = useState<string | null>(null);
  const [isApplyingCover, setIsApplyingCover] = useState(false);
  const [coverMessage, setCoverMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ---- Phase 4B: create-mode write state ----
  const [lastInterpretResponse, setLastInterpretResponse] = useState<{
    next_action: string;
    draft_payload: Record<string, unknown>;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdSummary, setCreatedSummary] = useState<CreatedEventSummary | null>(null);
  const [createMessage, setCreateMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const responseGuidance = useMemo<ResponseGuidance | null>(() => {
    if (!responseBody || typeof responseBody !== "object") return null;
    const maybe = responseBody as Record<string, unknown>;
    if (typeof maybe.next_action !== "string") return null;
    const blocking = Array.isArray(maybe.blocking_fields)
      ? maybe.blocking_fields.filter((v): v is string => typeof v === "string")
      : [];
    const hints = Array.isArray(maybe.quality_hints)
      ? (maybe.quality_hints as QualityHint[]).filter(
          (h) => typeof h === "object" && h !== null && typeof h.field === "string" && typeof h.hint === "string"
        )
      : [];
    return {
      next_action: maybe.next_action,
      human_summary: typeof maybe.human_summary === "string" ? maybe.human_summary : null,
      clarification_question:
        typeof maybe.clarification_question === "string" ? maybe.clarification_question : null,
      blocking_fields: blocking,
      confidence: typeof maybe.confidence === "number" ? maybe.confidence : null,
      draft_payload:
        maybe.draft_payload && typeof maybe.draft_payload === "object"
          ? (maybe.draft_payload as Record<string, unknown>)
          : null,
      quality_hints: hints,
    };
  }, [responseBody]);

  const runActionLabel =
    responseGuidance?.next_action === "ask_clarification"
      ? "Send Answer"
      : conversationHistory.length > 0
        ? "Update Draft"
        : "Generate Draft";

  // Phase 8E: host variant forces create mode at logic level
  const effectiveMode: InterpretMode = isHostVariant ? "create" : mode;

  // Derived: is current mode an edit mode with a valid eventId?
  const isEditMode = effectiveMode === "edit_series" || effectiveMode === "edit_occurrence";
  const hasValidEventId = eventId.trim().length > 0;

  // Can show cover controls (click-to-select thumbnails):
  // Edit mode: flag + edit mode + valid eventId + images
  // Create mode: flag + create mode + images (no eventId needed until create time)
  const canShowCoverControls =
    writesEnabled &&
    stagedImages.length > 0 &&
    (
      (isEditMode && hasValidEventId) ||
      effectiveMode === "create"
    );

  // Phase 4B: Can show create action in create mode
  const canShowCreateAction =
    writesEnabled &&
    effectiveMode === "create" &&
    lastInterpretResponse !== null &&
    CREATABLE_NEXT_ACTIONS.has(lastInterpretResponse.next_action as NextAction);

  // Clear cover candidate when mode changes or images change
  useEffect(() => {
    if (coverCandidateId && !stagedImages.some((img) => img.id === coverCandidateId)) {
      setCoverCandidateId(null);
    }
  }, [stagedImages, coverCandidateId]);

  // Clear cover message when mode/eventId changes
  useEffect(() => {
    setCoverMessage(null);
  }, [mode, eventId]);

  // Clear create state when mode changes
  useEffect(() => {
    setLastInterpretResponse(null);
    setCreateMessage(null);
    setCreatedEventId(null);
    setCreatedSummary(null);
  }, [mode]);

  // If create inputs materially change (mode/image set), require a fresh
  // interpret run before create write. Do NOT clear on message edits, or
  // multi-turn clarification loses locked_draft context.
  useEffect(() => {
    if (mode === "create") {
      setLastInterpretResponse(null);
      setCreateMessage(null);
      setCreatedEventId(null);
      setCreatedSummary(null);
    }
  }, [mode, stagedImages.length]);

  // In create mode, default the first staged image as the cover candidate.
  useEffect(() => {
    if (mode !== "create") return;
    if (stagedImages.length === 0) return;
    if (coverCandidateId) return;
    setCoverCandidateId(stagedImages[0].id);
  }, [mode, stagedImages, coverCandidateId]);

  // Cleanup all tracked object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // ---- image staging logic ----

  const stageFiles = useCallback(
    async (files: File[]) => {
      setImageError(null);

      // Use ref for accurate count even during concurrent calls
      const remaining = IMAGE_INPUT_LIMITS.maxCount - stagedCountRef.current;
      if (remaining <= 0) {
        setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
        return;
      }

      const toProcess = files.slice(0, remaining);

      for (const file of toProcess) {
        // Re-check on each iteration since previous iterations may have added images
        if (stagedCountRef.current >= IMAGE_INPUT_LIMITS.maxCount) {
          setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
          break;
        }

        if (!ACCEPTED_MIMES.includes(file.type)) {
          setImageError(`Unsupported type: ${file.type}. Use JPEG, PNG, WebP, or GIF.`);
          continue;
        }

        if (file.size > IMAGE_INPUT_LIMITS.maxIntakeBytes) {
          setImageError(
            `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${IMAGE_INPUT_LIMITS.maxIntakeBytes / 1024 / 1024}MB.`
          );
          continue;
        }

        try {
          const { base64, mime_type } = await resizeImageToBase64(file);

          // Post-await re-check: a concurrent stageFiles() may have filled slots during resize
          if (stagedCountRef.current >= IMAGE_INPUT_LIMITS.maxCount) {
            setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
            break;
          }

          // Check decoded size after resize
          const decodedBytes = Math.ceil(base64.length * 3 / 4);
          if (decodedBytes > IMAGE_INPUT_LIMITS.maxDecodedBytes) {
            setImageError("Resized image still exceeds 1MB — try a smaller image.");
            continue;
          }

          const previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(previewUrl);

          const staged: StagedImage = {
            id: crypto.randomUUID(),
            file,
            previewUrl,
            base64,
            mime_type,
          };

          // Eagerly increment ref so concurrent calls see it immediately
          stagedCountRef.current += 1;
          setStagedImages((prev) => [...prev, staged]);
        } catch {
          setImageError("Failed to process image.");
        }
      }
    },
    [] // No deps needed — uses refs for mutable state
  );

  const removeImage = useCallback((id: string) => {
    setStagedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
        stagedCountRef.current = Math.max(0, stagedCountRef.current - 1);
      }
      return prev.filter((img) => img.id !== id);
    });
    setImageError(null);
  }, []);

  // ---- clipboard paste handler ----

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      e.preventDefault();
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) stageFiles(files);
    },
    [stageFiles]
  );

  // ---- drag and drop ----

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) stageFiles(files);
    },
    [stageFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ---- submit (interpret request) ----

  async function submit() {
    setIsSubmitting(true);
    setStatusCode(null);
    setResponseBody(null);

    // Avoid stale create writes if the new interpret call fails.
    if (effectiveMode === "create") {
      setLastInterpretResponse(null);
      setCreateMessage(null);
    }

    try {
      // Phase 8E: use effectiveMode (forced to "create" in host variant)
      const payload: Record<string, unknown> = {
        mode: effectiveMode,
        message,
        trace_id: traceId,
      };

      if (effectiveMode !== "create" && eventId.trim()) {
        payload.eventId = eventId.trim();
      }
      if (effectiveMode === "edit_occurrence" && dateKey.trim()) {
        payload.dateKey = dateKey.trim();
      }

      // Attach conversation history for multi-turn
      if (conversationHistory.length > 0) {
        payload.conversationHistory = conversationHistory;
      }

      // Preserve previously confirmed create-draft fields across short
      // clarification turns so the interpreter patches instead of restarting.
      if (effectiveMode === "create" && lastInterpretResponse?.draft_payload) {
        payload.locked_draft = lastInterpretResponse.draft_payload;
      }

      // Attach image inputs
      if (stagedImages.length > 0) {
        payload.image_inputs = stagedImages.map(
          (img): ImageInput => ({
            data: img.base64,
            mime_type: img.mime_type,
          })
        );
      }

      const res = await fetch("/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({ error: "Non-JSON response" }));
      setStatusCode(res.status);
      setResponseBody(body);

      // Append to conversation history for multi-turn
      if (res.ok && body) {
        const assistantParts: string[] = [];
        if (typeof body.human_summary === "string" && body.human_summary.trim().length > 0) {
          assistantParts.push(body.human_summary.trim());
        }
        if (
          body.next_action === "ask_clarification" &&
          typeof body.clarification_question === "string" &&
          body.clarification_question.trim().length > 0
        ) {
          assistantParts.push(`Question: ${body.clarification_question.trim()}`);
        }

        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: message },
          {
            role: "assistant",
            content: assistantParts.join("\n\n") || JSON.stringify(body),
          },
        ]);

        if (body.next_action === "ask_clarification") {
          // Keep follow-up turns lightweight by clearing the original long prompt.
          setMessage("");
        }

        // Phase 4B: Track last successful interpreter response for create action
        if (body.next_action && body.draft_payload) {
          setLastInterpretResponse({
            next_action: body.next_action as string,
            draft_payload: body.draft_payload as Record<string, unknown>,
          });
        }
      }
    } catch (error) {
      setStatusCode(0);
      setResponseBody({
        error: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Phase 4A: Apply cover to event (edit mode only) ----

  async function applyCover() {
    // Guard: preconditions
    if (!coverCandidateId || !isEditMode || !hasValidEventId) return;

    const candidate = stagedImages.find((img) => img.id === coverCandidateId);
    if (!candidate) {
      setCoverMessage({ type: "error", text: "Selected cover image no longer staged." });
      return;
    }

    setIsApplyingCover(true);
    setCoverMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();

      // 1. Get authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCoverMessage({ type: "error", text: "Not authenticated. Please log in again." });
        return;
      }

      const targetEventId = eventId.trim();

      // 2. Fresh-fetch current event cover_image_url
      const { data: eventRow, error: fetchError } = await supabase
        .from("events")
        .select("cover_image_url")
        .eq("id", targetEventId)
        .maybeSingle();

      if (fetchError || !eventRow) {
        setCoverMessage({
          type: "error",
          text: fetchError ? `Failed to fetch event: ${fetchError.message}` : "Event not found.",
        });
        return;
      }

      const previousCoverUrl = eventRow.cover_image_url as string | null;

      // 3. Convert base64 to File (resized JPEG)
      const coverFile = base64ToJpegFile(candidate.base64);

      // 4. Upload via shared helper
      const uploadedUrl = await uploadCoverForEvent({
        supabase,
        eventId: targetEventId,
        file: coverFile,
        userId: session.user.id,
      });

      // 5. Update events.cover_image_url
      const { error: updateError } = await supabase
        .from("events")
        .update({ cover_image_url: uploadedUrl })
        .eq("id", targetEventId);

      if (updateError) {
        setCoverMessage({
          type: "error",
          text: `Upload succeeded but cover update failed: ${updateError.message}`,
        });
        return;
      }

      // 6. Soft-delete previous cover row if it existed and differs
      if (previousCoverUrl && previousCoverUrl !== uploadedUrl) {
        await softDeleteCoverImageRow(supabase, targetEventId, previousCoverUrl);
      }

      setCoverMessage({
        type: "success",
        text: `Cover image applied to event ${targetEventId.slice(0, 8)}…`,
      });
    } catch (error) {
      setCoverMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Cover apply failed.",
      });
    } finally {
      setIsApplyingCover(false);
    }
  }

  // ---- Phase 4B: Create event from interpreter draft (create mode only) ----

  async function createEvent() {
    if (!canShowCreateAction || !lastInterpretResponse) return;

    const intentText = collectUserIntentText(conversationHistory, message);

    // Map draft_payload to POST /api/my-events body
    const mapResult = mapDraftToCreatePayload(lastInterpretResponse.draft_payload, intentText);
    if (!mapResult.ok) {
      setCreateMessage({ type: "error", text: `Cannot create: ${mapResult.error}` });
      return;
    }

    setIsCreating(true);
    setCreateMessage(null);

    try {
      const createBody: Record<string, unknown> = { ...mapResult.body, trace_id: traceId };
      let venueCreateNote: string | null = null;

      // Optional: when user explicitly requests "new venue", try adding it to venue directory first.
      if (
        explicitlyRequestsVenueDirectoryCreate(intentText) &&
        typeof createBody.venue_id !== "string" &&
        typeof createBody.custom_location_name === "string" &&
        createBody.custom_location_name.trim().length > 0
      ) {
        const mapsUrl = extractGoogleMapsUrl(intentText);
        const externalUrlValue =
          typeof createBody.external_url === "string" ? createBody.external_url.trim() : "";
        const websiteUrl =
          externalUrlValue.length > 0 && !isGoogleMapsUrl(externalUrlValue)
            ? externalUrlValue
            : null;

        const venuePayload = {
          name: createBody.custom_location_name,
          address: (createBody.custom_address as string) || "",
          city: (createBody.custom_city as string) || "",
          state: (createBody.custom_state as string) || "",
          website_url: websiteUrl,
          google_maps_url: mapsUrl,
        };

        try {
          const venueRes = await fetch("/api/admin/venues", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify(venuePayload),
          });

          if (venueRes.ok) {
            const venueData = await venueRes.json();
            if (typeof venueData?.id === "string" && venueData.id.length > 0) {
              createBody.venue_id = venueData.id;
              createBody.location_mode = "venue";
              createBody.venue_name =
                typeof venueData.name === "string" ? venueData.name : createBody.custom_location_name;
              delete createBody.custom_location_name;
              delete createBody.custom_address;
              delete createBody.custom_city;
              delete createBody.custom_state;
              delete createBody.custom_latitude;
              delete createBody.custom_longitude;
              venueCreateNote = ` Venue added to directory: ${createBody.venue_name}.`;
            }
          } else {
            venueCreateNote = " Venue directory add skipped (insufficient permission or validation issue).";
          }
        } catch {
          venueCreateNote = " Venue directory add failed; using custom location instead.";
        }
      }

      // 1. POST to create API
      const res = await fetch("/api/my-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createBody),
      });

      const result = await res.json().catch(() => ({ error: "Non-JSON response" }));

      if (!res.ok) {
        setCreateMessage({
          type: "error",
          text: `Create failed (${res.status}): ${result.error || JSON.stringify(result)}`,
        });
        return;
      }

      const newEventId = result.id as string;
      const slug = result.slug as string | undefined;
      const draftSnapshot = lastInterpretResponse.draft_payload;
      setCreatedEventId(newEventId);

      // 2. Deferred cover assignment (optional)
      const effectiveCoverCandidateId = coverCandidateId ?? stagedImages[0]?.id ?? null;
      if (effectiveCoverCandidateId && newEventId) {
        const candidate = stagedImages.find((img) => img.id === effectiveCoverCandidateId);
        if (candidate) {
          try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              const coverFile = base64ToJpegFile(candidate.base64);
              const uploadedUrl = await uploadCoverForEvent({
                supabase,
                eventId: newEventId,
                file: coverFile,
                userId: session.user.id,
              });

              // Update events.cover_image_url
              const { error: updateError } = await supabase
                .from("events")
                .update({ cover_image_url: uploadedUrl })
                .eq("id", newEventId);

              if (updateError) {
                await softDeleteCoverImageRow(supabase, newEventId, uploadedUrl).catch(() => {
                  // Best-effort cleanup for partial failure path.
                });
                setCreatedSummary(buildCreatedEventSummary(newEventId, slug ?? null, draftSnapshot, false, `Cover update failed: ${updateError.message}`));
                setCreateMessage({
                  type: "warning",
                  text: `Event created but cover update failed.${venueCreateNote ?? ""}`,
                });
                return;
              }

              setCreatedSummary(buildCreatedEventSummary(newEventId, slug ?? null, draftSnapshot, true, null));
              setCreateMessage({
                type: "success",
                text: `Event created as draft with cover.${venueCreateNote ?? ""}`,
              });
              return;
            } else {
              // No session for cover upload — event still created
              setCreatedSummary(buildCreatedEventSummary(newEventId, slug ?? null, draftSnapshot, false, "Cover upload skipped: not authenticated"));
              setCreateMessage({
                type: "warning",
                text: `Event created but cover upload skipped.${venueCreateNote ?? ""}`,
              });
              return;
            }
          } catch (coverError) {
            // Cover upload failed — event still created
            setCreatedSummary(buildCreatedEventSummary(newEventId, slug ?? null, draftSnapshot, false, `Cover upload failed: ${coverError instanceof Error ? coverError.message : "unknown error"}`));
            setCreateMessage({
              type: "warning",
              text: `Event created but cover upload failed.${venueCreateNote ?? ""}`,
            });
            return;
          }
        }
      }

      // Success without cover
      setCreatedSummary(buildCreatedEventSummary(newEventId, slug ?? null, draftSnapshot, false, null));
      setCreateMessage({
        type: "success",
        text: `Event created as draft.${venueCreateNote ?? ""}`,
      });
    } catch (error) {
      setCreateMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Create request failed.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function clearHistory() {
    setConversationHistory([]);
    setStatusCode(null);
    setResponseBody(null);
    setStagedImages((prev) => {
      prev.forEach((img) => {
        URL.revokeObjectURL(img.previewUrl);
        objectUrlsRef.current.delete(img.previewUrl);
      });
      return [];
    });
    stagedCountRef.current = 0;
    setImageError(null);
    setCoverCandidateId(null);
    setCoverMessage(null);
    setLastInterpretResponse(null);
    setCreateMessage(null);
    setCreatedEventId(null);
    setCreatedSummary(null);
  }

  return (
    <main
      className="min-h-screen bg-[var(--color-background)] py-12 px-6"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Phase 8E: variant-aware header */}
        {isHostVariant ? (
          <div>
            <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">
              Create Happening
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Describe your happening and we&apos;ll set it up for you.
            </p>
            <Link
              href="/dashboard/my-events/new?classic=true"
              className="inline-block mt-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              onClick={() => sendTelemetry("fallback_click")}
            >
              ← Use classic form instead
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">
              Conversational Event Creator (Lab)
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Testing surface for <code>/api/events/interpret</code>. Replies appear below, and each follow-up should be entered in the same message box.
            </p>
          </div>
        )}

        <div className="card-base p-6 space-y-4">
          {/* Phase 8E: mode selector only in lab variant */}
          {!isHostVariant && (
            <label className="block space-y-2">
              <span className="text-sm text-[var(--color-text-secondary)]">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as InterpretMode)}
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                <option value="create">create</option>
                <option value="edit_series">edit_series</option>
                <option value="edit_occurrence">edit_occurrence</option>
              </select>
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {isHostVariant ? "Describe your happening" : "Message"}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={isHostVariant ? 4 : 5}
              className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              placeholder={isHostVariant
                ? "e.g. Open mic night at Dazzle Jazz, every Tuesday at 7pm, $10 cover..."
                : "Describe the event, or paste an image of a flyer..."}
            />
          </label>

          {/* Phase 8E: eventId/dateKey only in lab variant */}
          {!isHostVariant && mode !== "create" && (
            <label className="block space-y-2">
              <span className="text-sm text-[var(--color-text-secondary)]">Event ID</span>
              <input
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="UUID"
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          )}

          {!isHostVariant && mode === "edit_occurrence" && (
            <label className="block space-y-2">
              <span className="text-sm text-[var(--color-text-secondary)]">Date Key (YYYY-MM-DD)</span>
              <input
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                placeholder="2026-03-03"
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          )}

          {/* ---- Image staging area ---- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Images ({stagedImages.length}/{IMAGE_INPUT_LIMITS.maxCount})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={stagedImages.length >= IMAGE_INPUT_LIMITS.maxCount}
                className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
              >
                + Add image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) stageFiles(files);
                  e.target.value = "";
                }}
              />
            </div>

            {stagedImages.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {stagedImages.map((img) => {
                  const isSelected = coverCandidateId === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`relative group w-24 h-24 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] transition-all ${
                        isSelected
                          ? "ring-2 ring-[var(--color-accent-primary)] border-2 border-[var(--color-accent-primary)]"
                          : "border border-[var(--color-border-input)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt="Staged"
                        className={`w-full h-full object-cover ${
                          canShowCoverControls ? "cursor-pointer" : ""
                        }`}
                        onClick={
                          canShowCoverControls
                            ? () => setCoverCandidateId(isSelected ? null : img.id)
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        x
                      </button>
                      {isSelected && (
                        <span className="absolute top-1 left-1 bg-[var(--color-accent-primary)] text-[var(--color-background)] text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Cover
                        </span>
                      )}
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center truncate px-1">
                        {(img.file.size / 1024).toFixed(0)}KB
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {stagedImages.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Drag and drop, paste from clipboard, or click &ldquo;+ Add image&rdquo; to stage flyer images for extraction.
              </p>
            )}

            {canShowCoverControls && stagedImages.length > 0 && !coverCandidateId && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Click a thumbnail to select it as the event cover image.
              </p>
            )}
            {mode === "create" && stagedImages.length > 0 && coverCandidateId && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Selected cover will be attached after event creation.
              </p>
            )}

            {imageError && (
              <p className="text-xs text-[var(--color-text-error)]">{imageError}</p>
            )}
          </div>

          {/* ---- Action buttons ---- */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={submit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-background)] font-semibold disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : runActionLabel}
            </button>

            {/* Phase 4A: Apply as Cover — edit mode only */}
            {canShowCoverControls && isEditMode && coverCandidateId && (
              <button
                onClick={applyCover}
                disabled={isApplyingCover || isSubmitting}
                type="button"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60 transition-colors hover:bg-emerald-700"
              >
                {isApplyingCover ? "Applying..." : "Apply as Cover"}
              </button>
            )}

            {/* Phase 4B+8D: Confirm & Create — disabled after success to prevent duplicates */}
            {canShowCreateAction && !createdEventId && (
              <button
                onClick={createEvent}
                disabled={isCreating || isSubmitting}
                type="button"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 transition-colors hover:bg-blue-700"
              >
                {isCreating ? "Creating…" : "Confirm & Create"}
              </button>
            )}

            {conversationHistory.length > 0 && (
              <button
                onClick={clearHistory}
                type="button"
                className="px-4 py-2 rounded-lg border border-[var(--color-border-input)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Clear History ({conversationHistory.length / 2} turns)
              </button>
            )}
          </div>

          {statusCode === 200 && responseGuidance && (
            <div className="rounded-lg border border-[var(--color-border-input)] bg-[var(--color-bg-secondary)]/50 p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Latest Reply
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">
                {responseGuidance.clarification_question ??
                  responseGuidance.human_summary ??
                  "Draft updated. See details below."}
              </p>
              {responseGuidance.next_action === "ask_clarification" && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Continue by answering above, then click{" "}
                  <span className="font-semibold text-[var(--color-text-secondary)]">Send Answer</span>.
                </p>
              )}
            </div>
          )}

          {/* Phase 4A: Cover apply status message */}
          {coverMessage && (
            <p
              className={`text-xs ${
                coverMessage.type === "success"
                  ? "text-emerald-500"
                  : "text-[var(--color-text-error)]"
              }`}
            >
              {coverMessage.text}
            </p>
          )}

          {/* Phase 4B: Create error message (non-success only) */}
          {createMessage && createMessage.type === "error" && (
            <p className="text-xs text-[var(--color-text-error)]">
              {createMessage.text}
            </p>
          )}

          {/* Phase 8D: Post-create confidence block */}
          {createdSummary && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
              {/* Success header */}
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 text-lg">✓</span>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Event Created as Draft
                </h3>
                {createMessage && createMessage.type === "warning" && (
                  <span className="text-xs text-amber-500 ml-auto">{createMessage.text}</span>
                )}
              </div>

              {/* What was written summary */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                  What Was Written
                </h4>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {createdSummary.title && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Title</span>
                      <span className="text-[var(--color-text-primary)] font-medium">{createdSummary.title}</span>
                    </Fragment>
                  )}
                  {createdSummary.eventType && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Type</span>
                      <span className="text-[var(--color-text-primary)]">{createdSummary.eventType}</span>
                    </Fragment>
                  )}
                  {createdSummary.startDate && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Date</span>
                      <span className="text-[var(--color-text-primary)]">{createdSummary.startDate}</span>
                    </Fragment>
                  )}
                  {(createdSummary.startTime || createdSummary.endTime) && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Time</span>
                      <span className="text-[var(--color-text-primary)]">
                        {[createdSummary.startTime, createdSummary.endTime].filter(Boolean).join(" – ")}
                      </span>
                    </Fragment>
                  )}
                  {createdSummary.recurrenceRule && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Recurrence</span>
                      <span className="text-[var(--color-text-primary)]">{humanizeRecurrence(createdSummary.recurrenceRule, createdSummary.dayOfWeek)}</span>
                    </Fragment>
                  )}
                  {createdSummary.venueName && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Location</span>
                      <span className="text-[var(--color-text-primary)]">{createdSummary.venueName}</span>
                    </Fragment>
                  )}
                  {createdSummary.signupMode && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Signup</span>
                      <span className="text-[var(--color-text-primary)]">{createdSummary.signupMode}</span>
                    </Fragment>
                  )}
                  {createdSummary.costLabel && (
                    <Fragment>
                      <span className="text-[var(--color-text-tertiary)]">Cost</span>
                      <span className="text-[var(--color-text-primary)]">{createdSummary.costLabel}</span>
                    </Fragment>
                  )}
                  <Fragment>
                    <span className="text-[var(--color-text-tertiary)]">Cover</span>
                    <span className="text-[var(--color-text-primary)]">
                      {createdSummary.hasCover ? "✓ Attached" : "None"}
                      {createdSummary.coverNote && (
                        <span className="text-amber-500 ml-1">({createdSummary.coverNote})</span>
                      )}
                    </span>
                  </Fragment>
                </div>
              </div>

              {/* Next action CTAs */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-500/10">
                <Link
                  href={`/dashboard/my-events/${createdSummary.eventId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold transition-colors hover:bg-emerald-700"
                >
                  Open Draft →
                </Link>
                <Link
                  href="/dashboard/my-events"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-input)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Go to My Happenings
                </Link>
                <Link
                  href={`/dashboard/my-events/${createdSummary.eventId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-input)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                >
                  Edit & Publish
                </Link>
              </div>
            </div>
          )}

          {/* Phase 4B: Legacy create links fallback (createdEventId without summary — shouldn't happen but safe) */}
          {createdEventId && !createdSummary && (
            <div className="text-xs text-[var(--color-text-tertiary)] flex gap-3 flex-wrap">
              <Link
                href={`/dashboard/my-events/${createdEventId}`}
                className="underline hover:text-[var(--color-text-primary)] transition-colors"
              >
                Open Draft
              </Link>
              <Link
                href="/dashboard/my-events"
                className="underline hover:text-[var(--color-text-primary)] transition-colors"
              >
                Go to My Happenings (Drafts tab)
              </Link>
            </div>
          )}
        </div>

        {/* ---- Phase 8B: Human-readable guidance (primary) ---- */}
        {statusCode === 200 && responseGuidance && (
          <div className="card-base p-6 space-y-4">
            {/* Status header with next_action badge + confidence */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                What Happens Next
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  responseGuidance.next_action === "ask_clarification"
                    ? "bg-amber-500/15 text-amber-600"
                    : responseGuidance.next_action === "done"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-blue-500/15 text-blue-600"
                }`}
              >
                {responseGuidance.next_action.replace(/_/g, " ")}
              </span>
              {responseGuidance.confidence !== null && (
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Confidence: {Math.round(responseGuidance.confidence * 100)}%
                </span>
              )}
            </div>

            {/* Human summary */}
            {responseGuidance.human_summary && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {responseGuidance.human_summary}
              </p>
            )}

            {/* Phase 8C: Enhanced clarification prompt with input hints */}
            {responseGuidance.next_action === "ask_clarification" && (
              <div className="space-y-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
                {/* Primary question — single visible blocking question */}
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                  {responseGuidance.clarification_question ||
                    "Please provide the missing details."}
                </p>

                {/* Field-specific input hint chips */}
                {responseGuidance.blocking_fields.length > 0 && (
                  <div className="space-y-2">
                    {responseGuidance.blocking_fields.map((field) => {
                      const hint = getFieldHint(field);
                      return (
                        <div key={field} className="flex items-start gap-2 flex-wrap">
                          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700">
                            {hint?.label ?? field.replace(/_/g, " ")}
                          </span>
                          {hint && (
                            <span className="text-xs text-[var(--color-text-tertiary)]">
                              e.g. {hint.examples.join(", ")}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Next step callout */}
                <div className="flex items-center gap-2 pt-1 border-t border-amber-500/10">
                  <span className="text-xs text-amber-600">→</span>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Type your answer above, then click{" "}
                    <span className="font-semibold text-[var(--color-text-secondary)]">Send Answer</span>
                  </p>
                </div>
              </div>
            )}

            {/* Ready state */}
            {responseGuidance.next_action !== "ask_clarification" && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <p className="text-sm text-[var(--color-text-primary)]">
                  The draft is ready.
                  {canShowCreateAction
                    ? " Click Confirm & Create below to save."
                    : ""}
                </p>
              </div>
            )}

            {/* Quality hints */}
            {responseGuidance.quality_hints.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Suggestions
                </p>
                {responseGuidance.quality_hints.map((hint, i) => (
                  <p key={i} className="text-xs text-[var(--color-text-tertiary)]">
                    <span className="font-mono">{hint.field}</span>: {hint.hint}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- Phase 8B: Draft state summary ---- */}
        {statusCode === 200 && responseGuidance?.draft_payload && (
          <div className="card-base p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Draft Summary
            </h2>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {(() => {
                const d = responseGuidance.draft_payload;
                const rows: [string, string][] = [];
                if (d.title) rows.push(["Title", String(d.title)]);
                if (d.event_type) rows.push(["Type", String(d.event_type)]);
                if (d.start_date) rows.push(["Date", String(d.start_date)]);
                if (d.start_time) rows.push(["Start", String(d.start_time)]);
                if (d.end_time) rows.push(["End", String(d.end_time)]);
                if (d.series_mode) rows.push(["Series", String(d.series_mode)]);
                if (d.recurrence_rule) rows.push(["Recurrence", humanizeRecurrence(typeof d.recurrence_rule === "string" ? d.recurrence_rule : null, typeof d.day_of_week === "string" ? d.day_of_week : null)]);
                if (d.venue_name) rows.push(["Venue", String(d.venue_name)]);
                if (d.venue_id) rows.push(["Venue ID", String(d.venue_id)]);
                if (d.custom_location_name) rows.push(["Location", String(d.custom_location_name)]);
                if (d.location_mode) rows.push(["Location Mode", String(d.location_mode)]);
                if (d.online_url) rows.push(["Online URL", String(d.online_url)]);
                if (d.signup_mode) rows.push(["Signup", String(d.signup_mode)]);
                if (d.is_free !== undefined && d.is_free !== null) rows.push(["Free", d.is_free ? "Yes" : "No"]);
                if (d.cost_label) rows.push(["Cost", String(d.cost_label)]);
                if (d.capacity) rows.push(["Capacity", String(d.capacity)]);
                if (d.has_timeslots) rows.push(["Timeslots", "Enabled"]);
                if (d.description) rows.push(["Description", String(d.description).slice(0, 120) + (String(d.description).length > 120 ? "…" : "")]);
                if (rows.length === 0) rows.push(["—", "No fields extracted yet"]);
                return rows.map(([label, value], i) => (
                  <Fragment key={i}>
                    <span className="text-[var(--color-text-tertiary)] font-medium text-right whitespace-nowrap">{label}</span>
                    <span className="text-[var(--color-text-primary)] break-words">{value}</span>
                  </Fragment>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ---- Conversation history display ---- */}
        {conversationHistory.length > 0 && (
          <div className="card-base p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Conversation History
            </h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {conversationHistory.map((entry, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    entry.role === "user"
                      ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                      : "bg-[var(--color-accent-primary)]/10 text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span className="font-mono font-bold">{entry.role}:</span>{" "}
                  {entry.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Phase 8B: Raw JSON in collapsible debug panel (lab only) ---- */}
        {!isHostVariant && (
          <details className="card-base">
            <summary className="cursor-pointer px-6 py-4 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors select-none">
              Debug: Raw API Response
              {statusCode !== null && (
                <span className="ml-2 font-mono text-xs">
                  (HTTP {statusCode})
                </span>
              )}
            </summary>
            <div className="px-6 pb-6 space-y-2">
              <pre className="overflow-auto rounded-lg bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-primary)] max-h-96">
                {responseBody ? JSON.stringify(responseBody, null, 2) : "No response yet."}
              </pre>
            </div>
          </details>
        )}
      </div>
    </main>
  );
}

export default ConversationalCreateUI;
