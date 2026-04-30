/**
 * AI Prompt Contract (Track 1, PR 5)
 *
 * Owns the prompt + interpreter contract surface for `/api/events/interpret`:
 *
 *   - the system prompt (additively layered on prior rules)
 *   - the user-prompt JSON envelope (compact current event state, ordered
 *     image references, patch-only edit semantics, scope contract)
 *   - the response JSON schema with the new required `scope` field
 *   - the server-side scope ambiguity decision: when the model returns
 *     `scope === "ambiguous"`, the server forces clarification even if a
 *     patch is also returned
 *
 * Per the collaboration plan (`docs/investigation/ai-event-ops-collaboration-plan.md`)
 * §5.3 (structured scope), §5.4 (preserve existing state, patch-only edits),
 * and §5.5 (stable image references).
 *
 * Field names used in the contract reuse `patchFieldRegistry.ts` exactly. No
 * new field names are introduced. Schema-level patch-only output (dropping
 * required-keys for edit modes) is intentionally NOT done here — that
 * structural change belongs to PR 9 (published-event gate). Patch-only is
 * enforced in this PR via prompt instructions and the null-means-preserve
 * convention; the existing `sanitizeInterpretDraftPayload` allowlist still
 * filters write surface.
 *
 * Single-writer file lock per plan §8.2 ("prompt contract files once
 * claimed"). Do not edit without an explicit claim entry in
 * `docs/investigation/track1-claims.md`.
 */

import {
  buildInterpretResponseSchema,
  NEXT_ACTIONS,
  type InterpretMode,
  type NextAction,
} from "@/lib/events/interpretEventContract";

// ---------------------------------------------------------------------------
// Scope contract (plan §5.3)
// ---------------------------------------------------------------------------

export const AI_INTERPRET_SCOPES = ["series", "occurrence", "ambiguous"] as const;
export type AiInterpretScope = (typeof AI_INTERPRET_SCOPES)[number];

