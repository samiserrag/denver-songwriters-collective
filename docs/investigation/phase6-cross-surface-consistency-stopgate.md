# STOP-GATE Investigation — Phase 6: Cross-Surface Event Consistency & Mobile UX Cohesion

**Status:** INVESTIGATION ONLY (No implementation in this phase)  
**Date:** 2026-02-06  
**Owner:** Architect agent

---

## Scope Confirmation

This investigation covers only:
1. Homepage vs `/happenings` "Tonight" alignment
2. Mobile event card UX cohesion
3. Cross-surface consistency rules for event rendering

Explicitly out of scope for this tract:
- Email GTM-3.1 feature work (closed)
- Editorial tooling changes
- Monetization, AI, or performance tuning beyond UX correctness

---

## Surface Inventory (Exact Paths)

Primary discovery surfaces:
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx` (Homepage, "Tonight's Happenings")
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx` (`/happenings` timeline/series/map)
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx` (shared event card)
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/SeriesCard.tsx` (series surface card)
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/events/nextOccurrence.ts` (occurrence expansion/order/overrides)

Digest + preview surfaces (for consistency comparison only):
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/weeklyHappenings.ts`
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/templates/weeklyHappeningsDigest.ts`
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/api/admin/digest/preview/route.ts`
- `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/(protected)/dashboard/admin/email/page.tsx`

---

## Evidence (Code + DOM Notes)

### A) Homepage vs `/happenings` query logic is not aligned for "Tonight"

Evidence:
- Homepage "Tonight" base query pulls published events with statuses `active` + `needs_verification`, hard-limits rows to `EXPANSION_CAPS.MAX_EVENTS` before expansion, and does not fetch occurrence overrides:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx:97`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx:104`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx:105`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx:257`
- `/happenings` includes statuses `active` + `needs_verification` + `unverified`, fetches overrides, applies reschedules, and then filters timeline groups:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx:162`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx:166`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx:172`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx:383`

Impact:
- The same "tonight" concept can diverge across surfaces for status inclusion, cancelled occurrences, and rescheduled display behavior.

Classification:
- **Blocking**
- **UX correctness**

---

### B) Data-shape mismatch causes venue city/state loss on homepage cards

Evidence:
- Homepage query joins `venues!left(...)` (plural key in result object):  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/page.tsx:101`
- `/happenings` query aliases join to singular `venue:venues!left(...)`:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/happenings/page.tsx:159`
- `HappeningCard` reads city/state only from `event.venue` (singular):  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:282`
- Meta line prints `venueCityState` after venue name:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:808`

Impact:
- Homepage "Tonight" cards can show venue name without city/state while `/happenings` cards show city/state.
- This directly intersects the mobile issue ("city visibility") because the city can be absent before truncation even occurs.

Classification:
- **Blocking**
- **UX correctness**

---

### C) Mobile card metadata truncation can hide decision facts

DOM notes from `HappeningCard`:
- Title is clamped to two lines:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:792`
- Meta line (`time · venue, city · cost`) is single-line truncated:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:808`
- Chips are wrapped and variable height, increasing vertical competition with meta visibility:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:836`
- Poster aspect is `3:2` (shorter media area than historical 4:3 contract text):  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:663`

DOM notes from `SeriesCard`:
- Title is single-line clamped, venue row is truncated:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/SeriesCard.tsx:316`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/SeriesCard.tsx:329`

Impact:
- On narrow widths, city/state and cost are the first text likely to disappear, which conflicts with "decision facts" discoverability expectations.

Classification:
- **Blocking**
- **UX correctness**

---

### D) Digest/Admin preview uses intentionally different time contract

Evidence:
- Admin preview calls weekly digest data source:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/app/api/admin/digest/preview/route.ts:63`
- Weekly digest uses 7-day range (today to +6 days), active only, excludes cancelled and unconfident occurrences:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/weeklyHappenings.ts:88`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/weeklyHappenings.ts:155`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/weeklyHappenings.ts:250`  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/digest/weeklyHappenings.ts:253`

Impact:
- This divergence from homepage/"Tonight" is expected by product intent, but contract boundaries are undocumented in one place.

Classification:
- **Non-blocking**
- **UX correctness (contract clarity gap, not implementation bug)**

---

### E) Minor contract drift: missing-value style differs across surfaces

Evidence:
- `HappeningCard` venue fallback in meta line uses em dash (`—`) when venue missing:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/components/happenings/HappeningCard.tsx:830`
- Digest template omits unknown cost instead of explicit `NA` token:  
  `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web/src/lib/email/templates/weeklyHappeningsDigest.ts:97`

