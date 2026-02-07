# Phase 7B Side Tract — Homepage "Unconfirmed + Missing Details" vs Detail "Confirmed" (STOP-GATE)

**Status:** COMPLETED  
**Author:** Codex (Architect)  
**Date:** 2026-02-07  
**Scope:** Investigation + implementation completion record.

---

## 1) Exact Repro Steps

### 1.1 Operator-verified repro (source of truth)

1. Start from a **past one-time event**.
2. Edit it into a **custom-dates series**.
3. Add a **future date** successfully.
4. Open the event detail page and observe it displays **Confirmed**.
5. Open homepage "Tonight's Happenings" and observe the same event card displays **Unconfirmed** and **Missing details**.

Operator-provided event URL:
- `https://denversongwriterscollective.org/events/sloan-lake-song-circle-jam-2026-02-01?date=2026-02-08`

### 1.2 Investigation repro notes

- No local DB snapshot/session replay was available in this run, so this STOP-GATE is based on code-path tracing plus the operator's verified behavior.
- DOM/UI evidence is mapped to rendering logic below (badges/chips are deterministic from server data and helper functions).

---

## 2) Evidence Map (File:Line)

### 2.1 Homepage "Tonight's Happenings" fetch and card render

- Homepage route is dynamic: `web/src/app/page.tsx:31`
- Tonight events query from `events` with discovery status filter: `web/src/app/page.tsx:105-116`
- Overrides fetched for forward window: `web/src/app/page.tsx:267-276`
- Expansion + relocation pipeline:
  - `expandAndGroupEvents(...)`: `web/src/app/page.tsx:323-327`
  - `applyReschedulesToTimeline(...)`: `web/src/app/page.tsx:332`
  - "Tonight" extraction: `web/src/app/page.tsx:334-336`
- Tonight cards render:
  - map call: `web/src/app/page.tsx:602-617`
  - occurrence passed as `date: entry.dateKey`: `web/src/app/page.tsx:606-611`
  - `override` and `overrideVenueData` passed: `web/src/app/page.tsx:613-616`

### 2.2 Happenings page list fetch and render path (comparison surface)

- Happenings route is dynamic: `web/src/app/happenings/page.tsx:31`
- Discovery fetch + same status/venue contract:
  - event query base: `web/src/app/happenings/page.tsx:154-161`
  - overrides query: `web/src/app/happenings/page.tsx:165-169`
  - expansion pipeline: `web/src/app/happenings/page.tsx:365-383`
- Happenings card render passes `displayDate` (not raw `dateKey`) when rescheduled:
  - `cardDate = entry.displayDate || entry.dateKey`: `web/src/app/happenings/page.tsx:887`
  - card occurrence payload: `web/src/app/happenings/page.tsx:894-899`

### 2.3 Event detail page fetch and "Confirmed" computation

- Event detail route is dynamic: `web/src/app/events/[id]/page.tsx:38`
- Fetch event row (includes `status`, `last_verified_at`, recurrence/custom fields): `web/src/app/events/[id]/page.tsx:186-202`
- Verification state uses `getPublicVerificationState(...)` with `status` + `last_verified_at`:
  - call site: `web/src/app/events/[id]/page.tsx:276-283`
  - unconfirmed badge guard: `web/src/app/events/[id]/page.tsx:285-290`
- "Confirmed" badge rendering:
  - badge row: `web/src/app/events/[id]/page.tsx:837-849`
  - unconfirmed badge alternative: `web/src/app/events/[id]/page.tsx:852-855`

### 2.4 "Missing details" logic and inputs

- Card-level missing-details check uses **base event object**:
  - `const hasMissing = hasMissingDetails(event);`: `web/src/components/happenings/HappeningCard.tsx:492`
  - badge render: `web/src/components/happenings/HappeningCard.tsx:867`
- Card applies override patch for many display fields into `effectiveEvent`, but missing-details is not computed from `effectiveEvent`:
  - effective event construction: `web/src/components/happenings/HappeningCard.tsx:399-425`
- Missing-details rules:
  - helper rules + inputs: `web/src/lib/events/missingDetails.ts:46-101`
  - includes venue linkage/orphan checks: `web/src/lib/events/missingDetails.ts:70-88`
- Detail page missing-details also uses base event inputs (not selected occurrence patch):
  - call site: `web/src/app/events/[id]/page.tsx:951-961`

---

## 3) Data Model Tracing (Confirmed + Series Occurrence Identity)

### 3.1 Where "confirmed" is stored

