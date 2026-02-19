---
paths:
  - "web/**"
  - "components/**"
  - "hooks/**"
  - "lib/**"
  - "types/**"
  - "data/**"
---

# Web Product Invariants

This file contains product behavior and locked UI invariants for web-facing work.

## Routing Rules

### Canonical Listing Routes (Use These)

- `/happenings`
- `/happenings?type=open_mic`
- `/happenings?type=dsc`

### Forbidden in UI (Redirects Exist)

- `/open-mics` (listing) — **never link to this**
- `/events` (listing) — **never link to this**

### Valid Detail Routes

- `/events/[id]` — Canonical event detail page (supports both UUID and slug)
- `/open-mics/[slug]` — Legacy entrypoint, redirects to `/events/[id]`

---

## Recurrence Invariants (Phase 4.83)

### Required Field Combinations

Ordinal monthly events (`recurrence_rule` IN `1st`, `2nd`, `3rd`, `4th`, `5th`, `last`, `1st/3rd`, `2nd/4th`, etc.) **MUST** have `day_of_week` set. Otherwise `interpretRecurrence()` returns `isConfident=false` and the event is hidden from happenings.

| recurrence_rule | day_of_week Required | Example |
|-----------------|---------------------|---------|
| `weekly`, `biweekly` | Yes | `day_of_week='Monday'` |
| `1st`, `2nd`, `3rd`, `4th`, `5th`, `last` | Yes | `day_of_week='Saturday'` |
| `1st/3rd`, `2nd/4th`, `1st and 3rd`, etc. | Yes | `day_of_week='Thursday'` |
| `monthly` | Yes | `day_of_week='Tuesday'` |
| `custom` | No | Uses `custom_dates` array |
| `NULL` (one-time) | No | Uses `event_date` only |

### Canonicalization Behavior

Server-side canonicalization (`recurrenceCanonicalization.ts`) runs on POST and PATCH:
- If `recurrence_rule` is ordinal monthly AND `day_of_week` is NULL
- Derive `day_of_week` from `event_date` (e.g., `2026-01-24` → `Saturday`)
- This prevents invalid rows from being saved

Defensive fallback (`recurrenceContract.ts` line 426):
- If `day_of_week` is still NULL at render time, derive from `event_date`
- Safety net for legacy data or edge cases

### Data Integrity Audit Query

Run after bulk imports or to verify no invalid rows:

```sql
-- Should return 0 rows (ordinal monthly with missing day_of_week)
SELECT id, title, recurrence_rule, day_of_week, event_date
FROM events
WHERE recurrence_rule IN (
  '1st', '2nd', '3rd', '4th', '5th', 'last',
  '1st/3rd', '2nd/4th', '2nd/3rd',
  '1st and 3rd', '2nd and 4th', '1st and Last',
  'monthly'
)
AND day_of_week IS NULL;
```

### Axiom Production Monitoring

Check for fallback derivation warnings (should be rare/zero after Phase 4.83):

```bash
# Query for recurrence fallback warnings in last 24h
axiom query "['vercel'] | where message contains 'derived day_of_week' or message contains 'fallback' | where _time > ago(24h) | sort by _time desc | take 50"

# Check specific event IDs with recurrence issues
axiom query "['vercel'] | where path contains '/api/my-events' and status >= 400 | where _time > ago(24h) | sort by _time desc | take 20"
```

---

## Confirmation (Verified) Invariants (Phase 4.89)

### Core Rule

An event is **confirmed** if and only if `last_verified_at IS NOT NULL`.

| State | Condition | Display |
|-------|-----------|---------|
| Confirmed | `last_verified_at IS NOT NULL` | Green "Confirmed" badge + "Confirmed: MMM D, YYYY" |
| Unconfirmed | `last_verified_at IS NULL` | Amber "Unconfirmed" badge (no date shown) |
| Cancelled | `status = 'cancelled'` | Red "Cancelled" badge |