export function isAiInterpretScope(value: unknown): value is AiInterpretScope {
  return typeof value === "string" && (AI_INTERPRET_SCOPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Ordered image references (plan §5.5)
// ---------------------------------------------------------------------------

/**
 * Stable per-turn image reference passed into the user prompt. Image inputs
 * carry a deterministic `index` so natural-language phrases like
 * "use the other image" resolve from a visible ordered list rather than
 * model guesswork. `eventImageId` distinguishes images already persisted to
 * `event_images` from images still staged in chat (`undefined` => staged).
 */
export interface OrderedImageReference {
  index: number;
  clientId: string;
  eventImageId?: string | null;
  fileName?: string | null;
  isCurrentCover: boolean;
}

const IMAGE_REFERENCE_MAX_COUNT = 12;
const IMAGE_REFERENCE_FILENAME_MAX = 200;
const IMAGE_REFERENCE_ID_MAX = 80;

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Validate, normalize, and reindex a list of caller-supplied image
 * references. Indices are reassigned to a stable 0-based ordering matching
 * the input array order. Returns an empty array when input is missing or
 * malformed; partial entries are dropped, never silently injected.
 */
export function buildOrderedImageReferences(input: unknown): OrderedImageReference[] {
  if (!Array.isArray(input)) return [];

  const refs: OrderedImageReference[] = [];
  for (const raw of input) {
    if (refs.length >= IMAGE_REFERENCE_MAX_COUNT) break;
    if (typeof raw !== "object" || raw === null) continue;

    const row = raw as Record<string, unknown>;
    const clientId = trimOrNull(row.clientId ?? row.client_id, IMAGE_REFERENCE_ID_MAX);
    if (!clientId) continue;

    const eventImageId = trimOrNull(
      row.eventImageId ?? row.event_image_id,
      IMAGE_REFERENCE_ID_MAX,
    );
    const fileName = trimOrNull(row.fileName ?? row.file_name, IMAGE_REFERENCE_FILENAME_MAX);
    const isCurrentCover = row.isCurrentCover === true || row.is_current_cover === true;

    refs.push({
      index: refs.length,
      clientId,
      eventImageId: eventImageId ?? null,
      fileName: fileName ?? null,
      isCurrentCover,
    });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// System prompt (additive layering — plan §5.3, §5.4, §5.5)
// ---------------------------------------------------------------------------

/**
 * Additional rules layered onto the existing system prompt to satisfy
 * §13.2: structured scope, patch-only edits, ambiguity examples, ordered
 * image references, and the one-question rule. Existing prompt rules
 * (recurrence contract, venue/online URL guidance, web-search citation
 * rules, RSVP/timeslot defaults, future-date guard, title formatting,
 * etc.) are preserved upstream — these rules are appended.
 */
const SCOPE_AND_PATCH_RULES: readonly string[] = [
  // Structured scope (§5.3)
  "Scope contract (REQUIRED): every response MUST include a top-level field 'scope' set to exactly one of 'series', 'occurrence', or 'ambiguous'.",
  "- For mode=create, scope is always 'series' (a brand-new event begins as a series shape, even when single).",
  "- For mode=edit_series, scope is 'series'.",
  "- For mode=edit_occurrence, scope is 'occurrence' when the user's intent unambiguously targets a single date. Otherwise scope is 'ambiguous'.",
  "- Set scope to 'ambiguous' whenever the user's request could reasonably mean either the whole series or just one occurrence and the surrounding context (current_event recurrence, conversation history, explicit dates) does not resolve it. The server will force a clarification turn even if you also returned a patch.",
  "Negative examples that MUST resolve to scope='ambiguous':",
  "- 'move next Thursday to 7' on a recurring series — could be the next occurrence only or every Thursday going forward.",
  "- 'change this one to the new venue' without a deterministic occurrence reference — 'this one' could be the series or a specific date.",
  "- 'use the other cover' when image_references contains zero or more than two entries (no deterministic 'other'), or when none of the references is marked isCurrentCover.",
  // Patch-only edits (§5.4)
  "Patch-only edits (mode=edit_series or mode=edit_occurrence): the draft_payload MUST be a patch of the user's intended changes against current_event. Fields the user did not ask to change must be returned unchanged from current_event when the schema requires them, or set to null only when the user explicitly asked to clear that field.",
  "- Never invent or 'normalize' values that the user did not ask to change. Treat current_event as the source of truth for unchanged fields.",
  "- Never clear a field as a side effect of editing another. Clearing requires an explicit user instruction such as 'remove the cover image' or 'drop the end time'.",
  "- For array fields (event_type, categories, custom_dates), preserve the existing array verbatim unless the user asked to add or remove specific values. Do not reorder for cosmetic reasons.",
  // Ordered image references (§5.5)
  "Ordered image references: when image_references is present, treat it as the authoritative list of selectable images. Each reference has a stable 'index', 'clientId', optional 'eventImageId', optional 'fileName', and 'isCurrentCover'.",
  "- Resolve natural-language image instructions (for example 'use the other one', 'use the second image', 'switch to the flyer') against this list deterministically by index.",
  "- When setting cover_image_url from an image_references entry, prefer the entry's eventImageId where present; otherwise leave cover_image_url null and indicate the chosen image's index in human_summary so the client can resolve a staged file.",
  "- If the request is image-related and image_references is empty or has fewer entries than the request implies (for example user says 'use the other one' but only one entry exists), set scope to 'ambiguous' and ask one clarifying question.",
  // Ask-one-question rule
  "One-question rule: ask AT MOST one clarifying question, and only when publishing the result would be materially wrong without the answer. Never ask multiple questions in the same turn. If multiple things are missing, pick the single most blocking one and leave the rest for follow-up turns.",
];

/**
 * Build the full system prompt. The `additiveAfter` array is appended to a
 * caller-supplied base prompt. Callers should pass the existing prompt
 * lines and rely on `SCOPE_AND_PATCH_RULES` being applied last so the new
 * contract takes precedence over older guidance on the same topics.
 */
export function buildAiPromptContractAdditions(): readonly string[] {
  return SCOPE_AND_PATCH_RULES;
}

/**
 * Convenience wrapper: take an existing base prompt (already-joined
 * string) and append the contract additions. Used by the route to keep
 * the layering explicit at the call site.
 */
export function appendAiPromptContractAdditions(basePrompt: string): string {
  const additions = SCOPE_AND_PATCH_RULES.join("\n");
  if (!basePrompt.trim()) return additions;
  return `${basePrompt}\n${additions}`;
}

// ---------------------------------------------------------------------------
// User prompt envelope
// ---------------------------------------------------------------------------

export interface BuildUserPromptInput {
  mode: InterpretMode;
  message: string;
  dateKey?: string;
  eventId?: string;
  conversationHistory: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  /** Compact id+name catalog the model is allowed to see. */
  venueCatalog: ReadonlyArray<{ id: string; name: string }>;
  /** Compact JSON snapshot of the current event for edit modes; null for create. */
  currentEvent: Record<string, unknown> | null;
  lockedDraft?: Record<string, unknown> | null;
  extractedImageText?: string;
  googleMapsHint?: unknown;
  webSearchVerification?: unknown;
  /** Ordered image references with stable indices (plan §5.5). */
  imageReferences?: ReadonlyArray<OrderedImageReference>;
  /** Current date in America/Denver, YYYY-MM-DD. */
  currentDate: string;
  currentTimezone?: string;
}

/**
 * Build the user-prompt JSON envelope sent as `input` to the model. The
 * shape is intentionally flat and additive so prior fields (locked_draft,
 * google_maps_hint, web_search_verification, extracted_image_text) keep
 * working unchanged. New §13.2 additions:
 *   - `image_references` is always present (possibly empty) so the model
 *     never has to guess whether the channel exists.
 *   - For edit modes, `edit_contract` describes the patch-only semantics
 *     and the server-side ambiguity rule.
 *   - The required output shape now includes `scope`.
 */
export function buildAiPromptUserEnvelope(input: BuildUserPromptInput): string {
  const isEdit = input.mode === "edit_series" || input.mode === "edit_occurrence";

  const editContract = isEdit
    ? {
        rule: "patch_only",
        description:
          "Return a patch in draft_payload representing only the user's intended changes. Fields the user did not ask to change must mirror current_event exactly. Use null only when the user explicitly asked to clear a field.",
        scope_field: {
          required: true,
          values: [...AI_INTERPRET_SCOPES],
          server_behavior:
            "When scope is 'ambiguous', the server forces next_action='ask_clarification' even if draft_payload contains a patch.",
        },
      }
    : null;

  const envelope: Record<string, unknown> = {
    task: "interpret_event_message",
    current_date: input.currentDate,
    current_timezone: input.currentTimezone ?? "America/Denver",
    mode: input.mode,
    message: input.message,
    date_key: input.dateKey ?? null,
    event_id: input.eventId ?? null,
    current_event: input.currentEvent,
    locked_draft: input.lockedDraft ?? null,
    venue_catalog: input.venueCatalog,
    conversation_history: input.conversationHistory,
    image_references: input.imageReferences ?? [],
  };

  if (input.extractedImageText) {
    envelope.extracted_image_text = input.extractedImageText;
    envelope.image_extraction_note =
      "The user attached image(s) of an event flyer. The extracted_image_text field contains OCR/vision output from those images. Use this data to populate the draft_payload fields. The user's message may provide additional context or corrections.";
  }

  if (input.googleMapsHint) {
    envelope.google_maps_hint = input.googleMapsHint;
    envelope.google_maps_note =
      "A Google Maps link was detected and server-expanded. Prefer this hint for location/address fields when present. Do not ask for address again if full address is already available in this hint.";
  }

  if (input.webSearchVerification) {
    envelope.web_search_verification = input.webSearchVerification;
    envelope.web_search_note =
      "Online search was performed by a separate verifier. Use sourced facts to reduce unnecessary questions. If status is no_reliable_sources, treat it as an attempted search with no exact public source found.";
  }

  if (editContract) {
    envelope.edit_contract = editContract;
  }

  envelope.required_output_shape = {
    next_action: NEXT_ACTIONS.join(" | "),
    scope: AI_INTERPRET_SCOPES.join(" | "),
    confidence: "number 0..1",
    human_summary: "string",
    clarification_question: "string|null",
    blocking_fields: "string[]",
    draft_payload: "object",
  };

  return JSON.stringify(envelope, null, 2);
}

// ---------------------------------------------------------------------------
// Response schema with required `scope`
// ---------------------------------------------------------------------------

/**
 * Wrap the existing interpret response schema and add a required top-level
 * `scope` field. The base schema's required-keys list and properties are
 * preserved exactly; only `scope` is added. Structural patch-only output
 * (dropping required draft_payload keys for edit modes) is deferred to
 * PR 9 per the approved scope.
 */
export interface AiPromptResponseSchema {
  type: string;
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, unknown>;
}

export function buildAiPromptResponseSchema(): AiPromptResponseSchema {
  const base = buildInterpretResponseSchema() as unknown as AiPromptResponseSchema;

  return {
    type: base.type,
    additionalProperties: base.additionalProperties,
    required: [...base.required, "scope"],
    properties: {
      ...base.properties,
      scope: { type: "string", enum: [...AI_INTERPRET_SCOPES] },
    },
  };
}

// ---------------------------------------------------------------------------
// Server-side scope ambiguity decision (plan §5.3)
// ---------------------------------------------------------------------------

const DEFAULT_AMBIGUOUS_CLARIFICATION =
  "Did you want to change just this one occurrence, or the whole recurring series?";

export interface ScopeAmbiguityInput {
  mode: InterpretMode;
  scope: AiInterpretScope;
  modelNextAction: NextAction;
  modelClarificationQuestion: string | null;
  modelBlockingFields: string[];
}

export interface ScopeAmbiguityDecision {
  forced: boolean;
  nextAction: NextAction;
  clarificationQuestion: string | null;
  blockingFields: string[];
  /** True when the server forced a clarification even though the model also returned a patch. */
  patchSuppressed: boolean;
  reason: "ambiguous_scope" | "model_decision";
}

/**
 * Decide whether the server should force a clarification turn based on the
 * model's `scope` output. When `scope === "ambiguous"`, the server forces
 * `next_action = "ask_clarification"` regardless of whether the model also
 * returned a patch. The model's clarification question is preserved when
 * present; otherwise a default series-vs-occurrence question is used.
 *
 * For `mode=create`, ambiguity is downgraded — series is the only
 * meaningful surface — so the model's decision is preserved as-is.
 */
export function decideScopeAmbiguity(input: ScopeAmbiguityInput): ScopeAmbiguityDecision {
  const passthrough: ScopeAmbiguityDecision = {
    forced: false,
    nextAction: input.modelNextAction,
    clarificationQuestion: input.modelClarificationQuestion,
    blockingFields: input.modelBlockingFields,
    patchSuppressed: false,
    reason: "model_decision",
  };

  if (input.scope !== "ambiguous") return passthrough;
  if (input.mode === "create") return passthrough;

  const question =
    (input.modelClarificationQuestion && input.modelClarificationQuestion.trim().length > 0
      ? input.modelClarificationQuestion.trim()
      : null) ?? DEFAULT_AMBIGUOUS_CLARIFICATION;

  const blockingFields = input.modelBlockingFields.includes("scope")
    ? input.modelBlockingFields
    : [...input.modelBlockingFields, "scope"];

  return {
    forced: true,
    nextAction: "ask_clarification",
    clarificationQuestion: question,
    blockingFields,
    patchSuppressed: input.modelNextAction !== "ask_clarification",
    reason: "ambiguous_scope",
  };
}

// ---------------------------------------------------------------------------
// Compact current-event projection (plan §5.4)
// ---------------------------------------------------------------------------

/**
 * Compact whitelist of `events` columns the model is allowed to see when
 * rendering an existing event for edit modes. Field names match
 * `patchFieldRegistry.ts` exactly. The list intentionally excludes
 * server-derived/private fields (host_id, region_id, series identity,
 * source telemetry, admin verification pair) to keep the prompt tight and
 * avoid leaking ownership/admin metadata into model context.
 */
export const AI_PROMPT_CURRENT_EVENT_FIELDS = [
  "id",
  "title",
  "event_type",
  "categories",
  "event_date",
  "day_of_week",
  "start_time",
  "end_time",
  "signup_time",
  "recurrence_rule",
  "recurrence_pattern",
  "recurrence_end_date",
  "custom_dates",
  "is_recurring",
  "max_occurrences",
  "location_mode",
  "venue_id",
  "venue_name",
  "venue_address",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_location_name",
  "online_url",
  "is_free",
  "cost_label",
  "signup_mode",
  "signup_url",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "is_published",
  "visibility",
  "status",
  "cover_image_url",
  "description",
  "notes",
  "host_notes",
  "external_url",
  "age_policy",
  "timezone",
] as const;

export type AiPromptCurrentEventField = (typeof AI_PROMPT_CURRENT_EVENT_FIELDS)[number];

/**
 * Project an event row to the compact JSON the model is allowed to see.
 * Fields not in the projection list are dropped. Undefined values are
 * dropped; null values are preserved so the model can distinguish
 * "explicitly empty" from "not relevant".
 */
export function projectCurrentEventForPrompt(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of AI_PROMPT_CURRENT_EVENT_FIELDS) {
    const value = event[field];
    if (value === undefined) continue;
    projected[field] = value;
  }
  return projected;
}