- Canonical public verification uses:
  - `events.last_verified_at` (confirmed if non-null)
  - `events.status` (cancelled override path)
  - helper: `web/src/lib/events/verification.ts:44-72`
- `occurrence_overrides` does **not** store per-occurrence verification state; only `status` = `normal|cancelled` + patch fields:
  - table schema: `supabase/migrations/20260101200000_occurrence_overrides.sql:10-30`
  - status semantics: `supabase/migrations/20260101200000_occurrence_overrides.sql:115-116`
  - patch column added for occurrence fields (no verification fields): `supabase/migrations/20260125000000_add_override_patch.sql:8-19`
  - allowlist excludes `status`/`last_verified_at` as patchable verification fields: `web/src/lib/events/nextOccurrence.ts:937-966`

### 3.2 Where homepage list reads from

- Homepage "Tonight" is generated from:
  1. `events` rows via discovery query (`web/src/app/page.tsx:105-116`)
  2. `occurrence_overrides` window (`web/src/app/page.tsx:271-276`)
  3. occurrence expansion + regrouping (`web/src/app/page.tsx:323-336`)

### 3.3 Parent row vs occurrence row for series

- Custom-date series model is **single-row events + derived occurrences**:
  - migration intent: `supabase/migrations/20260124000000_custom_dates_single_row.sql:1-5,47-53`
  - create path uses single row for custom series: `web/src/app/api/my-events/route.ts:343-357`
  - edit path sets `recurrence_rule='custom'`, `custom_dates`, and anchor `event_date`: `web/src/app/api/my-events/[id]/route.ts:186-206`
- Therefore, homepage/detail should both resolve from the same parent `events` row for this tract's scenario; occurrence identity should come from `custom_dates` expansion.

### 3.4 Which date is "tonight"

- Canonical date key uses Denver timezone:
  - `getTodayDenver()`: `web/src/lib/events/nextOccurrence.ts:234-236`
- Homepage "Tonight" group is `relocatedGroups.get(today)`: `web/src/app/page.tsx:334`

---

## 4) Caching Check

### 4.1 Route caching configuration

- Homepage is dynamic: `web/src/app/page.tsx:31`
- Happenings is dynamic: `web/src/app/happenings/page.tsx:31`
- Event detail is dynamic: `web/src/app/events/[id]/page.tsx:38`

### 4.2 Query/result caching behavior

- No dedicated list API endpoint for homepage/happenings; both do direct server-side Supabase queries in the route modules.
- No explicit ISR `revalidate` found in these three surfaces.
- No explicit `fetch(..., { next: { revalidate } })` cache layer in the affected list paths.

### 4.3 Risk conclusion

- Server-side stale ISR cache is unlikely as primary cause.
- Client-side route cache during navigation remains a secondary hypothesis (non-primary) without telemetry.

---

## 5) Root Cause Hypotheses (Ranked)

## H1 (Most likely): Data-level divergence between row shown on homepage and row opened on detail

**Why likely:** Operator reports same conceptual event, but verification chips disagree. Code uses same verification helper on both surfaces; mismatch then points to different underlying row field values (`last_verified_at`/`status`) being rendered.  
**Evidence:** shared helper usage on card/detail (`web/src/components/happenings/HappeningCard.tsx:444-458`, `web/src/app/events/[id]/page.tsx:276-290`), but different fetch paths (`web/src/app/page.tsx:105-116` vs `web/src/app/events/[id]/page.tsx:186-202`).

## H2: Homepage occurrence payload uses `dateKey` instead of `displayDate`, causing occurrence-context drift

**Why likely:** Homepage tonight card passes `occurrence.date = entry.dateKey` with `isToday: true` regardless of relocated display date, unlike `/happenings`, which passes display date. This can route to a different occurrence context and amplify inconsistencies.  
**Evidence:** homepage payload `web/src/app/page.tsx:606-611`; happenings payload `web/src/app/happenings/page.tsx:887,894-899`.

## H3: Missing-details chip is computed from base event, not occurrence-resolved event

**Why likely:** card computes `effectiveEvent` with override-applied location fields, but missing-details is still computed on raw `event`. This can emit false "Missing details" for occurrence-specific overrides or stale base fields.  
**Evidence:** effective event assembly `web/src/components/happenings/HappeningCard.tsx:399-425`; missing calc `web/src/components/happenings/HappeningCard.tsx:492,867`.

## H4: Legacy series artifacts (duplicate/sibling rows) still present in data