### What Confirmation Affects

- **Trust display only** — Shows users the event has been verified
- The "Confirmed" badge and "Confirmed: " date display are both derived from `last_verified_at`

### What Confirmation Does NOT Affect

**INVARIANT: Visibility must NEVER depend on `last_verified_at`**

- `is_published` controls public visibility
- `status` controls lifecycle (active/cancelled)
- Unconfirmed events are still visible on `/happenings` if published

### Auto-Confirmation Paths

| Path | Sets `last_verified_at`? | `verified_by` |
|------|-------------------------|---------------|
| Community create + publish | ✅ YES | NULL (auto) |
| Draft create | ❌ NO | — |
| First publish (PATCH) | ✅ YES | NULL (auto) |
| Republish (PATCH) | ✅ YES | NULL (auto) |
| PublishButton | ✅ YES | NULL (auto) |
| Admin bulk verify | ✅ YES | Admin user ID |
| Admin inline verify | ✅ YES | Admin user ID |
| Import/seed paths | ❌ NO | — |
| Ops Console CSV import | ❌ NO | — |

**Design intent:** Imported/seeded events start unconfirmed by design. They require explicit admin verification.

### Helper Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getPublicVerificationState()` | `lib/events/verification.ts` | Returns `confirmed` / `unconfirmed` / `cancelled` |
| `formatVerifiedDate()` | `lib/events/verification.ts` | Returns "MMM D, YYYY" in America/Denver timezone |
| `shouldShowUnconfirmedBadge()` | `lib/events/verification.ts` | Suppresses badge for DSC TEST events |

---


## Build Notes

- Protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"`
- Vercel auto-deploys from `main` branch
- All CSS colors should use theme tokens (no hardcoded hex in components)

---


## Locked Layout Rules (v2.0)

These layout decisions are **locked** and must not be changed without explicit approval:

### HappeningCard Layout

| Element | Locked Value |
|---------|--------------|
| Card structure | Vertical poster card (not horizontal row) |
| Poster aspect | 3:2 (`aspect-[3/2]`) |
| Surface class | `card-spotlight` |
| Grid layout | 1 col mobile, 2 col md, 3 col lg |
| Poster hover | `scale-[1.02]` zoom |
| Past event opacity | `opacity-70` |
| Font minimum | 14px in discovery views |

### Chip Styling

| Element | Locked Value |
|---------|--------------|
| Base classes | `px-2 py-0.5 text-sm font-medium rounded-full border` |
| Missing details | Warning badge (amber), not underlined link |

### Forbidden Changes

- Do NOT revert to horizontal/list layouts
- Do NOT use `text-xs` for chips (14px minimum)
- Do NOT add social proof ("X going", popularity counts)
- Do NOT use hardcoded colors (must use theme tokens)

---

## API Route Known Footguns

### Media embed fields are admin-only but the form always sends them

The event form (`EventForm.tsx`) always includes `youtube_url`, `spotify_url`, and `media_embed_urls` in the request body — even when empty. The PATCH/POST handlers in `/api/my-events/` have an admin-only guard for these fields.

**Current guard (after Feb 2026 fix):** Only blocks when a non-empty URL is set:
```typescript
const hasNonEmptyMediaEmbed = !!(body.youtube_url?.trim?.() || body.spotify_url?.trim?.());
```

**If you add new admin-only fields to any event API route**, use the same pattern — check for non-empty values, not `!== undefined`. The form sends all fields in every request.

### Multiple 403 paths in event management routes

`/api/my-events/[id]/route.ts` has multiple points that return 403:
1. `canManageEvent()` — user is not host/cohost/admin
2. Media embed guard — non-admin sending non-empty media URLs
3. CSC branding guard — non-approved-host setting `is_dsc_event`

When debugging a 403, **always check the response body** to identify which guard fired. Use Chrome MCP `javascript_tool` to execute `fetch()` from the user's session — see `40-ops-observability-and-debug.md`.

---

