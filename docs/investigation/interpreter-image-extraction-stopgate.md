# Investigation: Interpreter Image Extraction + Cover Assignment

**Stop-Gate Phase:** A/B (Investigate + Critique)
**Date:** 2026-02-24
**Status:** APPROVED — Phases 0-6 complete; post-launch hardening patch applied (2026-02-27).
**Parent feature:** Conversational Event Creation (`conversational-event-creation-stopgate.md`)
**Scope expansion:** Section 4.7 of parent doc explicitly deferred image support to a future phase. This document covers that future phase.

---

## 1. Current State Evidence

### 1.1 What Already Exists (Infrastructure-Ready)

| Layer | Evidence | File |
|-------|----------|------|
| `cover_image_url` in CREATE allowlist | 43-field allowlist includes it | `web/src/lib/events/interpretEventContract.ts` CREATE_PAYLOAD_ALLOWLIST |
| `cover_image_url` in EDIT_SERIES allowlist | 35-field allowlist includes it | same file, EDIT_SERIES_PAYLOAD_ALLOWLIST |
| `override_cover_image_url` in OCCURRENCE allowlist | 6-field allowlist includes it | same file, OCCURRENCE_PAYLOAD_ALLOWLIST |
| `event_images` gallery table + RLS | Full CRUD RLS, soft-delete, `uploaded_by` tracking | `supabase/migrations/20260118120000_event_images_and_external_url.sql` |
| `event-images` storage bucket | Public bucket, path-based RLS: `{eventId}/{uuid}.{ext}` | Same migration, storage policies |
| `ImageUpload` component | Drag-drop, crop modal, file validation (JPEG/PNG/WebP/GIF), canvas resize | `web/src/components/ui/ImageUpload.tsx` |
| `uploadCoverForEvent()` | Client-direct-to-Supabase upload, `event_images` row insert, compensating delete on failure | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` lines 346-387 |
| Create-mode deferred upload | `pendingCoverFile` held in React state, uploaded after POST returns `eventId`, then `events.cover_image_url` updated via direct `.update()` | EventForm.tsx lines 572-580, 901-933 |
| Interpreter route with feature flag | `ENABLE_NL_EVENTS_INTERPRETER=true`, auth, rate limiting (30/15min), 25s timeout, strict JSON schema | `web/src/app/api/events/interpret/route.ts` |
| Interpreter lab UI | Hidden, unlinked dev harness; text-only input | `web/src/app/(protected)/dashboard/my-events/interpreter-lab/page.tsx` |

### 1.2 What Is Missing

| Gap | Impact |
|-----|--------|
| Interpreter route does not fetch `cover_image_url` in event context query (lines 327-337) | LLM has no visibility into current image state for edit modes |
| System prompt and user prompt give LLM no image-related instructions | LLM will not populate image fields in drafts |
| No vision/image input path in the interpret request contract | `InterpretEventRequestBody` has no `image_inputs` field |
| `uploadCoverForEvent()` is inline in EventForm — not shared | Interpreter flow cannot reuse it without extraction |
| Lab UI has no `conversationHistory` support | Multi-turn clarification loops cannot be tested |
| No staging upload path for images without an `eventId` | Storage policy requires `{eventId}/` as first path segment |
| 25-second timeout budget insufficient for vision + interpretation | Two LLM calls need separate timeout budgets |

---

## 2. Proposed Architecture

### 2.1 Two Separate Concerns

Image support in the interpreter involves two distinct data flows that should not be conflated:

1. **Extraction** — Reading text/structure from a flyer image to produce a draft payload. This is a vision API input concern. The image does not need to be persisted.
2. **Cover assignment** — Persisting an uploaded image as the event's cover photo. This is a storage concern that uses existing infrastructure.

### 2.2 Chat-to-Image Communication: Base64 in Request Body

```
CLIENT                                          SERVER
──────                                          ──────
User pastes/drops/selects image
    │
    ├─► Canvas resize (max 1200px, JPEG 0.8)
    │   → base64 string (~200-500KB per image)
    │
    ├─► Original File held in React state
    │   (pendingCoverFile, for later upload)
    │
    └─► POST /api/events/interpret
        {
          mode, message,
          image_inputs: [                        ─► Validate: count ≤ 3,
            {                                       decoded size ≤ 1MB each,
              data: "base64…",                      mime in allowlist
              mime_type: "image/jpeg"
            }                                    ─► Phase A: Vision extraction
          ],                                        (15s budget, separate call)
          conversationHistory?                      Input: data URLs + extraction prompt
        }                                           Output: structured text

                                                 ─► Phase B: Structured interpretation
                                                    (15s budget, existing logic)
                                                    Input: message + extracted text + context
                                                    Output: same draft_payload schema

                                                 ─► Response:
                                                    { ...existing fields,
                                                      extraction_metadata: {
                                                        images_processed: number,
                                                        confidence: number,
                                                        extracted_fields: string[],
                                                        warnings: string[]
                                                      }
                                                    }