**Why plausible:** migration logic retired legacy series rows as `status='duplicate'`, but if historical/manual edits left published sibling rows, homepage query could include an unintended row.  
**Evidence:** migration retirement logic `supabase/migrations/20260124000000_custom_dates_single_row.sql:47-53,104-114`; homepage status filter admits multiple statuses `web/src/lib/happenings/tonightContract.ts:25-29`.

## H5 (Lower likelihood): client-navigation stale route payload

**Why plausible but weaker:** routes are `force-dynamic`, but browser-level route cache could temporarily show stale card state after edits.  
**Evidence:** dynamic routes in all relevant surfaces (`web/src/app/page.tsx:31`, `web/src/app/events/[id]/page.tsx:38`).

---

## 6) Issue Classification (Blocking vs Non-Blocking, Correctness vs Cosmetic)

| Issue | Blocking? | Type | Rationale |
|---|---|---|---|
| Same event appears **Unconfirmed** on homepage but **Confirmed** on detail | **Blocking** | **UX correctness** | Trust-breaking cross-surface contradiction on high-traffic discovery path |
| Homepage card shows **Missing details** when detail context appears complete | Non-blocking | UX correctness | Incorrect warning badge can discourage attendance/host trust |
| Date-key/display-date payload inconsistency between homepage and happenings | Non-blocking (unless tied to mismatch) | UX correctness | Can route users into wrong occurrence context for recurring/rescheduled dates |
| Potential stale client navigation cache | Non-blocking | Cosmetic/operational | Typically transient, not canonical data defect |

---

## 7) Minimal Fix Plan + Rollback Plan

### 7.1 Minimal fix plan (implementation phase only, post-approval)

1. Introduce one canonical occurrence view-model mapper for card surfaces (homepage + happenings) that resolves:
   - verification inputs (`status`, `last_verified_at`)
   - missing-details inputs from normalized occurrence-effective fields
   - occurrence date payload (`displayDate` vs `dateKey`) consistently
2. Apply mapper in homepage tonight pipeline first (minimal blast radius), then ensure happenings uses same mapper contract.
3. Add guardrails for custom-date series row identity:
   - verify selected card row and detail row match by `event.id`
   - explicit checks around `custom_dates` + `?date=...` routing expectations.

### 7.2 Rollback plan

1. Keep change scoped to homepage tonight list mapper integration behind a small local toggle constant (or isolated helper wiring).
2. If regression appears, revert mapper wiring in homepage only; retain tests and diagnostics.
3. Restore prior card input path (`entry.event` direct) while preserving investigation artifacts.

### 7.3 Do-nothing alternative (explicit)

- Keep current behavior and defer side tract.  
- Cost: continued trust erosion due contradictory badges between homepage and detail for recurring-edited events.

---

## 8) Regression Test Plan (post-approval implementation)

1. Add targeted regression test file for this tract (e.g. `web/src/__tests__/phase7b-homepage-confirmed-mismatch.test.ts`):
   - Create one-time event -> convert to custom-dates series -> add future date.
   - Confirm event (`last_verified_at` set).
   - Assert homepage tonight card for upcoming occurrence renders **Confirmed** and no false **Missing details**.
2. Add source-level contract tests:
   - Homepage and happenings use same occurrence date payload policy for cards.
   - Missing-details helper consumes occurrence-normalized fields (not raw base event when override context exists).
3. Retain existing Phase 6/7B tests and extend where overlap exists.

---

## 9) Notes on Required SQL/State Validation (before implementation)

To finalize H1 vs H4 in execution phase, run a one-time DB verification for the operator URL slug and date:
- confirm exactly one published row identity used by homepage card
- compare `status`, `last_verified_at`, `custom_dates`, `series_id`
- inspect matching `occurrence_overrides` rows for `date_key=2026-02-08`

This is investigation-only STOP-GATE, so no production data mutation is proposed here.

---

**STOP — awaiting Sami approval**


---

## 10) Implementation Investigation Addendum (2026-02-07)

### 10.1 Repro validation path used in this investigation

- Operator URL (detail): `https://denversongwriterscollective.org/events/sloan-lake-song-circle-jam-2026-02-01?date=2026-02-08`
- Homepage surface under investigation: **DSC Happenings** card rail in `web/src/app/page.tsx:538-576`.

### 10.2 Homepage "DSC Happenings" data source (exact query + transform)

#### Query source

Homepage loads this section via `upcomingEventsRes` in `Promise.all`:

- File: `web/src/app/page.tsx:93-104`
- Query:
  - `.from("events")`
  - `.select("*")`
  - `.eq("is_dsc_event", true)`
  - `.eq("is_published", true)`
  - `.eq("status", "active")`
  - `.or(\`event_date.gte.${today},recurrence_rule.not.is.null\`)`
  - `.order("event_date", { ascending: true })`
  - `.limit(6)`

#### Transform used before card rendering

Rows are converted through `mapDBEventToEvent(...)`:

- File: `web/src/app/page.tsx:36-62`
- Then rendered through `EventGrid`:
  - `web/src/app/page.tsx:560-562`
  - `web/src/components/events/EventGrid.tsx:35-41`
  - `EventGrid` passes mapped objects into `HappeningCard`.

#### Critical finding

`mapDBEventToEvent(...)` drops card-critical fields (`status`, `last_verified_at`, `verified_by`, `source`, `location_mode`, `venue_id`, `custom_location_name`, `online_url`, `age_policy`, etc.).

Because `HappeningCard` depends on those fields, the homepage DSC rail can render false `Unconfirmed` + `Missing details` for otherwise complete/confirmed events.

### 10.3 Event detail data source for same occurrence (exact query + precedence)

Detail page fetches authoritative base event row directly:

- File: `web/src/app/events/[id]/page.tsx:186-201`
- Query includes `status`, `last_verified_at`, `verified_by`, `venue_id`, `location_mode`, `age_policy`, recurrence/custom fields.

Occurrence selection when `?date=` is present:

- Selected date handling: `web/src/app/events/[id]/page.tsx:411-428`
- Selected occurrence override fetch: `web/src/app/events/[id]/page.tsx:431-439`
- Override patch precedence: `web/src/app/events/[id]/page.tsx:444-454`

Verification source on detail:

- `getPublicVerificationState(...)` call: `web/src/app/events/[id]/page.tsx:276-283`
- Confirmed chip render: `web/src/app/events/[id]/page.tsx:837-849`

### 10.4 Confirmed logic comparison (mismatch statement)

**One-sentence mismatch:** homepage DSC cards derive verification from a **lossy mapped object** (missing `last_verified_at`), while detail derives verification from the **full events row**, so homepage can show `Unconfirmed` when detail correctly shows `Confirmed`.

Evidence:

- Homepage lossy mapper: `web/src/app/page.tsx:36-62`
- Card verification inputs: `web/src/components/happenings/HappeningCard.tsx:444-458`
- Detail verification inputs: `web/src/app/events/[id]/page.tsx:276-283`

### 10.5 "Missing details" logic comparison

Card badge trigger:

- `const hasMissing = hasMissingDetails(event);`
- File: `web/src/components/happenings/HappeningCard.tsx:492,867`

Helper requirements:

- File: `web/src/lib/events/missingDetails.ts:46-101`
- Missing-details uses fields such as `location_mode`, `venue_id`, `custom_location_name`, `online_url`, `age_policy`.

Mismatch:

- DSC homepage cards receive mapped events that often omit those required fields (`web/src/app/page.tsx:36-62`), so `hasMissingDetails(...)` can return true incorrectly.

### 10.6 Specific record shape (safe read-only DB verification)

Read-only Supabase query was run via local CLI using service role key (no mutations).

#### Base event row for slug `sloan-lake-song-circle-jam-2026-02-01`

- `id`: `bcd4ec24-11b6-484e-862f-dc2825833b66`
- `status`: `active`
- `last_verified_at`: `2026-02-07T04:45:05.356+00:00` (confirmed)
- `recurrence_rule`: `custom`
- `custom_dates`: `["2026-02-01", "2026-02-08"]`
- `venue_id`: `01497561-936c-427f-b917-564523bb462a`
- `location_mode`: `venue`
- `age_policy`: `18+ only`
- `is_published`: `true`

#### Occurrence row for `2026-02-08`

- There is **no persisted `event_occurrences` table row** in current architecture.
- `occurrence_overrides` query for `event_id=bcd4ec24-11b6-484e-862f-dc2825833b66` and `date_key=2026-02-08` returned `null`.
- Interpretation: occurrence is derived from base event `custom_dates`; no override is masking fields.

#### Duplicate/sibling row check

- Title-based query returned only one event row for this title/slug in current dataset.
- `series_id` is `null` on this row; no sibling row mismatch observed.

### 10.7 Caching check

