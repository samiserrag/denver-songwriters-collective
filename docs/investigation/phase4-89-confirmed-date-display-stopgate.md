# Phase 4.89: Show "Confirmed date" on Public Detail Pages — COMPLETE

## Goal

Add a date-only line "Confirmed: Feb 16, 2026" on public event detail pages when `last_verified_at` is non-null.

## Requirements

- Display format: "Confirmed: MMM D, YYYY" (e.g., "Confirmed: Feb 16, 2026")
- Only render when `last_verified_at` is non-null
- Use America/Denver timezone for date formatting
- No placeholder when unconfirmed (just don't render the line)
- Display-only change — MUST NOT change:
  - `status` (lifecycle)
  - `is_published` (visibility)
  - confirmation logic (still `last_verified_at != null`)

---

## STOP-GATE 1: Investigation Results

### Part 1: Badge Rendering Location

**Single canonical detail page:** `/events/[id]/page.tsx`

The `/open-mics/[slug]` route is just a redirect to `/events/[id]` (line 42):
```typescript
redirect(`/events/${event.slug || event.id}`);
```

**Badge rendering location:** `app/events/[id]/page.tsx` lines 848-867

### Part 2: Data Availability

**Query includes required fields:** `app/events/[id]/page.tsx` line 240
```typescript
source, last_verified_at, verified_by,
```

**Helper already exists:** `lib/events/verification.ts` — `formatVerifiedDate()` with correct America/Denver timezone

### Part 3: Database Audit

```sql
-- Events without confirmation: 49
SELECT COUNT(*) FROM events WHERE last_verified_at IS NULL;

-- Anomalies (verified_by but no timestamp): 0
SELECT COUNT(*) FROM events WHERE verified_by IS NOT NULL AND last_verified_at IS NULL;
```

**Result:** No legacy backfill required (0 anomalies).

### Part 4: Create/Publish Paths Truth Table

| Path | Sets `last_verified_at`? |
|------|-------------------------|
| Community create + publish | ✅ YES |
| Draft create | ❌ NO |
| First publish (PATCH) | ✅ YES |
| Republish (PATCH) | ✅ YES |
| PublishButton | ✅ YES |
| Admin bulk verify | ✅ YES |
| Admin inline verify | ✅ YES |
| Ops Console CSV import | ❌ NO |
| Legacy import/seed | ❌ NO |

---

## STOP-GATE 2: Implementation — COMPLETE

### Files Modified

| File | Change |
|------|--------|
| `web/src/app/events/[id]/page.tsx` | Added confirmed date display (lines 848-868) |

### Implementation

Added date display directly after the "Confirmed" badge:

```tsx
{verificationState === "confirmed" && (
  <>
    <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border border-[var(--pill-border-success)]">
      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Confirmed
    </span>
    {formatVerifiedDate(event.last_verified_at) && (
      <span className="text-sm text-[var(--color-text-secondary)]">
        Confirmed: {formatVerifiedDate(event.last_verified_at)}
      </span>
    )}
  </>
)}
```

---

## STOP-GATE 3: Documentation — COMPLETE

### CLAUDE.md Updates

Added "Confirmation (Verified) Invariants (Phase 4.89)" section documenting:
- Core rule: confirmed = `last_verified_at IS NOT NULL`
- What confirmation affects (trust display only)
- What confirmation does NOT affect (visibility)
- Auto-confirmation paths table
- Helper functions reference

**Key invariant added:**
> Visibility must NEVER depend on `last_verified_at`

---

## Tests — COMPLETE

### New Test File

`web/src/__tests__/phase4-89-confirmed-date-display.test.ts` — 19 tests

| Test Category | Tests |
|---------------|-------|
| `formatVerifiedDate` edge cases | 8 |
| `getPublicVerificationState` | 5 |
| UI display contract | 3 |
| Auto-confirmation contract | 3 |

---

## Quality Gates

| Check | Status |
|-------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2576 passing (19 new) |
| Build | ✅ Success |

---

## Summary

Phase 4.89 complete:
1. ✅ Confirmed date display on public event detail pages
2. ✅ Uses existing `formatVerifiedDate()` helper (America/Denver timezone)
3. ✅ Only renders when `last_verified_at` is non-null
4. ✅ Documentation added to CLAUDE.md
5. ✅ 19 new tests added
6. ✅ No database changes required (0 anomalies found)
