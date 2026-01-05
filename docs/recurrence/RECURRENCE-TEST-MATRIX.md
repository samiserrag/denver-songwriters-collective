# Recurrence Test Matrix

**Date:** 2026-01-04
**Status:** Audit Complete - Test Coverage Gaps Identified

This document maps recurrence scenarios to test coverage, identifying gaps.

---

## 1. Existing Test Coverage

### 1.1 nextOccurrence.test.ts (61 tests)

| Category | Tests | Coverage |
|----------|-------|----------|
| Weekly expansion | 8 | `expandOccurrencesForEvent()` for weekly events |
| Monthly ordinal | 6 | "1st", "2nd", "3rd", "4th", "last" ordinals |
| Monthly RRULE | 4 | `FREQ=MONTHLY;BYDAY=1TH` style |
| Monthly pairs | 3 | "1st/3rd", "2nd/4th" patterns |
| Edge cases | 5 | No-data, invalid rules, null handling |
| Time formatting | 8 | `formatTimeToAMPM()` variations |
| Denver timezone | 4 | `getTodayDenver()`, `denverDateKeyFromDate()` |
| Override merging | 6 | Cancelled occurrences, time overrides |
| Expansion caps | 5 | 200 events, 500 occurrences, 40 per event |
| `computeNextOccurrence()` | 12 | Single date returns |

### 1.2 recurrence-correctness.test.ts (17 tests)

| Category | Tests | Coverage |
|----------|-------|----------|
| Day validation | 5 | `validateDayOfWeekMatch()` helper |
| Label vs generator | 4 | Consistency between paths |
| Event date anchor | 4 | Single-date behavior |
| Error messages | 4 | User-friendly rejection text |

### 1.3 expansionCaps.test.ts

| Category | Tests | Coverage |
|----------|-------|----------|
| Max events | 2 | 200 event limit |
| Max occurrences | 2 | 500 total limit |
| Per-event cap | 2 | 40 occurrences per event |

---

## 2. Test Matrix: Required Cases

### 2.1 Weekly Patterns

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Weekly, single day | `recurrence_rule="weekly"`, `day_of_week="Monday"` | Every Monday in 90-day window | ✅ Covered |
| Weekly, no day_of_week | `recurrence_rule="weekly"`, `day_of_week=null` | Falls back to "Schedule TBD" | ✅ Covered |
| Weekly, with event_date | `recurrence_rule="weekly"`, `event_date="2026-01-06"` | Single date only (short-circuit) | ✅ Covered |
| **Weekly, multi-day** | `day_of_week="Tuesday,Thursday"` | Both days per week | ❌ **NOT SUPPORTED** |
| **Biweekly expansion** | `recurrence_rule="biweekly"` | Every other week | ⚠️ **UNTESTED** |

