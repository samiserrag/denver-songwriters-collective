# Investigation: Public vs Admin RSVP Count Discrepancy

**Date**: 2026-02-23
**Status**: Investigation complete, fix pending
**Reported by**: Sami (site admin)
**Event**: CSC Song Critique Circle - Secular Hub - Wednesday - 2/25 - 7:30-9:30 PM
**Event ID**: `70e8361a-efcd-4e6d-9cc8-41da5a03a8cd`

---

## Symptom

The admin event management page (`/dashboard/my-events/{id}`, Attendees tab) shows **3 confirmed RSVPs**, while the public event page (`/events/{slug}?date=2026-02-25`, "Who's Coming" section) shows **6 people**.

The admin count is correct. The public page is overcounting.

---

## Root Cause

The public `AttendeeList` component does not filter RSVPs by `date_key` for non-recurring events, so it returns all confirmed RSVPs across every `date_key` stored for this event. The admin API route always resolves and filters by an effective `date_key`.

### Why `date_key` filtering is skipped on the public page

The public event detail page (`web/src/app/events/[id]/page.tsx`) computes `effectiveSelectedDate` which is passed as `dateKey` to child components. For non-recurring events, this value is **always null** because:

1. `effectiveSelectedDate` starts as `null` (line 506)
2. It is only populated when `upcomingOccurrences.length > 0` (lines 509-521)
3. `upcomingOccurrences` is only populated when `recurrence.isRecurring && recurrence.isConfident` (line 462)
4. This event is non-recurring (`recurrence_rule: null`, `day_of_week: null`, `max_occurrences: 1`)
5. So `upcomingOccurrences` stays empty, `effectiveSelectedDate` stays null

When `AttendeeList` receives `dateKey={undefined}`, it conditionally skips the filter:

```ts
// web/src/components/events/AttendeeList.tsx, lines 77-79
if (dateKey) {
  query = query.eq("date_key", dateKey);
}
```

Result: the query returns ALL confirmed RSVPs for this event_id regardless of `date_key`.

### Why the admin page is correct

The admin API route (`web/src/app/api/my-events/[id]/rsvps/route.ts`) calls `resolveEffectiveDateKey(eventId, providedDateKey)` which always computes a date key (falling back to computing the next occurrence), and then **unconditionally** applies `.eq("date_key", effectiveDateKey)` (line 53). So the admin always scopes to one occurrence.

---

## Database State

**Event record:**

| Field | Value |
|-------|-------|
| event_date | 2026-02-25 |
| day_of_week | null |
| recurrence_rule | null |
| max_occurrences | 1 |
| custom_dates | null |

**All RSVPs for this event (7 rows):**

| # | Name | Status | date_key | Type | Created |
|---|------|--------|----------|------|---------|
| 1 | Sami Serrag (host) | confirmed | 2026-01-18 | Registered user | 2026-01-17 |
| 2 | Sami Serrag (host) | cancelled | 2026-02-01 | Registered user | 2026-02-01 |
| 3 | Jay Mader | confirmed | **2026-02-28** | Guest (verified) | 2026-02-18 |
| 4 | Ryan Mecillas | confirmed | **2026-02-28** | Guest (verified) | 2026-02-22 |
| 5 | Ratch The Pterodactyl | confirmed | 2026-02-25 | Registered user | 2026-02-22 |
| 6 | Robert | confirmed | 2026-02-25 | Guest (verified) | 2026-02-23 |
| 7 | Mike Barnett (Egg Jar) | confirmed | 2026-02-25 | Registered user | 2026-02-24 |

**Breakdown by date_key:**
- `2026-02-25` (correct event date): 3 confirmed (Ratch, Robert, Mike Barnett) — matches admin count
- `2026-02-28` (old date, before event was rescheduled from 2/28 to 2/25): 2 confirmed (Jay Mader, Ryan Mecillas) — orphaned
- `2026-01-18` (stale from a past occurrence): 1 confirmed (Sami Serrag) — orphaned
- `2026-02-01`: 1 cancelled (Sami Serrag) — not counted anywhere

**Public page shows 6** because: 3 + 2 + 1 = 6 confirmed RSVPs with no date_key filter.

---

## Affected Code Paths

### `effectiveSelectedDate` usage map in `page.tsx`

This variable is passed to ~15 downstream consumers. Changing when it is set has wide blast radius:

