# Homepage Tonight Happenings Parity Fix

**Date:** March 17, 2026  
**Status:** Executed after approval  
**Owner:** Repo executor  
**Scope:** Align homepage "Tonight's Happenings" with `/happenings` and remove homepage preview slicing

---

## 1) Incident

User reported that the homepage tonight list did not match the `/happenings` tonight list.

---

## 2) Root Cause

Two separate causes were present:

1. **Intentional UX difference (count mismatch):** homepage rendered a preview subset via `tonightsHappenings.slice(0, 6)`.
2. **Actual parity risk (data/order drift):** homepage tonight query used a capped candidate set (`limit(200)`) with no deterministic base ordering, so displayed entries could diverge from `/happenings` under load/order variance.

---

## 3) Changes Shipped

### A) Query parity and deterministic ordering

Updated homepage tonight query to match `/happenings` upcoming predicate and deterministic ordering:

- include `event_date.gte.${today},event_date.is.null,recurrence_rule.not.is.null`
- order by `event_date`, then `start_time`, then `id`
- remove `limit(200)` cap

File:
- `web/src/app/page.tsx`

Also added deterministic base ordering in `/happenings` query path:

- order by `event_date`, then `start_time`, then `id`

File:
- `web/src/app/happenings/page.tsx`

### B) Product decision: no homepage preview slice

Removed homepage tonight rail slice so homepage renders the full tonight list:

- `tonightsHappenings.slice(0, 6)` -> `tonightsHappenings.map(...)`

File:
- `web/src/app/page.tsx`

### C) Regression coverage

Extended consistency source-assertion tests to enforce:

- homepage upcoming parity OR clause includes null-dated recurring events
- homepage does not use `limit(200)` in tonight query
- `/happenings` has deterministic base ordering
- homepage tonight rail has no `slice(0, 6)` preview cap

File:
- `web/src/__tests__/phase6-cross-surface-consistency.test.ts`

---

## 4) Verification Evidence

Executed:

```bash
npm test -- --run src/__tests__/phase6-cross-surface-consistency.test.ts
```

Result:

- 55 tests passed
- 0 failed

---

## 5) Outcome

Homepage now shows the full "Tonight's Happenings" set and is derived from a parity-aligned, deterministically ordered candidate query consistent with `/happenings`.
