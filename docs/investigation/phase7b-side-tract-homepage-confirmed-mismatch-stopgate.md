# Phase 7B Side Tract — Homepage "Unconfirmed + Missing Details" vs Detail "Confirmed" (STOP-GATE)

**Status:** PENDING APPROVAL  
**Author:** Codex (Architect)  
**Date:** 2026-02-07  
**Scope:** Investigation only. No application code changes in this tract.

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

