import { getInvalidEventTypes, normalizeIncomingEventTypes } from "@/lib/events/eventTypeContract";
import { ALLOWED_OVERRIDE_FIELDS, sanitizeOverridePatch } from "@/lib/events/overridePatchContract";

export const INTERPRET_MODES = ["create", "edit_series", "edit_occurrence"] as const;
export type InterpretMode = (typeof INTERPRET_MODES)[number];

export const NEXT_ACTIONS = ["ask_clarification", "show_preview", "await_confirmation", "done"] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export interface InterpretEventRequestBody {
  mode: InterpretMode;
  message: string;
  eventId?: string;
  dateKey?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface QualityHint {
  field: string;
  impact: string;
  prompt: string;
}

export interface InterpretEventDraftResponse {
  mode: InterpretMode;
  next_action: NextAction;
  confidence: number;
  human_summary: string;
  clarification_question: string | null;
  blocking_fields: string[];
  draft_payload: Record<string, unknown>;
  quality_hints: QualityHint[];
}

const CREATE_PAYLOAD_ALLOWLIST = new Set([
  "title",
  "description",
  "event_type",
  "capacity",
  "host_notes",
  "venue_id",
  "day_of_week",
  "start_time",
  "event_date",
  "end_time",
  "recurrence_rule",
  "cover_image_url",
  "is_published",
  "timezone",
  "location_mode",
  "online_url",
  "is_free",
  "cost_label",
  "signup_mode",
  "signup_url",
  "signup_deadline",
  "signup_time",
  "age_policy",
  "is_dsc_event",
  "external_url",
  "categories",
  "max_occurrences",
  "custom_dates",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "allow_guests",
  "custom_location_name",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_latitude",
  "custom_longitude",
  "location_notes",
  "series_mode",
  "start_date",
  "occurrence_count",
]);

const EDIT_SERIES_PAYLOAD_ALLOWLIST = new Set([
  "title",
  "description",
  "event_type",
  "capacity",
  "host_notes",
  "day_of_week",
  "start_time",
  "event_date",
  "end_time",
  "status",
  "recurrence_rule",
  "cover_image_url",
  "is_published",
  "visibility",
  "timezone",
  "location_mode",
  "online_url",
  "is_free",
  "cost_label",
  "signup_mode",
  "signup_url",
  "signup_deadline",
  "signup_time",
  "age_policy",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "allow_guests",
  "external_url",
  "categories",
  "max_occurrences",
  "custom_dates",
  "venue_id",
  "custom_location_name",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_latitude",
  "custom_longitude",
  "location_notes",
]);

const OCCURRENCE_PAYLOAD_ALLOWLIST = new Set([
  "date_key",
  "status",
  "override_start_time",
  "override_cover_image_url",
  "override_notes",
  "override_patch",
]);

const FLEX_DRAFT_VALUE_SCHEMA = {
  type: ["string", "number", "boolean", "null", "array"],
  items: { type: ["string", "number", "boolean", "null"] },
};

const DRAFT_PAYLOAD_FIELD_KEYS = [
  ...new Set([
    ...CREATE_PAYLOAD_ALLOWLIST,
    ...EDIT_SERIES_PAYLOAD_ALLOWLIST,
    ...OCCURRENCE_PAYLOAD_ALLOWLIST,
  ]),
].filter((key) => key !== "override_patch");

const OVERRIDE_PATCH_FIELD_KEYS = [...ALLOWED_OVERRIDE_FIELDS];
const DRAFT_PAYLOAD_REQUIRED_KEYS = [...DRAFT_PAYLOAD_FIELD_KEYS, "override_patch"];

function buildDraftPayloadProperties() {
  const properties: Record<string, unknown> = {};
  for (const key of DRAFT_PAYLOAD_FIELD_KEYS) {
    properties[key] = FLEX_DRAFT_VALUE_SCHEMA;
  }

  const overridePatchProperties: Record<string, unknown> = {};
  for (const key of ALLOWED_OVERRIDE_FIELDS) {
    overridePatchProperties[key] = FLEX_DRAFT_VALUE_SCHEMA;
  }

  properties.override_patch = {
    type: "object",
    additionalProperties: false,
    required: OVERRIDE_PATCH_FIELD_KEYS,
    properties: overridePatchProperties,
  };

  return properties;
}

export function buildInterpretResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "next_action",
      "confidence",
      "human_summary",
      "clarification_question",
      "blocking_fields",
      "draft_payload",
    ],
    properties: {
      next_action: { type: "string", enum: [...NEXT_ACTIONS] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      human_summary: { type: "string", minLength: 1, maxLength: 1000 },
      clarification_question: {
        type: ["string", "null"],
        minLength: 1,
        maxLength: 500,
      },
      blocking_fields: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 80 },
        maxItems: 20,
      },
      draft_payload: {
        type: "object",
        additionalProperties: false,
        required: DRAFT_PAYLOAD_REQUIRED_KEYS,
        properties: buildDraftPayloadProperties(),
      },
    },
  };
}

function coercePlainObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizePayloadKeys(
  payload: Record<string, unknown>,
  allowlist: Set<string>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (allowlist.has(key)) next[key] = value;
  }
  return next;
}

export function sanitizeInterpretDraftPayload(
  mode: InterpretMode,
  payload: unknown,
  contextDateKey?: string
): Record<string, unknown> {
  const candidate = coercePlainObject(payload);

  if (mode === "create") {
    const next = sanitizePayloadKeys(candidate, CREATE_PAYLOAD_ALLOWLIST);

    if (next.event_type !== undefined) {
      next.event_type = normalizeIncomingEventTypes(next.event_type);
    }
    if (!next.start_date && typeof next.event_date === "string") {
      next.start_date = next.event_date;
    }
    if (!next.series_mode) {
      next.series_mode = "single";
    }

    return next;
  }

  if (mode === "edit_series") {
    const next = sanitizePayloadKeys(candidate, EDIT_SERIES_PAYLOAD_ALLOWLIST);

    if (next.event_type !== undefined) {
      next.event_type = normalizeIncomingEventTypes(next.event_type);
    }

    return next;
  }

  const next = sanitizePayloadKeys(candidate, OCCURRENCE_PAYLOAD_ALLOWLIST);
  if (!next.date_key && contextDateKey) {
    next.date_key = contextDateKey;
  }

  if (next.override_patch !== undefined) {
    const patch = coercePlainObject(next.override_patch);
    next.override_patch = sanitizeOverridePatch(patch);
  }

  return next;
}

export function validateSanitizedDraftPayload(
  mode: InterpretMode,
  payload: Record<string, unknown>
): { ok: true } | { ok: false; error: string; blockingField?: string } {
  const invalidTypes = getInvalidEventTypes(payload.event_type);
  if (invalidTypes.length > 0) {
    return { ok: false, error: `Invalid event types: ${invalidTypes.join(", ")}`, blockingField: "event_type" };
  }

  if (mode === "create") {
    const requiredFieldChecks: Array<[string, boolean]> = [
      ["title", typeof payload.title === "string" && payload.title.trim().length > 0],
      ["start_time", typeof payload.start_time === "string" && payload.start_time.trim().length > 0],
      ["start_date", typeof payload.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.start_date)],
      ["series_mode", typeof payload.series_mode === "string" && payload.series_mode.trim().length > 0],
      ["event_type", Array.isArray(payload.event_type) && payload.event_type.length > 0],
    ];

    for (const [field, ok] of requiredFieldChecks) {
      if (!ok) {
        return { ok: false, error: `Missing required create field: ${field}`, blockingField: field };
      }
    }
  }

  if (mode === "edit_occurrence") {
    if (typeof payload.date_key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date_key)) {
      return { ok: false, error: "Missing or invalid date_key for occurrence edit", blockingField: "date_key" };
    }
  }

  return { ok: true };
}

export function validateInterpretMode(value: unknown): value is InterpretMode {
  return typeof value === "string" && INTERPRET_MODES.includes(value as InterpretMode);
}

export function validateNextAction(value: unknown): value is NextAction {
  return typeof value === "string" && NEXT_ACTIONS.includes(value as NextAction);
}

export function buildQualityHints(
  payload: Record<string, unknown>
): QualityHint[] {
  const hints: QualityHint[] = [];
  const eventTypes = normalizeIncomingEventTypes(payload.event_type);
  const isPerformerHeavyEvent = eventTypes.some((t) =>
    t === "open_mic" || t === "jam_session" || t === "workshop"
  );

  if (isPerformerHeavyEvent && !payload.signup_mode) {
    hints.push({
      field: "signup_mode",
      impact: "Performers cannot plan ahead without clear signup instructions.",
      prompt: "Add a signup method (at venue or online) to improve performer conversion.",
    });
  }

  if (isPerformerHeavyEvent && !payload.has_timeslots) {
    hints.push({
      field: "has_timeslots",
      impact: "Hosts may need manual lineup coordination on event day.",
      prompt: "Timeslots are optional, but enabling them can pre-fill lineup before traffic arrives.",
    });
  }

  if (payload.is_free === null || payload.is_free === undefined) {
    hints.push({
      field: "is_free",
      impact: "Attendees may hesitate when pricing is unclear.",
      prompt: "Set cost as Free or Paid for stronger event card clarity.",
    });
  }

  return hints;
}
