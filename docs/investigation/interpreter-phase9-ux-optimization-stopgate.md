# Stop-Gate Track: Interpreter UX Optimization + Trust Metrics (INTERPRETER-10)

**Date:** 2026-03-01  
**Status:** IMPLEMENTED — AWAITING 7-DAY ROLLOUT DECISION
**Parent tract:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/investigation/interpreter-phase8-ux-launch-stopgate.md` (Phase 8 production-verified)

---

## 1) Goals and Context

Phase 8E shipped and passed production smoke. Conversational create is now host-facing behind feature flag with classic fallback.

The next tract is no longer launch plumbing; it is **trust optimization**:
- reduce friction versus classic form,
- improve deterministic interpretation quality in edge cases,
- measure actual production outcomes before considering broader/default rollout policy changes.

This tract is metrics-first: we should not rely on anecdotal runs as the only signal.

---

## 2) Scope Order (Approved Sequence)

### Phase 9A — Metrics Baseline + Guardrail Telemetry

Add/standardize observability for conversational create funnel:
- entrypoint impressions,
- AI route submissions,
- `next_action` distribution,
- create attempts,
- create successes/failures,
- fallback-to-classic clicks.

Rules:
1. No PII in logs.
2. No secret logging.
3. Keep existing Axiom log compatibility.

### Phase 9B — Content Reliability Hardening

Target deterministic fixes for known remaining friction:
1. Title extraction robustness for creative/non-keyword titles.
2. Time semantics handling (`doors` vs `performance start`) where signals are present.
3. Location normalization edge cases (venue/custom mutual exclusivity cleanup).

### Phase 9C — Clarification Turn Reduction

Reduce unnecessary turns while preserving safety:
1. Single-question clarity remains enforced.
2. Prevent re-asking already satisfied fields.
3. Prefer optional-field deferral over blocking when policy allows (example: optional end time).

### Phase 9D — UX Refinement (Host Confidence)

Host-facing polish to make conversational path beat classic form for common cases:
1. Human-friendly recurrence display (avoid raw RRULE in primary summary).
2. Clear completion/readiness state after each run.
3. Maintain strong fallback visibility to classic form.

### Phase 9E — Rollout Decision Gate (No Immediate Global Flip)

After metrics stabilize for at least 7 days:
1. Decide whether to keep current exposure, ramp, or reduce.
2. Classic form remains available in all scenarios for this tract.

---

## 3) Non-Goals

1. No removal of classic form.
2. No direct DB writes from `/api/events/interpret`.
3. No schema migration unless explicitly required by approved sub-step.
4. No changes to auth ownership model.

---

## 4) Risks and Coupling Critique

1. **Correctness regression risk (blocking):** UX changes can accidentally bypass interpreter hardening guards.
2. **Metric noise risk (non-blocking):** poor event naming in telemetry can produce misleading conclusions.
3. **Trust regression risk (blocking):** extra clarifications or ambiguous summaries push users back to classic form.
4. **Coupling surfaces:**
   - `/api/events/interpret` post-processing pipeline,
   - `/dashboard/my-events/new` and `/new/conversational` entrypoint UX,
   - `/api/my-events` create mapping,
   - Axiom queries and dashboards.

---

## 5) Acceptance Criteria

### 5.1 Quality + Safety

1. Existing safety-critical fixture set remains 100% passing.
2. No reintroduction of known blockers:
   - recurrence erasure across turns,
   - wrong venue substitution,
   - invalid `signup_mode` / `location_mode` DB failures.
3. No increase in interpreter 5xx/422 error rate vs Phase 8 baseline.

### 5.2 UX Outcomes (7-day production window)

1. Median clarification turns for successful create flows: **<= 2**.
2. P90 clarification turns: **<= 4**.
3. Conversational create completion (reaches successful draft create): **>= 90%** of create attempts that reach `show_preview/await_confirmation/done`.
4. Fallback usage tracked and explained (baseline + trend), not ignored.

### 5.3 Usability Quality

1. Recurrence shown in human-readable format in primary summary (raw RRULE may remain in debug).
2. Optional fields are not repeatedly asked when user explicitly declines/defers and contract permits.
3. Mobile usability remains verified (iPhone 12 width and narrow Android width).

---

## 6) Test + Smoke Plan

## 6.1 Automated

1. Extend fixture suite for new reliability scenarios (title, time semantics, optional-field deferral).
2. Preserve all Phase 8 launch-surface assertions.
3. Add tests for recurrence display formatter in host summary.

## 6.2 Manual (Claude in Chrome + Axiom)

1. Run 4 production scripts:
   - canonical venue recurring create,
   - custom location create,
   - sparse input requiring clarification,
   - timeslot explicit intent create.
2. Verify fallback to classic still works from host route.
3. Verify mobile rendering (375px and 360px).
4. Run Axiom checks for funnel + errors + fallback trend.

---

## 7) Rollout and Rollback

### Rollout (this tract)
1. Keep `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=true` as current baseline unless smoke fails.
2. Deploy incrementally with post-deploy metric checks at 1h, 24h, and 7d.

### Rollback
1. Set `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=false`.
2. Redeploy.
3. Verify:
   - `/dashboard/my-events/new` shows classic-only,
   - `/dashboard/my-events/new/conversational` redirects to `?classic=true`.

---

## 8) Repo Execution Prompt (copy/paste)

```md
You are implementing INTERPRETER-10 (Phase 9 UX Optimization + Trust Metrics).