| Lines | Consumer | Current behavior (null) | If set to event_date | Risk |
|-------|----------|------------------------|---------------------|------|
| 524-529 | `occurrence_overrides` query | Skips query entirely | Queries with `.maybeSingle()`, returns null | Low — harmless extra query |
| 546 | `displayDate` computation | Falls back to other sources | Uses event_date | Low — same effective value |
| 647-648 | Server-side RSVP count (used in sidebar) | `.eq("date_key", ...)` is skipped; counts ALL confirmed RSVPs | Filters to event_date only | **Medium** — orphaned RSVPs vanish from count |
| 663-664 | Server-side timeslot count | `.eq("date_key", ...)` is skipped; counts all | Filters to event_date only | Medium — same orphan concern for timeslots |
| 845 | `readEventEmbedsWithFallback()` | Passes null/undefined | Passes date string | Unknown — need to verify embed lookup handles this |
| 1060, 1455 | `RSVPSection.dateKey` / `selectedDateKey` | undefined — API calls omit date_key | Passes date string — API calls include date_key | **High** — changes RSVP create/lookup behavior for all non-recurring events; existing RSVPs with mismatched date_key would not be found |
| 1482 | `HostControls.dateKey` | null | date string | Low |
| 1523 | `TimeslotSection.dateKey` | undefined — fetches all timeslots | Filters to event_date | Medium |
| 1534 | `AttendeeList.dateKey` | undefined — fetches ALL confirmed RSVPs (THE BUG) | Filters to event_date | **This is the fix target** |
| 1619 | `EventComments` or similar | undefined | date string | Needs verification |
| 1631 | Share URL construction | No `?date=` param in URL | Adds `?date=YYYY-MM-DD` to share URL | **Medium** — changes canonical/share URLs for all non-recurring events; affects SEO, social previews, cached links |

### Client-side query paths (no date_key filter when prop is undefined)

These components all use the same conditional pattern `if (dateKey) { query = query.eq("date_key", dateKey) }`:

- `AttendeeList.tsx` (line 77-79) — the bug
- `RSVPSection.tsx` (line 41-42) — uses date_key in API URL construction
- `TimeslotSection.tsx` — likely same pattern (not fully audited)

### Admin API route (correctly scoped)

- `web/src/app/api/my-events/[id]/rsvps/route.ts` (line 53) — always applies `.eq("date_key", effectiveDateKey)` via `resolveEffectiveDateKey()`

---

## Fix Options

### Option A — Narrow fix in `AttendeeList` only

Change `AttendeeList.tsx` to require a date_key and fetch the event's `event_date` as fallback when none is provided.

**Pros**: Minimal blast radius. Fixes the visible bug (public "Who's Coming" count) without touching RSVPSection, timeslots, share URLs, or server-side counts.

**Cons**: The server-side RSVP count in the sidebar (line 647) would still be unfiltered for non-recurring events, creating a potential mismatch between the sidebar count and the "Who's Coming" count. Other components remain unscoped.

### Option B — Narrow fix in `AttendeeList` + server-side RSVP count

Same as A, but also fix the server-side count query at line 647 to fall back to `event.event_date` when `effectiveSelectedDate` is null.

**Pros**: Sidebar count and "Who's Coming" list agree. Still narrow scope.

**Cons**: Two separate fixes instead of addressing the root cause. Other date-scoped queries (timeslots, embeds) remain unfiltered.

### Option C — Global fallback: set `effectiveSelectedDate = event.event_date` for non-recurring events

Add after line 521:
```ts
if (!effectiveSelectedDate && event.event_date) {
  effectiveSelectedDate = event.event_date;
}
```

**Pros**: Fixes the root cause. All downstream consumers get correct scoping. Consistent behavior across recurring and non-recurring events.

**Cons**:
- Changes behavior for ALL non-recurring events sitewide, not just this one
- RSVPSection would start receiving a dateKey it never had before — existing RSVPs with mismatched date_keys could appear as "not RSVP'd" to users (they'd need to re-RSVP)
- Share URLs for all non-recurring events gain `?date=` parameter (SEO / social preview impact)
- Could surface hidden data mismatches in other events
- Needs thorough regression testing across the site

### Option D — Fix the data + narrow code fix

1. Update the 3 orphaned RSVP rows to `date_key = 2026-02-25` (or cancel/delete them since Jay Mader, Ryan Mecillas, and Sami's old RSVP may not intend to attend on the new date)
2. Apply Option A or B for the code fix to prevent this class of bug

**Pros**: Addresses both the symptom and the data integrity issue for this specific event.

**Cons**: Doesn't prevent the same bug from recurring for other non-recurring events with mismatched date_keys.

### Recommended approach

**Option B + data cleanup** (combine B and D):
1. Fix `AttendeeList.tsx` and the server-side RSVP count to fall back to `event.event_date`
2. Clean up orphaned RSVP data for this event
3. Consider Option C as a follow-up after regression testing

This balances correctness with safety. The global fix (Option C) is likely the right long-term answer but warrants a dedicated regression pass given how many consumers depend on `effectiveSelectedDate`.

---

## Files to Modify

| File | Change |
|------|--------|
| `web/src/components/events/AttendeeList.tsx` | Add event_date fallback when dateKey is undefined |
| `web/src/app/events/[id]/page.tsx` (line 647) | Add event_date fallback for server-side RSVP count |
| Database: `event_rsvps` table | Clean up orphaned rows for this event (date_key 2026-02-28 and 2026-01-18) |

---

## How to Reproduce

1. Visit the public event page: `https://coloradosongwriterscollective.org/events/csc-song-critique-circle-secular-hub-wednesday-2-25-7-30-9-30-pm-2026-02-25?date=2026-02-25`
2. Scroll to "Who's Coming" — shows 6 people
3. Visit the admin management page: `https://coloradosongwriterscollective.org/dashboard/my-events/70e8361a-efcd-4e6d-9cc8-41da5a03a8cd`
4. Click "Attendees" tab — shows 3 confirmed
5. The difference is 3 orphaned RSVPs from other date_keys leaking into the public count