Impact:
- Inconsistent missing-data language reduces predictability across surfaces.

Classification:
- **Non-blocking**
- **Cosmetic-to-correctness boundary** (currently low severity)

---

## Query Differences Summary (Current State)

### Surface: Homepage "Tonight"
- Status filter: `active`, `needs_verification`
- Published required: yes
- Date window: computed after fetch via expansion (`today` only)
- Overrides/reschedules: not applied
- Cap behavior: pre-expansion event cap at 200
- Ordering: time sort after expansion

### Surface: `/happenings` (default upcoming, including tonight group)
- Status filter: `active`, `needs_verification`, `unverified`
- Published required: yes
- Date window: `today` to `today+90` (default)
- Overrides/reschedules: applied
- Cap behavior: expansion caps apply; no explicit pre-query 200-row clamp
- Ordering: date-group sort + start-time sort, with reschedule relocation

### Surface: Weekly digest + admin preview
- Status filter: `active` only
- Published required: yes
- Date window: weekly (`today` to `today+6`)
- Overrides/reschedules: cancelled removed; unconfident removed
- Ordering: by date then start time

---

## Blocking vs Non-Blocking Classification

### Blocking issues
1. "Tonight" logic divergence between homepage and `/happenings` (status + override/reschedule parity gap)
2. Venue join-shape mismatch causing city/state absence on homepage event cards
3. Mobile truncation behavior that can hide decision-critical metadata

### Non-blocking issues
1. Digest/admin preview contract differs by design but lacks one explicit cross-surface rule doc
2. Missing-data token style drift (`NA` vs omission/em dash) across surfaces

---

## UX Correctness vs Cosmetic Classification

### UX correctness
1. Cross-surface mismatch in what counts as "tonight"
2. Missing city/state on homepage due data shape mismatch
3. Mobile metadata visibility risk
4. Undocumented allowed divergence between discovery surfaces and digest surfaces

### Cosmetic
1. Mixed missing-value presentation style in secondary metadata
2. Minor visual contract drift artifacts (not primary functional blockers)

---

## Risks of Unifying Logic

If we unify all surfaces too aggressively, risks include:
1. Breaking intentional differences (weekly digest semantics vs "tonight now" semantics)
2. Regressing GTM-3.1 closed behavior by coupling digest decisions back into discovery views
3. Increasing query cost on homepage if full `/happenings` pipeline (overrides, map/location machinery) is copied without guardrails
4. Accidentally changing trust-state visibility policy (especially around `unverified`)

---

## Do-Nothing Alternative (Explicit)

If we do nothing:
1. Users will continue to see non-deterministic differences between homepage "Tonight" and `/happenings` today results
2. Mobile users will continue to lose location/cost clarity in constrained card layouts
3. Regression detection remains weak because consistency rules are implicit, not contractual
4. Future fixes may continue patch-by-surface instead of systemically

This is viable only if inconsistency is accepted as intentional product behavior. Current docs/backlog indicate it is not.

---

## Proposed Approval Gate for Execution Phase (No changes yet)

Execution phase should begin only after approval on:
1. Canonical definition of "Tonight's events" (status set, override policy, reschedule policy, cap policy)
2. Required event-card fields on mobile minimum display (must never truncate silently vs may truncate)
3. Allowed vs forbidden cross-surface differences (Homepage, `/happenings`, digest, admin preview)

Checked against DSC UX Principles:
- §4 Centralize Logic, Never Rebuild It
- §5 Previews Must Match Reality
- §10 Defaults Should Match the Common Case
- §14 If Something Feels Confusing, It Probably Is

Checked against Product North Star:
- §6.4 Decision Facts (Always Visible)
- §6.7 Temporal Emphasis

---

## STOP

**STOP — awaiting approval**