Hard constraints:
- Keep interpreter architecture unchanged: AI interprets, server decides.
- No direct DB writes from `/api/events/interpret`.
- Preserve all existing hardening guards and Phase 8 launch behavior.
- Classic form fallback must remain available.

Execution order:

## 9A) Metrics baseline
1) Add/standardize telemetry for conversational create funnel:
   - route entry, interpret submit, next_action, create attempt/success/fail, fallback click.
2) Ensure no PII/secrets in logs.
3) Provide Axiom query examples and baseline dashboard checks.

## 9B) Reliability hardening
1) Improve title extraction fallback behavior for creative titles.
2) Improve time semantics mapping for doors/performance patterns.
3) Enforce venue/custom mutual exclusivity cleanup deterministically.

## 9C) Clarification turn reduction
1) Keep single-question UX.
2) Avoid re-asking already satisfied fields.
3) Reduce optional-field blocking where contract allows.

## 9D) UX refinement
1) Convert recurrence summary to human-friendly text in primary UI.
2) Ensure clear next-step messaging after each run.
3) Preserve mobile usability and fallback visibility.

Deliverables:
- Updated code + tests
- Updated docs/SMOKE-PROD.md with Phase 9 checks
- Updated stop-gate with implementation evidence
- Final report with:
  - files changed
  - test/lint output
  - Axiom baseline + post-change metrics
  - residual risks and rollback readiness
```

---

## 9) Approval Gates

Before execution prompt issuance:
1. Confirm Phase 9 metric definitions and thresholds are accepted.
2. Confirm whether recurrence humanization is UI-only or also API summary field update.
3. Confirm rollout stance after 7-day metrics window (hold/ramp/reduce).

---

## 10) Implementation Evidence

### Files Changed

| Phase | File | Change |
|-------|------|--------|
| 9A | `web/src/lib/events/interpretEventContract.ts` | Added `trace_id?: string` to request interface |
| 9A | `web/src/app/api/events/interpret/route.ts` | Extract + log `traceId` in all 5 console.info calls |
| 9A | `web/src/app/api/events/telemetry/route.ts` | **NEW**: minimal auth-gated telemetry endpoint (no userId logged) |
| 9A | `web/src/app/api/my-events/route.ts` | Added traceId extraction (UUID-sanitized) + logging in create success/failure |
| 9A | `web/src/app/.../ConversationalCreateUI.tsx` | Added traceId state, sendTelemetry helper, impression dedup guard, fallback click, trace_id in payloads |
| 9B | `web/src/app/api/events/interpret/route.ts` | Creative title extraction third pass in `deriveTitleFromText` |
| 9B | `web/src/lib/events/interpreterPostprocess.ts` | Expanded DOORS_PATTERN + PERFORMANCE_START_PATTERN |
| 9B | `web/src/app/api/events/interpret/route.ts` | Reverse venue/custom exclusivity block (keyed on `venueResolution.status`) |
| 9C | `web/src/lib/events/interpreterPostprocess.ts` | Added 8 explicit cases to `isBlockingFieldSatisfied` (conservative `default: false` preserved) |
| 9D | `web/src/app/.../ConversationalCreateUI.tsx` | Import `humanizeRecurrence`, add `dayOfWeek`, humanize 2 display sites |
| 9E | `docs/SMOKE-PROD.md` | §28 Phase 9 checks |
| 9E | `docs/investigation/interpreter-phase9-ux-optimization-stopgate.md` | Implementation evidence |

### New Test Files

| File | Phase | Tests |
|------|-------|-------|
| `web/src/__tests__/interpreter-phase9-telemetry.test.ts` | 9A | 14 |
| `web/src/__tests__/interpreter-phase9-reliability.test.ts` | 9B | 8 |
| `web/src/__tests__/interpreter-phase9-pruning.test.ts` | 9C | 8 |
| `web/src/__tests__/interpreter-phase9-recurrence-display.test.ts` | 9D | 6 |

### Key Design Decisions

1. **Create outcome tracked server-side only** — `/api/my-events` logs traceId on create success/failure. No client-side create_success/create_failure telemetry (avoids navigation/unload drops).
2. **Reverse venue/custom exclusivity uses `venueResolution.status`** — not `location_mode` (which is already forced by `hardenDraftForCreateEdit`). Only fires when resolver didn't find a match AND custom fields are populated AND stale venue_id is present.
3. **PII-minimal telemetry** — telemetry endpoint omits userId, logs only traceId + eventName.
4. **Conservative blocking field pruning** — only explicit named cases added, `default: return false` preserved.
5. **Impression dedup** — `useRef(false)` one-shot guard prevents duplicate events on React rerender/strict-mode.

### Axiom Query Templates

```
# Funnel: impressions → submissions → creates
['vercel-runtime'] | where message contains "[events/telemetry]"
  | where _time > ago(7d) | summarize count() by eventName

