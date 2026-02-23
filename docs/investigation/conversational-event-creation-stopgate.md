# Investigation: Conversational Event Creation + Natural Language Editing

**Stop-Gate Phase:** A/B (Investigate + Critique)
**Date:** 2026-02-22
**Status:** AWAITING APPROVAL — No code changes authorized

---

## 1. Current Create/Edit Pipeline Evidence

### 1.1 Event Creation — `POST /api/my-events`

**File:** `web/src/app/api/my-events/route.ts`

**Write path (lines 235-594):**
1. Auth check via `supabase.auth.getUser()` (line 237)
2. Host/admin status check via `checkHostStatus()` (line 244) — gates CSC branding, not creation
3. Body parsing + `normalizeIncomingEventTypes()` (line 256) — normalizes `event_type` array, maps `kindred_group` -> `other`
4. Media embed validation (admin-only, lines 262-285)
5. Required field validation: `title`, `event_type`, `start_time` (lines 288-298)
6. `event_type` array validation against `VALID_EVENT_TYPES` Set (lines 301-313)
7. Online URL validation for online/hybrid (lines 316-321)
8. Location mutual exclusivity: exactly one of `venue_id` OR `custom_location_name` (lines 329-336)
9. Venue lookup if venue selected (lines 352-366)
10. Series mode handling: `single`, `weekly`, `biweekly`, `monthly`, `custom` (lines 391-438)
11. Unified insert via `buildEventInsert()` (lines 143-232, called at 462) — sets `host_id`, canonicalizes `day_of_week`, sets all fields
12. Supabase `.insert()` + `.select().single()` (lines 482-486)
13. Host assignment via `event_hosts` insert (lines 505-518)
14. Media embed upsert (lines 521-532)
15. Timeslot generation for recurring events (lines 536-583)

**Key invariant:** `host_id` MUST equal `auth.uid()` per RLS policy `host_manage_own_events` (line 162 comment).

### 1.2 Event Edit — `PATCH /api/my-events/[id]`

**File:** `web/src/app/api/my-events/[id]/route.ts`

**Write path (lines 262-847):**
1. Auth + `canManageEvent()` check (lines 266-277) — admin OR `events.host_id` OR accepted `event_hosts`
2. Visibility edit restricted to owner/primary host/admin via `canEditEventVisibility()` (lines 291-303)
3. Legacy status normalization (lines 307-309)
4. Allowed-fields whitelist (lines 329-350) — 40+ fields explicitly listed
5. Media embed admin-only gate (lines 352-379)
6. Update payload construction with field-by-field validation (lines 382-412)
7. Custom dates validation and canonicalization (lines 415-435)
8. Location mutual exclusivity enforcement (lines 438-483)
9. Admin inline verification (lines 486-494)
10. `is_dsc_event` CSC branding gate (lines 497-505)
11. Major update tracking for notifications (lines 513-517)
12. Cancel/restore handling (lines 520-535)
13. Unpublish safety guard: blocked when active RSVPs/claims exist (lines 544-570)
14. Recurrence canonicalization for ordinal monthly rules (lines 572-583)
15. Publish transition auto-verification (lines 587-595)
16. Timeslot regeneration with future-claims blocking (lines 601-664)
17. Supabase `.update()` (lines 667-672)
18. Notification dispatch: update vs cancellation (lines 753-843)

### 1.3 Occurrence Override — `POST /api/my-events/[id]/overrides`

**File:** `web/src/app/api/my-events/[id]/overrides/route.ts`

**Write path (lines 169-475):**
1. Auth + `checkOverrideAuth()` (lines 173-184) — same pattern: admin OR owner OR accepted host
2. `date_key` validation (YYYY-MM-DD format, lines 191-198)
3. Legacy columns: `status`, `override_start_time`, `override_cover_image_url`, `override_notes` (lines 220-235)
4. `override_patch` JSONB sanitization via `ALLOWED_OVERRIDE_FIELDS` allowlist (lines 238-264)
5. Empty-override detection triggers delete instead of upsert (lines 267-287)
6. Upsert via `onConflict: "event_id,date_key"` (lines 289-292)
7. Media embed upsert for override scope (lines 299-310)
8. Notification dispatch: cancellation vs update (lines 320-471)