### 2.2 Monthly Patterns

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Monthly 1st weekday | `recurrence_rule="1st"`, `day_of_week="Tuesday"` | 1st Tuesday of each month | ✅ Covered |
| Monthly 2nd weekday | `recurrence_rule="2nd"`, `day_of_week="Wednesday"` | 2nd Wednesday | ✅ Covered |
| Monthly 3rd weekday | `recurrence_rule="3rd"`, `day_of_week="Thursday"` | 3rd Thursday | ✅ Covered |
| Monthly 4th weekday | `recurrence_rule="4th"`, `day_of_week="Friday"` | 4th Friday | ✅ Covered |
| Monthly last weekday | `recurrence_rule="last"`, `day_of_week="Sunday"` | Last Sunday | ✅ Covered |
| Monthly pair "1st/3rd" | `recurrence_rule="1st/3rd"`, `day_of_week="Monday"` | 1st and 3rd Mondays | ✅ Covered |
| Monthly pair "2nd/4th" | `recurrence_rule="2nd/4th"`, `day_of_week="Tuesday"` | 2nd and 4th Tuesdays | ✅ Covered |
| RRULE monthly | `recurrence_rule="FREQ=MONTHLY;BYDAY=1TH,3TH"` | 1st and 3rd Thursdays | ✅ Covered |
| **5th weekday (doesn't exist)** | `recurrence_rule="5th"`, `day_of_week="Monday"` | Skip months without 5th | ⚠️ **UNTESTED** |
| **Monthly by date** | `recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=15"` | 15th of each month | ❌ **NOT SUPPORTED** |

### 2.3 End Conditions

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| **End by date** | `recurrence_end_date="2026-03-01"` | No occurrences after March 1 | ❌ **NOT IMPLEMENTED** |
| **End by count** | RRULE `COUNT=10` | Only 10 occurrences | ⚠️ **PARSED BUT UNUSED** |
| Implicit end | (none) | 90-day rolling window | ✅ Covered |

### 2.4 Timezone & DST

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Denver winter dates | January dates | Mountain Standard Time (UTC-7) | ✅ Covered |
| Denver summer dates | July dates | Mountain Daylight Time (UTC-6) | ✅ Covered |
| **DST forward transition** | March 9, 2026 02:00 | Spring forward (1:59 AM → 3:00 AM) | ❌ **NO TEST** |
| **DST backward transition** | November 1, 2026 02:00 | Fall back (2:00 AM repeats) | ❌ **NO TEST** |
| **Near-midnight event across DST** | `start_time="23:30"` on March 8, 2026 | Correct date assignment | ❌ **NO TEST** |

### 2.5 Edge Cases

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Null recurrence_rule | `recurrence_rule=null` | Uses day_of_week if set | ✅ Covered |
| Empty recurrence_rule | `recurrence_rule=""` | Uses day_of_week if set | ✅ Covered |
| "none" recurrence_rule | `recurrence_rule="none"` | Uses day_of_week if set | ✅ Covered |
| No day, no rule | Both null | "Schedule TBD" label | ✅ Covered |
| Invalid RRULE | `recurrence_rule="FREQ=BOGUS"` | Fallback to day_of_week | ✅ Covered |
| **Day/date mismatch** | `event_date` Tuesday, `day_of_week="Monday"` | Validation rejects | ✅ Covered (Phase 4.42) |
| Past event_date | `event_date="2024-01-01"` | No future occurrences | ✅ Covered |

### 2.6 Occurrence Overrides

| Case | Input | Expected | Status |
|------|-------|----------|--------|
| Cancel single occurrence | `status="cancelled"` for date_key | Hidden by default, shown with toggle | ✅ Covered |
| Override start_time | `override_start_time="19:00"` | Uses override instead of event time | ✅ Covered |
| Override cover image | `override_cover_image_url` set | Uses override flyer | ✅ Covered |
| Override notes | `override_notes` set | Shows date-specific notes | ✅ Covered |
| Multiple overrides | 3+ dates with different statuses | Correct merge | ✅ Covered |
| **Override on non-existent occurrence** | Override for date not in pattern | Ignored gracefully | ⚠️ **UNTESTED** |

### 2.7 Label Generation

| Case | Input | Expected Label | Status |
|------|-------|----------------|--------|
| Weekly | `recurrence_rule="weekly"`, `day_of_week="Monday"` | "Every Monday" | ✅ Covered |
| Biweekly | `recurrence_rule="biweekly"`, `day_of_week="Tuesday"` | "Every Other Tuesday" | ✅ Covered |
| Monthly ordinal | `recurrence_rule="1st"`, `day_of_week="Wednesday"` | "1st Wednesday of the Month" | ✅ Covered |
| Monthly pair | `recurrence_rule="1st/3rd"`, `day_of_week="Thursday"` | "1st & 3rd Thursdays" | ✅ Covered |
| RRULE monthly | `FREQ=MONTHLY;BYDAY=2TU,4TU` | "Second & Fourth Tuesday of the Month" | ✅ Covered |
| One-time | `event_date` set, no rule/day | "One-time" | ✅ Covered |
| Seasonal | `recurrence_rule="seasonal"` | "Seasonal — check venue" | ✅ Covered |
| Unknown pattern | Unparseable rule | "Recurring" | ✅ Covered |

---

## 3. Gap Summary

### 3.1 Features Not Supported (Need Implementation)

| Gap ID | Feature | Complexity | Priority |
|--------|---------|------------|----------|
| GAP-8 | Multi-day weekly (Tu/Th) | Medium | Low |
| GAP-9 | Custom/irregular dates | High | Low |
| GAP-5 | End-by-date enforcement | Medium | Medium |
| N/A | Monthly by day-of-month (BYMONTHDAY) | Medium | Low |

### 3.2 Tests Missing (Code Exists, Untested)

| Gap ID | Scenario | Risk | Priority |
|--------|----------|------|----------|
| GAP-6 | DST forward transition | Medium | Medium |
| GAP-6 | DST backward transition | Medium | Medium |
| GAP-6 | Near-midnight across DST | Medium | Medium |
| GAP-7 | Biweekly expansion correctness | Low | Low |
| N/A | 5th weekday in months without it | Low | Low |
| N/A | Override on non-pattern date | Low | Low |

### 3.3 Data Issues (Need Cleanup)

| Gap ID | Issue | Count | Priority |
|--------|-------|-------|----------|
| GAP-1 | Mismatched day_of_week/event_date | 7 events (TEST data) | High |
| GAP-4 | Inconsistent recurrence_rule formats | 19 variants | Medium |
| GAP-3 | Unused schema columns | 4 columns | Low |

---

## 4. Proposed Test Additions

### 4.1 Priority 1: DST Tests

```typescript
// In nextOccurrence.test.ts

describe("DST transitions", () => {
  it("handles spring forward (March 9, 2026)", () => {
    // Mock date to March 1, 2026
    // Weekly Monday event
    // Verify March 9 occurrence is correct date
  });

  it("handles fall back (November 1, 2026)", () => {
    // Mock date to October 15, 2026
    // Weekly Sunday event
    // Verify November 1 occurrence is correct date
  });

  it("handles near-midnight event across DST forward", () => {
    // Event at 11:30 PM on March 8
    // Verify occurrence lands on correct date
  });
});
```

### 4.2 Priority 2: Biweekly Expansion

```typescript
describe("biweekly expansion", () => {
  it("expands every other week from anchor", () => {
    const event = {
      recurrence_rule: "biweekly",
      day_of_week: "Wednesday",
      event_date: null,
    };
    // Should return ~6-7 occurrences in 90 days (every other week)
  });

  it("skips alternate weeks correctly", () => {
    // Verify gap between occurrences is 14 days
  });
});
```

### 4.3 Priority 3: Non-Existent 5th Weekday

```typescript
describe("5th weekday edge case", () => {
  it("skips months without 5th occurrence", () => {
    const event = {
      recurrence_rule: "5th",
      day_of_week: "Monday",
    };
    // Most months don't have a 5th Monday
    // Should gracefully skip those months
  });
});
```

---

## 5. Test File Inventory

| File | Location | Tests | Focus |
|------|----------|-------|-------|
| `nextOccurrence.test.ts` | `lib/events/__tests__/` | 61 | Core expansion logic |
| `recurrence-correctness.test.ts` | `__tests__/` | 17 | Day/date validation |
| `expansionCaps.test.ts` | `lib/events/__tests__/` | 6 | Resource limits |
| `occurrence-overrides.test.ts` | `__tests__/` | 17 | Override merging |

**Total existing tests:** 101

**Proposed additions:** 8-12 new tests for DST, biweekly, edge cases

---

## 6. Manual Test Checklist

For production verification (not automatable):

### 6.1 Visual Verification

- [ ] Weekly event shows ~13 occurrences in happenings
- [ ] Monthly ordinal shows 3-4 occurrences in happenings
- [ ] Cancelled occurrence hidden by default
- [ ] Cancelled occurrence shows with toggle
- [ ] Override flyer displays on specific date
- [ ] Label matches actual expansion dates

### 6.2 Admin Verification

- [ ] Override editor shows future dates
- [ ] Cancel operation creates override row
- [ ] Time override changes display correctly
- [ ] Multiple overrides on same event work

### 6.3 User Flow Verification

- [ ] Create weekly event → see multiple dates
- [ ] Edit event → label updates correctly
- [ ] RSVP to specific occurrence → confirmation shows date

---

## Appendix: recurrence_rule Format Variants

Found in production database (19 distinct formats):

| Format | Example | Count | Category |
|--------|---------|-------|----------|
| weekly | `"weekly"` | 42 | Simple |
| none | `"none"` | 18 | Simple |
| (empty) | `""` | 12 | Simple |
| 1st | `"1st"` | 6 | Legacy ordinal |
| 2nd | `"2nd"` | 8 | Legacy ordinal |
| 3rd | `"3rd"` | 4 | Legacy ordinal |
| 4th | `"4th"` | 2 | Legacy ordinal |
| last | `"last"` | 2 | Legacy ordinal |
| 1st/3rd | `"1st/3rd"` | 4 | Legacy pair |
| 2nd/4th | `"2nd/4th"` | 1 | Legacy pair |
| RRULE | `"FREQ=MONTHLY;BYDAY=1TH,3TH"` | 3 | RFC 5545 |
| biweekly | `"biweekly"` | 1 | Simple |
| monthly | `"monthly"` | 1 | Simple |
| seasonal | `"seasonal"` | 1 | Simple |
| Other text | Various | 4 | Legacy/custom |

**Recommendation:** Standardize on RRULE format for new events, maintain backward compatibility for legacy formats.