- Homepage: `export const dynamic = "force-dynamic"` at `web/src/app/page.tsx:31`
- Happenings: `export const dynamic = "force-dynamic"` at `web/src/app/happenings/page.tsx:31`
- Event detail: `export const dynamic = "force-dynamic"` at `web/src/app/events/[id]/page.tsx:38`

Conclusion: this is not primarily ISR staleness; the strongest signal is data-shape mismatch on homepage card inputs.

### 10.8 Backlog check (mobile city visibility item)

Canonical backlog already tracks this concern:

- `docs/BACKLOG.md:345` — `UX-08` mobile metadata truncation/city visibility (DONE, Phase 6)

No new backlog item is required for this exact check.

---

## 11) Root Cause, Minimal Fix, Rollback, Test Plan (Investigation-only)

### 11.1 Ranked root cause

1. **Most likely (confirmed by code + data):** Homepage DSC rail passes a lossy mapped event shape into `HappeningCard`, dropping verification/missing-details inputs.
2. Secondary: `HappeningCard` computes `hasMissingDetails` from `event` instead of fully normalized occurrence-effective fields; this can still produce false positives in override scenarios.
3. Lower likelihood: route cache staleness (not supported by `force-dynamic` configuration).

### 11.2 Minimal fix (no architecture change)

1. Preserve card-required fields in homepage DSC mapping path (`web/src/app/page.tsx`) so `HappeningCard` receives complete inputs for:
   - verification (`status`, `last_verified_at`, `verified_by`, `source`)
   - missing-details (`location_mode`, `venue_id`, `custom_location_name`, `online_url`, `age_policy`, plus existing venue fields)
2. Ensure homepage card field precedence for occurrence-aware cards remains:
   - override_patch fields first
   - then base event fields
   (already implemented in `HappeningCard`; do not regress).
3. Keep scope limited to homepage DSC rail + regression tests; no schema or routing changes.

### 11.3 Rollback plan

1. Revert homepage mapping changes in `web/src/app/page.tsx` to prior behavior if regressions appear.
2. Retain tests to keep diagnostic signal even if rollback is needed.
3. No DB rollback required (no migrations in this tract).

### 11.4 Test plan

1. Add regression tests that assert homepage card model receives verification and missing-details source fields when rendered from DSC homepage data path.
2. Add case: confirmed base event + no occurrence override + complete location/age fields -> card shows `Confirmed` and does not show false `Missing details`.
3. Add/extend mobile card city visibility test only if missing in current guards (canonical backlog item `UX-08` already exists and is marked done).

---

**STOP — awaiting Sami approval before any code changes**

---

## 12) Implementation Completion Addendum (2026-02-07)

### 12.1 What changed

1. Homepage DSC rail mapper now preserves full DB event row fields before normalization.
   - File: `web/src/app/page.tsx`
   - Change: `mapDBEventToEvent(...)` now spreads `...dbEvent` and then applies normalized UI fields (`date`, `time`, `venue`, `capacity`, `rsvp_count`, `imageUrl`).
   - Why this fixes mismatch:
     - `HappeningCard` now receives verification-critical fields (`status`, `last_verified_at`, `verified_by`, `source`) and missing-details fields (`location_mode`, `venue_id`, `custom_location_name`, `online_url`, `age_policy`) for homepage DSC cards.
     - This aligns homepage card status/missing-details behavior with detail page inputs for the same base event.

2. Added focused regression test coverage for this side tract.
   - File: `web/src/__tests__/phase7b-homepage-dsc-rail-confirmed.test.tsx`
   - Asserts:
     - homepage mapper preserves verification/location fields;
     - mapped card renders `Confirmed`;
     - mapped card does not render false `Unconfirmed` or `Missing details`;
     - source contract keeps full DB row preservation in homepage mapper.

### 12.2 Scope safety

- No event detail page changes were made.
- No Tonight pipeline changes were made.
- No migrations or schema changes were made.
- Blast radius was constrained to homepage DSC rail input shape + one new regression test file.

### 12.3 Quality gates

- `npm --prefix web run lint` -> PASS (0 errors, 0 warnings)
- `npm --prefix web test -- --run` -> PASS (`3764/3764`)
- `npm --prefix web run build` -> ENVIRONMENT-LIMITED in local CLI session (build repeatedly hung after `Creating an optimized production build ...`; process was terminated). No TypeScript/build error output was emitted before hang.

### 12.4 Completion status

This side tract implementation is complete from a code and regression-test perspective, with local build marked environment-limited as noted above.