### 1.4 EventForm Component

**File:** `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx`

**Props interface (lines 167-242):** Supports three modes:
- `mode: "create"` — new event
- `mode: "edit"` — series-level edit
- `occurrenceMode: true` — per-occurrence override edit

**Used in:**
- `web/src/app/(protected)/dashboard/my-events/new/page.tsx` (create)
- `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx` (edit)
- `web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` (occurrence)

---

## 2. Recurrence + Override Architecture

### 2.1 Recurrence Model

**Single-row model:** Recurring events are ONE database row. Occurrences are computed at render time.

| Series Mode | `recurrence_rule` | Expansion |
|-------------|-------------------|-----------|
| `single` | null | `event_date` only |
| `weekly` | `"weekly"` | Every 7 days from `event_date` |
| `biweekly` | `"biweekly"` | Every 14 days from `event_date` |
| `monthly` | `"1st"`, `"2nd/3rd"`, RRULE `BYDAY=2TH` | Nth weekday of month |
| `custom` | `"custom"` | From `custom_dates[]` array |

**Expansion engine:** `web/src/lib/events/nextOccurrence.ts`
- `expandOccurrencesForEvent()` (line 568) — core expansion with window + caps
- `expandAndGroupEvents()` (line 1096) — groups by date, applies overrides
- `applyReschedulesToTimeline()` (line 1248) — post-processing for rescheduled occurrences

**Contract (CONTRACTS.md lines 754-788):** Anchor Date (First Event) is sole scheduling source of truth. `day_of_week` derived from anchor date. Day-of-week dropdown forbidden for recurring modes.

### 2.2 Override Model

**Table:** `occurrence_overrides` (migration `20260101200000`)
- Schema: `id`, `event_id`, `date_key`, `status`, `override_start_time`, `override_cover_image_url`, `override_notes`, `created_by`, timestamps
- Unique constraint: `(event_id, date_key)`
- RLS: Public read, admin-only write (insert/update/delete)

**JSONB patch column:** `override_patch` (migration `20260125000000`)
- Additive-only migration, NULL default
- GIN index for efficient queries
- Allowlisted fields only (23 fields in `ALLOWED_OVERRIDE_FIELDS`, defined in both `nextOccurrence.ts:955` and `overrides/route.ts:23`)

**Merge precedence (applyOccurrenceOverride, nextOccurrence.ts:996):**
1. Start with base event
2. Apply legacy columns (`override_start_time` -> `start_time`, etc.)
3. Overlay `override_patch` keys (allowlisted only)

### 2.3 Contract References

- **Occurrence Overrides contract:** CONTRACTS.md lines 961-1008
- **Event Type array model:** CONTRACTS.md lines 444-557 (EVENTS-TYPE-01)
- **Recurrence anchor-date rules:** CONTRACTS.md lines 754-788
- **Media upload create-mode constraint:** CONTRACTS.md lines 108-110 — cover upload deferred until after event creation

---

## 3. Explicit Mismatch Audit

### 3.1 "New overrides table" vs Existing Architecture

**Finding:** The existing repo already has:
- `occurrence_overrides` table (since migration `20260101200000`)
- `override_patch` JSONB column (since migration `20260125000000`)
- Full CRUD API at `/api/my-events/[id]/overrides` (GET/POST/DELETE)
- `applyOccurrenceOverride()` merge function
- `ALLOWED_OVERRIDE_FIELDS` allowlist (23 fields)
- Override pipeline integrated into all discovery surfaces (homepage, `/happenings`, detail pages)

**Implication for NL editing:** No new override table needed. The `override_patch` JSONB column already supports arbitrary field-level per-occurrence overrides. A conversational editing feature should produce patches that flow through the existing override API.

### 3.2 Duplicated Validation Logic

**Finding:** Key validation functions are duplicated rather than shared:

| Function | Locations |
|----------|-----------|
| `normalizeIncomingEventTypes()` | `route.ts:135`, `[id]/route.ts:92` |
| `VALID_EVENT_TYPES` | `route.ts:301`, `[id]/route.ts:14`, `eventValidation.ts:41`, `eventImportValidation.ts:44` |
| `canManageEvent()` | `[id]/route.ts:136`, `claims/route.ts:15` |
| `ALLOWED_OVERRIDE_FIELDS` | `nextOccurrence.ts:955`, `overrides/route.ts:23` |

**Risk for NL feature:** An interpreter endpoint must use the same validation. Duplicated validation means a new consumer could diverge. Consider extracting shared validators before adding a new write path.

### 3.3 Endpoint Naming/Flow Mismatches

| Concern | Current State | NL Feature Impact |
|---------|--------------|-------------------|
| Create endpoint | `POST /api/my-events` | NL interpreter must produce payload compatible with this exact endpoint |
| Edit endpoint | `PATCH /api/my-events/[id]` | Allowed-fields whitelist (40+ fields) must be respected |
| Override endpoint | `POST /api/my-events/[id]/overrides` | Date_key + override_patch format required |
| Series modes | Client sends `series_mode` + `start_date` | NL must distinguish single/weekly/biweekly/monthly/custom |
| Location modes | Mutual exclusivity: `venue_id` XOR `custom_location_name` | NL must enforce this constraint |
| Media embeds | Admin-only for `youtube_url`/`spotify_url` | NL should not attempt for non-admins |
| Cover image | Deferred upload in create mode (no eventId yet) | NL create cannot include image in first payload |

### 3.4 RLS Policy Constraints

**Critical:** `host_manage_own_events` RLS policy requires `host_id = auth.uid()`. The LLM interpreter cannot set `host_id` to a different user. All writes must go through authenticated API routes that set `host_id` from the session.

**Override RLS mismatch (BLOCKING):**
- `/api/my-events/[id]/overrides` uses `createSupabaseServerClient()` (session/anon client), not service-role.
- App-layer auth allows admin OR owner OR accepted host (`checkOverrideAuth()`).
- DB RLS for `occurrence_overrides` remains admin-only for INSERT/UPDATE/DELETE (migration `20260101200000_occurrence_overrides.sql` lines 73-106).

**Implication:** Non-admin host occurrence writes can fail at DB policy enforcement even after app-layer auth succeeds. This must be resolved before shipping NL occurrence edits.

**Decision fork required before implementation completes:**
1. Expand `occurrence_overrides` write policies to include owner/accepted host (migration + tests), OR
2. Scope occurrence NL edits to admin-only in v1 and enforce at API layer.

---

## 4. Feasible Target Architecture (Proposal Only)

### 4.1 Overview

```
User NL Input
    |
    v
POST /api/events/interpret  (NEW — draft-only, no DB writes)
    |
    v
Draft Payload (structured JSON matching existing API shape)
    |
    v
Client Preview (EventForm preview or summary card)
    |
    v
User Confirms / Edits
    |
    v
Existing Write Path:
  - POST /api/my-events (create)
  - PATCH /api/my-events/[id] (edit series)
  - POST /api/my-events/[id]/overrides (edit occurrence)
```

### 4.2 Interpreter Endpoint (`POST /api/events/interpret`)

**Purpose:** Translate natural language to structured event payload. Draft-only, no DB writes.

**Input:**
```typescript
{
  message: string;           // User's NL input
  context?: {
    mode: "create" | "edit_series" | "edit_occurrence";
    eventId?: string;        // For edit modes
    dateKey?: string;         // For occurrence edits
    currentEvent?: object;    // Current event state (for diffing)
  };
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}
```

**Output:**
```typescript
{
  draft: {
    targetEndpoint: "create" | "edit_series" | "edit_occurrence";
    payload: Record<string, unknown>;  // Matches existing API shape
    humanSummary: string;              // Plain-English description of changes
    fieldChanges?: Array<{ field: string; from?: unknown; to: unknown }>;
  };
  clarificationNeeded?: string;  // If input is ambiguous
  confidence: number;            // 0-1 confidence score
}
```