# next_action distribution
['vercel-runtime'] | where message contains "[events/interpret] response"
  | where _time > ago(7d)
  | summarize count() by nextAction

# Per-session turn count (median, p90)
['vercel-runtime'] | where message contains "[events/interpret] request"
  | where _time > ago(7d)
  | summarize turns = count() by traceId
  | summarize median(turns), percentile(turns, 90), count()

# Fallback click rate
['vercel-runtime'] | where message contains "[events/telemetry]"
  | where message contains "fallback_click"
  | where _time > ago(7d) | summarize count()

# Error rate
['vercel-runtime'] | where message contains "[events/interpret]"
  | where status >= 500 | where _time > ago(7d) | summarize count()
```

### Metric Thresholds

| Metric | Target | Hard Rollback |
|--------|--------|---------------|
| Median clarification turns | <= 2 | > 4 |
| P90 clarification turns | <= 4 | > 6 |
| Create completion rate | >= 90% | < 70% |
| 5xx error rate | < 1% | > 5% |
| Fallback click rate | Tracked (baseline) | > 30% |

### Residual Risks

1. **Reverse venue/custom exclusivity** — new logic path. Mitigated by: narrow conditions (venueResolution must indicate no match + custom fields populated + stale venue_id present), all existing fixture tests must pass.
2. **Blocking field pruning expansion** — 8 new cases. Mitigated by: explicit named cases only (no generic fallback), same validity standard as existing cases.
3. **Telemetry endpoint** — new API surface. Mitigated by: auth-gated, rate-limited, console.info only (no DB writes), event name allowlist.

### Monitoring Checkpoints

| Checkpoint | Date | Status |
|------------|------|--------|
| T+1h | 2026-03-01 ~19:00 MT | PENDING |
| T+24h | 2026-03-02 | PENDING |
| T+7d | 2026-03-08 | PENDING |

### Day-7 Rollout Decision Template

**Date:** ____
**Decision:** GO / HOLD / ROLLBACK

| Metric | Target | Hard Rollback | Observed | Pass? |
|--------|--------|---------------|----------|-------|
| Median clarification turns | <= 2 | > 4 | ___ | |
| P90 clarification turns | <= 4 | > 6 | ___ | |
| Create completion rate | >= 90% | < 70% | ___ | |
| 5xx error rate | < 1% | > 5% | ___ | |
| Fallback click rate | Tracked | > 30% | ___ | |

**If GO:** Update status to `PRODUCTION-VERIFIED`. Close tract.
**If HOLD:** Keep current exposure. Extend monitoring 7 more days. Document reason.
**If ROLLBACK:** Set `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=false`, redeploy, verify classic-only. Document root cause.