```

**Why base64, not storage URLs:**

| Factor | Base64 in request | Storage staging path |
|--------|-------------------|---------------------|
| New infrastructure | None | New storage policy, staging path, cleanup cron |
| Server complexity | Pass data URLs to OpenAI | Fetch from Supabase, handle auth, then pass to OpenAI |
| Payload size (3 resized images) | ~1.2-2MB base64 — within Vercel's 4.5MB limit | Negligible (URL strings) |
| Cleanup | Nothing to clean up | Must purge orphaned staging files |
| Matches existing patterns | Yes — no storage until eventId exists | No — creates a novel pre-event storage path |

Client-side canvas resize (which `ImageUpload` already does at 1200px/JPEG 0.9) keeps payloads manageable. For extraction, full resolution is unnecessary — a poster at 1200px wide is readable by vision models.

### 2.3 Two-Phase LLM Call

The current single-call architecture (25s timeout) cannot absorb a vision pre-pass. Proposed split:

**Phase A: Vision Extraction (new)**
- Input: image data URLs + extraction-focused system prompt
- Output: structured text (date, time, venue, title, signup cues, confidence per field)
- Timeout: 15 seconds
- Model: same OpenAI model with vision capability
- On low confidence: return `ask_clarification` immediately with specific question (e.g., "I see a date of March 4 — is that the start date or a one-time event?")

**Phase B: Structured Interpretation (existing, unchanged)**
- Input: user message + extracted text from Phase A (injected as context) + event/venue context
- Output: same `draft_payload` schema, same validation, same sanitization
- Timeout: 15 seconds
- Logic: identical to current implementation with extracted text prepended to user message context

Benefits of separation:
- Extraction confidence is measurable independently
- Low-confidence Phase A can short-circuit to `ask_clarification` without burning Phase B budget
- Phase B prompt/schema are completely unchanged
- Each phase is independently testable

### 2.4 Cover Assignment Flow (Post-Interpretation)

**Edit mode (eventId exists):**
1. If interpreter draft includes `cover_image_url` intent, client shows "Use this image as cover?" in confirmation UI
2. On confirm, client uploads original (un-resized) file via existing `uploadCoverForEvent()` pattern
3. `events.cover_image_url` updated via existing PATCH endpoint

**Create mode (no eventId yet):**
1. Original file held in `pendingCoverFile` React state (same pattern as EventForm today)
2. Draft payload sets `cover_image_url: null` (same as current create behavior)
3. After POST creates event and returns `eventId`, deferred upload fires (same as EventForm lines 901-933)

No new storage policies, no staging bucket, no new upload API routes.

---

## 3. Contract Changes

### 3.1 `InterpretEventRequestBody` Extension

```typescript
// Addition to existing type
image_inputs?: Array<{
  data: string;       // base64-encoded image data (no data URL prefix)
  mime_type: string;  // "image/jpeg" | "image/png" | "image/webp" | "image/gif"
}>;
```

**Limits:**
- Max 3 images per request
- Max 1MB decoded size per image (client resizes before encoding)
- Client intake can accept files up to 5MB each before resize (match existing `ImageUpload` UX)
- Accepted mimes: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

### 3.2 Response Extension

```typescript
// Addition to existing InterpretEventDraftResponse
extraction_metadata?: {
  images_processed: number;
  confidence: number;          // 0-1, aggregate across all images
  extracted_fields: string[];  // e.g., ["event_date", "start_time", "title", "venue_name"]
  warnings: string[];          // e.g., ["Could not determine end time"]
};
```

### 3.3 Behavior Contract

1. If `image_inputs` are provided and extraction confidence is below 0.5, the system MUST return `next_action: "ask_clarification"` with a targeted question about the low-confidence fields.
2. Image extraction results are advisory — they feed into the same structured interpretation that validates and sanitizes all output.
3. `cover_image_url` is NEVER set by the interpreter from image data. The interpreter extracts *text* from images. Cover assignment is a separate client-side decision.
4. Image data is NEVER logged, stored, or forwarded beyond the OpenAI API call. Only `extraction_metadata` (count, confidence, field names) is logged.

---

## 4. Interpreter Lab UI Changes

### 4.1 New Controls

1. **Image staging area** — Drop zone + file picker below the message textarea. Shows thumbnail previews with remove buttons. Max 3 images.
2. **Clipboard paste handler** — `onPaste` on the page container detects `image/*` items in `clipboardData` and stages them as `File` objects.
3. **Client-side resize** — Canvas API resizes to max 1200px wide, JPEG 0.8 quality, before base64 encoding.
4. **Conversation history** — Add `conversationHistory` state and wire it into requests so multi-turn clarification loops work.

### 4.2 What Does NOT Change

- Lab remains hidden/unlinked (same visibility model)
- Raw response display stays (dev harness)
- Mode selector and eventId/dateKey inputs unchanged

### 4.3 Component Strategy

The `ImageUpload` component is designed for interactive crop-then-upload flows — wrong tool for a chat staging area where you just need thumbnails with remove buttons. Recommended approach:

- **Chat staging area**: New lightweight component (thumbnail grid + drag/drop + paste + remove). No crop modal.
- **Cover assignment on confirm**: Reuse `ImageUpload` or the extracted `uploadCoverForEvent()` helper for the actual cover upload after event creation/edit.

---

## 5. Security and Observability

### 5.1 What Is Logged

```
{
  user_id: "...",
  mode: "create",
  image_count: 2,
  image_mimes: ["image/jpeg", "image/png"],
  image_sizes_kb: [312, 487],
  extraction_confidence: 0.82,
  extracted_fields: ["title", "event_date", "start_time"],
  next_action: "await_confirmation"
}
```

### 5.2 What Is NEVER Logged

- Base64 image data
- Image URLs or signed URLs
- Raw extracted text (may contain PII from flyers)
- Full LLM prompt/response (existing redaction applies)

### 5.3 Payload Guardrails

- Request body size check before JSON parsing — return `413` if over 4MB
- Per-image decoded size validation — reject if any single image exceeds 1MB after base64 decode
- Image count validation — reject if more than 3 images
- Mime type validation — reject if not in allowlist

### 5.4 Auth and Rate Limiting

Unchanged. Existing session auth + 30/15min rate limit applies. Image requests count the same as text requests against the rate limit.

---

## 6. Critique Checklist

### 6.1 Assumptions (Explicit)

1. **OpenAI vision API is available on the configured model** — `gpt-5.2` supports vision input. If model changes, vision capability must be verified.
2. **Client-side resize produces sufficient quality for OCR** — 1200px JPEG at 0.8 quality is readable for event flyers. Highly stylized or low-contrast designs may fail.
3. **Base64 payload stays within Vercel limits** — 3 images at ~500KB each = ~2MB base64 + JSON overhead = ~2.5MB total, well under 4.5MB limit. Edge case: 3 images near 1MB decoded each = ~4MB base64+JSON, which is why server guardrail caps request body at 4MB.
4. **Two LLM calls fit within route timeout** — The interpreter route must explicitly set `export const maxDuration = 60;` for this phase. Two 15s calls + overhead targets ~35s total.
5. **Users will primarily upload event flyers/posters** — Not photos of handwritten notes, screenshots of social media, or multi-page PDFs. Extraction prompt is tuned for event marketing materials.

### 6.2 Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **Large pasted images exceed Vercel body limit** — A raw screenshot paste could be 5-10MB before resize. If client-side resize fails or is bypassed, server gets an oversized payload. | Non-blocking | Client-side resize is mandatory before base64 encoding. Server-side 413 check is the safety net. |
| R2 | **Noisy OCR produces wrong draft fields** — Stylized fonts, overlapping text, or non-English content may extract garbage. User confirms a draft with wrong date/time. | Blocking | Extraction confidence scoring + mandatory `ask_clarification` when confidence < 0.5. Human summary explicitly states extracted values for user review. |
| R3 | **Timeout budget exceeded** — Vision extraction takes longer than 15s for complex images. Phase B never runs. | Non-blocking | If Phase A times out, return `ask_clarification` with "I couldn't read the image clearly — can you type the key details?" Falls back gracefully to text-only flow. |
| R4 | **PII on flyers leaks to LLM** — Event flyers may contain personal phone numbers, addresses, or email addresses. These get sent to OpenAI as image content. | Non-blocking | This is inherent to any vision API use. Existing privacy model already sends event data to OpenAI. Flyer content is public marketing material by nature. Extracted text is not logged. |
| R5 | **Base64 encoding increases API costs** — Image tokens are expensive. 3 images per request at ~500KB each could cost 5-10x a text-only request. | Non-blocking | Rate limit already caps at 30 requests/15min. Monitor cost per image-bearing request. Add separate cost tracking in logs. |
| R6 | **Create-mode cover file lost on page navigation** — `pendingCoverFile` is React state. If user navigates away before confirming, the staged file is lost. | Non-blocking | This is the same limitation as the current EventForm create-mode flow. Documented, not new. |
| R7 | **`uploadCoverForEvent()` is not shared** — Duplicating this inline function for the interpreter confirmation flow creates divergence risk. | Non-blocking | Phase 1 should extract this into a shared helper before adding a second consumer. |

### 6.3 Coupling Map

| Layer | Impact |
|-------|--------|
| `interpretEventContract.ts` | Modified: new `image_inputs` field on request, new `extraction_metadata` on response |
| `interpret/route.ts` | Modified: image validation, Phase A vision call, Phase B context injection |
| Interpreter lab `page.tsx` | Modified: image staging UI, paste handler, conversationHistory support |
| `EventForm.tsx` | Refactor only: extract `uploadCoverForEvent()` into shared helper |
| `ImageUpload.tsx` | Unchanged |
| Storage policies | Unchanged |
| Database tables | Unchanged |
| RLS policies | Unchanged |
| Existing write APIs | Unchanged |

### 6.4 Reversibility

Fully additive. No schema changes, no migration, no storage policy changes.
- Remove `image_inputs` from contract → image support gone, text-only flow unaffected
- Remove Phase A call → route reverts to single-call architecture
- Remove lab UI additions → lab reverts to text-only harness

---

## 7. Phased Execution Plan

### Phase 0: Contract + scope update
- Update `interpretEventContract.ts` with `image_inputs` and `extraction_metadata` types
- Update CONTRACTS.md with image extraction behavior contract (Section 3.3 above)
- Update this stop-gate doc status to APPROVED

### Phase 1: Shared upload helper extraction
- Extract `uploadCoverForEvent()` from EventForm.tsx into `web/src/lib/events/uploadCoverForEvent.ts`
- Update EventForm.tsx to import from shared module
- Zero behavioral change — refactor only

### Phase 2: Interpreter lab UI image support
- Add image staging area (thumbnail grid + drop zone + file picker)
- Add clipboard paste handler
- Add client-side canvas resize + base64 encoding
- Add `conversationHistory` wiring
- Lab remains hidden/unlinked

### Phase 3: Vision extraction in interpreter route ✅ (2026-02-24)
- ✅ `export const maxDuration = 60` for Vercel function timeout
- ✅ Content-Length body size guard (4MB cap) before JSON parse
- ✅ `validateImageInputs()` call with typed 400/413 error responses
- ✅ Phase A vision extraction call (same configured interpreter model, default `gpt-5.2`; 15s timeout, graceful fallback)
- ✅ Extracted text fed into Phase B `buildUserPrompt` as `extracted_image_text`
- ✅ `extraction_metadata` returned in response (images_processed, confidence, extracted_fields, warnings)
- ✅ `cover_image_url` added to event context query + `pickCurrentEventContext`
- ✅ Structured logging (Phase A start/complete/fallback, extraction fields, confidence)
- ✅ 8 unit tests for `validateImageInputs` + 10 route source-code assertion tests (24 total pass)

### Phase 4A: Edit-mode cover apply ✅ (2026-02-24)
- ✅ `LAB_WRITES_ENABLED` client feature flag gating (`NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES`)
- ✅ Cover candidate click-to-select UX (ring + badge on thumbnails, single-select)
- ✅ `canShowCoverControls` derived: flag + edit mode + valid eventId + staged images
- ✅ `base64ToJpegFile()` helper: base64 → Uint8Array → File with .jpg extension
- ✅ `applyCover()` handler: session check → fresh event fetch → base64→File → `uploadCoverForEvent` → update `cover_image_url` → `softDeleteCoverImageRow` old cover
- ✅ "Apply as Cover" button (separate from Run Interpreter, emerald green, double-submit guard)
- ✅ Cover status message feedback (success/error)
- ✅ clearHistory resets cover state
- ✅ 25 source-code assertion tests for Phase 4A (write gating, candidate UX, handler flow, helper, behavior preservation)
- ✅ All 50 tests pass (25 Phase 4A + 11 Phase 3 route + 14 contract)

### Phase 4B: Create-mode write + deferred cover ✅ (2026-02-24)
- ✅ `mapDraftToCreatePayload()` mapper: draft_payload → POST /api/my-events body
  - Validates required fields: `title`, `event_type` (non-empty array), `start_time`, `start_date`
  - Location resolution: `venue_id` → venue path, `custom_location_name` → custom path, `online_url` → online path, else returns mapper error
  - Passes through compatible optional fields; defaults `series_mode` to `"single"`
- ✅ `CREATABLE_NEXT_ACTIONS` gate: only `show_preview`, `await_confirmation`, `done` — blocks `ask_clarification`
- ✅ `canShowCreateAction` derived: `LAB_WRITES_ENABLED && mode === "create" && lastInterpretResponse && next_action in allowed set`
- ✅ `lastInterpretResponse` state: tracks latest successful interpreter `next_action` + `draft_payload`
- ✅ `createEvent()` handler: mapper → POST /api/my-events → capture eventId → deferred cover upload
- ✅ Deferred cover: if `coverCandidateId` selected + eventId returned → `base64ToJpegFile` → `uploadCoverForEvent` → update `cover_image_url`
- ✅ Partial-failure cleanup: if upload succeeds but `cover_image_url` update fails, soft-delete uploaded image row
- ✅ Stale-draft protection: create draft state is cleared before each new create interpret request and when create inputs change
- ✅ Non-blocking cover failure: event remains created; warning message shown
- ✅ "Confirm & Create" button (blue, separate from Run Interpreter, double-submit guard)
- ✅ Three-tier create message: success (emerald), warning (amber), error (red)
- ✅ `canShowCoverControls` expanded: thumbnail click-to-select works in both edit and create modes
- ✅ "Apply as Cover" button restricted to edit mode only (`isEditMode` guard)
- ✅ clearHistory resets all 4A + 4B state
- ✅ 39 source-code assertion tests for Phase 4B (gating, mapper, create flow, deferred cover, message UX, 4A regression)
- ✅ All 89 tests pass (39 Phase 4B + 25 Phase 4A + 11 Phase 3 route + 14 contract)

**Known limitations:**
- No rollback of event creation if deferred cover upload fails (by design per prompt)

### Phase 5: Server-side venue resolution ✅ (2026-02-25)
- ✅ Pure resolver module: `venueResolver.ts` — deterministic post-LLM venue matching
  - Scoring: exact match (1.0), slug match (0.95), token Jaccard with first-token boost
  - Thresholds: RESOLVE (≥0.80), AMBIGUOUS (0.40–0.79), TIE_GAP (<0.05 between top 2 → ambiguous)
  - Discriminated union outcomes: `resolved`, `ambiguous`, `unresolved`, `online_explicit`, `custom_location`
- ✅ Resolver wired into interpret route post-LLM with explicit gating
  - `create`: always runs venue resolution
  - `edit_series`: runs only on location-intent messages or when draft contains concrete location signals
  - `edit_occurrence`: does not run venue resolution
  - Resolved → injects `venue_id` + `venue_name` into sanitizedDraft, sets `location_mode: "venue"`
  - Ambiguous → escalates to `ask_clarification` with numbered candidate list (max 3)
  - Unresolved → escalates to `ask_clarification` asking for venue name (or `online_url` when mode is online)
  - Online/custom → no changes (preserves user intent)
  - Only escalates, never downgrades existing LLM clarification
- ✅ Venue catalog query expanded: `.select("id, name, slug")` — slug used server-side only, stripped from LLM prompt
- ✅ System prompt updated: LLM instructed to output `venue_name` with best guess when `venue_id` uncertain
- ✅ `venue_name` added to CREATE_PAYLOAD_ALLOWLIST and EDIT_SERIES_PAYLOAD_ALLOWLIST
- ✅ `venue_name` added to lab page `CREATE_PASSTHROUGH_OPTIONALS`
- ✅ Structured logging: `venueResolution { status, source, confidence, venueId, candidateCount, inputName }`
- ✅ 50 unit tests for venueResolver (scoring, normalization, thresholds, gating, edge cases)
- ✅ 30 route integration source-code assertion tests
- ✅ Targeted interpreter suite passes: 169 tests (50 venue-resolver + 30 route-integration + 39 Phase 4B + 25 Phase 4A + 11 Phase 3 + 14 contract)
- ✅ ESLint clean on all changed files

**Known v1 limitations:**
- Venues not in DB require manual addition or custom_location fallback
- Catalog size O(n) per request is negligible at ~200 entries

**Related follow-on track:** `docs/investigation/interpreter-phase7-admin-activity-alerts-stopgate.md` (ALERTS-01, APPROVED — production-verified)

### Phase 5 (prior): Tests + smoke
- ✅ Unit tests: `validateImageInputs` (8 tests covering all error paths)
- ✅ Route integration tests: source-code assertions for all Phase 3 requirements (11 tests)
- ✅ Lab cover-apply tests: source-code assertions for Phase 4A (25 tests)
- ✅ Lab create-write tests: source-code assertions for Phase 4B (39 tests)
- ✅ Smoke checklist entry in `docs/SMOKE-PROD.md`

**Checkpoint:** Phases 0-6 implemented and production-verified. Open a new stop-gate for any further scope.

### Post-Launch Hardening Patch ✅ (2026-02-27)
- ✅ Create mapper hardening in interpreter lab:
  - Normalizes user-entered `start_date` (supports `MM/DD/YY` -> `YYYY-MM-DD`)
  - Drops Google Maps short links from `external_url` (maps links treated as location hints, not event websites)
  - Requires explicit user intent before preserving `has_timeslots=true` (prevents accidental performer slots)
  - Auto-selects first staged image as cover candidate in create mode when user has staged images
  - Normalizes `signup_mode` into DB-safe enum values (`walk_in|in_person|online|both|null`) to prevent create/update constraint failures
  - Adds post-create navigation links: "Open Draft" and "Go to My Happenings (Drafts tab)"
- ✅ Optional venue directory promotion:
  - When user explicitly asks for "new venue/create venue/add venue", lab attempts `POST /api/admin/venues`
  - On success, create payload is rewritten from custom-location fields to canonical `venue_id` path
  - On failure, flow falls back to custom location and surfaces a warning (non-blocking)
- ✅ Interpreter location hint hardening:
  - Address extraction now ignores noisy flyer/social text lines (e.g., "Event by", "Public", "RSVP")
  - Geocoded address from Maps coordinates is preferred over free-text extraction when both are available
- ✅ Recurrence hardening:
  - `parseOrdinalsFromRecurrenceRule()` now supports RRULE monthly ordinal variants:
    - `FREQ=MONTHLY;BYDAY=4TU`
    - `FREQ=MONTHLY;BYDAY=TU;BYSETPOS=4`
    - `FREQ=MONTHLY;BYSETPOS=-1;BYDAY=TU`
  - Prevents monthly series UI fallback to "1st week" on edit
- ✅ Test coverage additions:
  - New recurrence ordinal parser tests
  - New signup mode contract tests and API route guard assertions
  - Updated lab create-write assertions for hardening behavior
  - Updated interpreter location-hints assertions for noisy-address filtering and geocode precedence

---

## 8. Approval Gates

| # | Decision | Recommended | Rationale |
|---|----------|-------------|-----------|
| 1 | Create-mode cover behavior | Pending cover candidate (not persisted until publish) | Matches existing EventForm deferred-upload pattern; no new storage policies needed |
| 2 | Image transport for extraction | Base64 in request body (client-side resized) | No new infrastructure; Vercel payload limits are sufficient; no staging cleanup needed |
| 3 | Max limits | 3 images, 5MB intake each raw, server-enforced 1MB decoded each, 4MB request cap | Aligns with existing upload UX while keeping interpreter payload safely under Vercel limits |
| 4 | Scope expansion approval | Explicit override of parent doc Section 4.7 | Parent stop-gate deferred image support; this doc provides the investigation for that deferred scope |

---

**STOP: Interpreter tract is complete through Phase 6. Follow-on alert hardening is tracked separately in ALERTS-01.**