**Security constraints:**
- No DB credentials, auth tokens, email addresses, or passwords sent to model
- Only event field names, values, and venue names sent as context
- Model output is validated against same `VALID_EVENT_TYPES`, `ALLOWED_OVERRIDE_FIELDS`, etc.
- Server validates all model output before returning to client
- No direct model-to-DB writes — interpreter returns a draft, client submits through existing paths

**LLM context (safe to send):**
- Event type options (from `EVENT_TYPE_CONFIG`)
- Recurrence mode options (`single`, `weekly`, `biweekly`, `monthly`, `custom`)
- Location mode options (`venue`, `online`, `hybrid`)
- Venue names list (public data, no addresses)
- Current event field values (for edit context)

**NOT sent to model:**
- User session tokens or auth data
- Database credentials
- Email addresses or personal info
- Internal API keys

### 4.3 Draft Session/State Handling

**Option A (Recommended): Stateless per-request**
- Each NL request produces a complete draft payload
- Client holds draft state in React state
- No server-side session storage needed
- Conversation history passed as input for multi-turn

**Option B: Server-side draft session**
- Redis/Supabase temp table stores draft state
- Enables multi-turn refinement without client passing full history
- More complex, requires TTL cleanup

Recommendation: Start with Option A. Multi-turn context can be handled client-side. Upgrade to Option B only if conversation history exceeds reasonable size.

### 4.4 Confirmation Flow

1. User enters NL text (e.g., "Create a weekly open mic at The Walnut Room every Tuesday at 7pm starting March 4")
2. Client calls `POST /api/events/interpret` with message + mode context
3. Interpreter returns structured draft + human summary
4. Client renders preview:
   - **Create mode:** Show `HappeningCard` preview (already exists in EventForm) with proposed values
   - **Edit mode:** Show diff view (field changes with before/after)
   - **Occurrence mode:** Show occurrence-specific changes
5. User can:
   - **Confirm** -> Client submits draft payload to existing API endpoint
   - **Edit** -> User modifies draft in EventForm (pre-populated with draft values)
   - **Refine** -> User sends follow-up NL message for corrections
   - **Cancel** -> Discard draft

### 4.5 NL Edit-to-Patch Mapping

| User Intent | Target Endpoint | Patch Shape |
|-------------|----------------|-------------|
| "Change the time to 8pm" | `PATCH /api/my-events/[id]` | `{ start_time: "20:00:00" }` |
| "Cancel next Tuesday's show" | `POST /api/my-events/[id]/overrides` | `{ date_key: "2026-03-03", status: "cancelled" }` |
| "Move this week to Thursday" | `POST /api/my-events/[id]/overrides` | `{ date_key: "...", override_patch: { event_date: "..." } }` |
| "Change venue to The Walnut Room" | `PATCH /api/my-events/[id]` | `{ venue_id: "...", custom_location_name: null }` |
| "Make it biweekly instead" | `PATCH /api/my-events/[id]` | `{ recurrence_rule: "biweekly" }` (series-level) |
| "Add blues to the event types" | `PATCH /api/my-events/[id]` | `{ event_type: [...currentTypes, "blues"] }` |

**Edit scope detection:** The interpreter must distinguish:
- **This occurrence only** -> override endpoint with `date_key`
- **All future occurrences** -> series-level PATCH (currently unsupported as a distinct operation — edits the whole series)
- **Entire series** -> series-level PATCH

Currently, the app has no "future-only" edit path (it's either occurrence-level or series-level). This is a product gap the NL feature should not try to solve — document it as out of scope.

### 4.6 Fallback to Manual Form

When the interpreter returns low confidence (<0.5) or `clarificationNeeded`:
1. Show the NL interpretation attempt with warning
2. Offer "Edit in form" button that opens EventForm pre-populated with best-effort values
3. Log the failure for model improvement

When the interpreter returns invalid field values (fails server-side validation):
1. Re-validate draft against same validators used by API routes
2. Strip invalid fields, show user which fields need manual entry
3. Pre-populate EventForm with valid fields only

### 4.7 Optional Image Extraction Stub

**Out of scope for Phase 1.** The interpreter should not attempt to extract or upload images. If the user mentions a flyer/poster:
1. Interpreter notes `cover_image_url` field in draft as `null`
2. Human summary says "You can add a cover image after creating the event"
3. After confirmation + create, redirect to edit page where image upload is available

Future phase: Accept image URL in NL input, validate it's reachable, pass to existing upload flow.

---

## 5. Critique Checklist

### 5.1 Assumptions (Explicit)

1. **LLM API is available** — The interpreter endpoint requires an LLM API call (Anthropic/OpenAI). Cost and latency per request are acceptable for the user base size.
2. **Venue matching is fuzzy** — Users will say "Walnut Room" not the exact DB name. Interpreter needs a venue name -> venue_id resolution step (could be string similarity against venue list).
3. **Time parsing is unambiguous** — "7pm" -> `19:00:00` is straightforward, but "evening" is ambiguous. The interpreter must handle timezone (Denver) explicitly.
4. **Users understand the draft-confirm flow** — The two-step (interpret -> confirm) UX adds friction vs direct form entry. Value proposition: faster for experienced users, not necessarily for first-time creators.
5. **Single-turn is sufficient for MVP** — Most event creation can be expressed in one sentence. Multi-turn refinement is nice-to-have.
6. **Model output is non-deterministic** — Same input may produce different drafts. The server-side validation layer is the safety net.

### 5.2 Risks

| # | Risk | Severity | Category | Mitigation |
|---|------|----------|----------|------------|
| R1 | **Venue ID resolution failure** — LLM cannot map venue names to UUIDs without a lookup step. If venue doesn't exist, NL creates orphaned payload. | Blocking | Correctness | Interpreter must query venue list and do fuzzy match server-side, not rely on LLM to guess UUIDs. |
| R2 | **Recurrence mode misinterpretation** — "Every other Tuesday" could be parsed as weekly or biweekly. Wrong series_mode creates wrong recurrence pattern. | Blocking | Correctness | Include explicit recurrence mode options in LLM prompt. Require user confirmation with human-readable summary showing "Every 2 weeks on Tuesday". |
| R3 | **Override vs series edit ambiguity** — "Change the time to 8pm" is ambiguous: this occurrence or all? If NL defaults to series-level, user may unintentionally change all future occurrences. | Blocking | Correctness | Default to clarification when editing recurring events. Require explicit scope ("just this week" vs "every week"). |
| R4 | **LLM cost scaling** — Each NL interpretation requires an API call. At scale, costs could exceed event creation value. | Non-blocking | Ops | Rate limit per user. Cache common patterns. Use smaller/faster model for simple requests. |
| R5 | **PII leakage to LLM** — If current event data includes host notes with personal info, sending as context leaks PII. | Non-blocking | Security | Strip `host_notes`, `description` from LLM context. Only send structural fields (type, time, venue, recurrence). |
| R6 | **Validation divergence** — If NL interpreter produces payloads that pass its own validation but fail the actual API endpoint validation, users get confusing errors after confirmation. | Non-blocking | Correctness | Share validation logic: extract `VALID_EVENT_TYPES`, field validators into shared module used by both interpreter and API routes. |
| R7 | **Location mode mutual exclusivity** — LLM might set both `venue_id` and `custom_location_name`. API will reject. | Non-blocking | Correctness | Post-process LLM output: if `venue_id` is set, null out all `custom_*` fields. Mirror logic from `buildEventInsert()`. |

### 5.3 Coupling Map

| Layer | Components Affected |
|-------|-------------------|
| **API routes** | New: `/api/events/interpret`. Existing unchanged: `/api/my-events`, `/api/my-events/[id]`, `/api/my-events/[id]/overrides` |
| **Database tables** | No new tables. Existing: `events`, `occurrence_overrides`, `event_hosts`, `venues` (read-only for name lookup) |
| **RLS policies** | No changes. All writes go through existing authenticated routes. |
| **UI components** | New: NL input component (chat-style or text box). Modified: EventForm (accept pre-populated draft). Existing: HappeningCard preview. |
| **Validation** | Should extract shared: `normalizeIncomingEventTypes`, `VALID_EVENT_TYPES`, `ALLOWED_OVERRIDE_FIELDS`, `buildEventInsert` field mapping. |
| **Notifications** | No changes. Existing notification dispatch in PATCH/override routes handles all cases. |
| **Tests** | New: interpreter unit tests (NL -> payload mapping), integration tests (interpreter -> API round-trip). Existing tests unchanged. |
| **External deps** | New: LLM API client (Anthropic SDK or similar). Env var for API key. |

### 5.4 Migration Needs + Reversibility

**Database migrations:** None required. All existing tables/columns support the feature.

**New code:**
- `/api/events/interpret` route (new file)
- NL input UI component (new file)
- Shared validation module extraction (refactor, not behavioral change)
- LLM client wrapper (new file)

**Reversibility:** Feature is fully additive.
- No schema changes = no migration rollback needed
- Interpreter endpoint can be removed without affecting any existing functionality
- UI component can be feature-flagged or removed
- Existing create/edit flows are completely untouched

### 5.5 Rollback Strategy

1. **Feature flag:** Gate NL input UI behind `NEXT_PUBLIC_ENABLE_NL_EVENTS=true` env var
2. **Endpoint removal:** Delete `/api/events/interpret` route — zero downstream impact
3. **UI removal:** Remove NL input component from dashboard — EventForm continues working as-is
4. **No data cleanup:** No new tables or columns to drop

### 5.6 Test Plan

**Unit tests:**
- NL -> structured payload mapping (mock LLM responses)
- Venue name fuzzy matching accuracy
- Recurrence mode detection ("every Tuesday" -> weekly, "every other" -> biweekly, "first and third" -> monthly ordinal)
- Time parsing (12h/24h, timezone normalization)
- `event_type` array extraction from NL descriptions
- Override vs series edit scope detection
- Invalid output handling (missing required fields, invalid types)

**Integration tests:**
- Interpreter -> existing API round-trip: create event via NL, verify DB state matches expectations
- Edit via NL: modify event fields, verify PATCH payload matches allowed-fields whitelist
- Override via NL: cancel specific occurrence, verify override row created
- Permission enforcement: non-host user cannot edit via NL (API rejects)
- Rate limiting: verify per-user limits on interpreter calls

**Contract tests:**
- Interpreter output always passes `VALID_EVENT_TYPES` validation
- Interpreter output for overrides only uses `ALLOWED_OVERRIDE_FIELDS`
- Location mutual exclusivity enforced in interpreter output
- `host_id` never appears in interpreter output (set by API route)
- Media embed fields excluded for non-admin context

---

## 6. Verification Command Results

### 6.1 Migration List

166 migrations, latest: `20260223010000_event_type_to_array.sql`. All show as local-only (remote state managed outside CLI). No pending/failed migrations.

### 6.2 DB Lint

Two non-blocking warnings:
- `rpc_admin_set_showcase_lineup`: shadowed variable `i`
- `generate_event_timeslots`: shadowed variable `v_slot_index`

Neither affects the conversational event creation feature.

### 6.3 Key Grep Results

| Pattern | File Count | Notable Finding |
|---------|-----------|-----------------|
| `occurrence_overrides` | 20+ files | Deeply integrated across all discovery surfaces, API routes, digest, types |
| `override_patch` | 16+ files | Used in EventForm, override pages, discovery pages, card components, map adapter |
| `VALID_EVENT_TYPES` | 4 locations | Duplicated — needs extraction for shared use |
| `canManageEvent` | 3 locations | Duplicated between `[id]/route.ts` and `claims/route.ts` |
| `normalizeIncomingEventTypes` | 2 locations | Duplicated between create and edit routes |

---

## 7. Summary + Stop-Gate Decision Point

**Feasibility assessment: GREEN** — The existing architecture strongly supports this feature:
- Single-row recurrence model means NL only needs to produce one payload shape
- `override_patch` JSONB already handles arbitrary per-occurrence field overrides
- Existing API routes handle all validation, RLS, notifications — NL just needs to produce valid payloads
- No schema changes required

**Primary risks requiring approval:**
1. LLM API dependency (cost, latency, vendor lock-in)
2. Validation duplication — recommend extracting shared validators first
3. Override-vs-series edit ambiguity in NL — needs explicit UX for scope selection

**STOP: Awaiting Sami approval before any implementation.**
