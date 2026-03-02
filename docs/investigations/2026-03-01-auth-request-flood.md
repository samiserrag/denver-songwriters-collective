# Investigation Report: Auth Request Flood on `/happenings`

**Date:** 2026-03-01
**Investigator:** Repo Agent
**Severity:** Medium (performance/cost impact, no data loss)
**Status:** ROOT CAUSE CONFIRMED — Remediation ready

---

## Executive Summary

Every navigation to `/happenings` triggers **692 concurrent `supabase.auth.getUser()` calls** in a single 16ms burst. The root cause is straightforward: the page renders **692 `HappeningCard` components** (one per event occurrence across a ~90-day window), and each card independently calls `getUser()` on mount to check the user's favorite status. There is no render loop, timer, or Supabase SDK bug — it is purely an N+1 auth pattern at the component level.

---

## Findings Table

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| 1 | **692 `<article>` elements rendered** on `/happenings` | `document.querySelectorAll('article').length === 692`, all visible, zero hidden | All cards mount simultaneously — no virtualization |
| 2 | **Each `HappeningCard` calls `getUser()` on mount** | `HappeningCard.tsx` line 525: `await supabase.auth.getUser()` inside `useEffect` (line 521-546) | 1 network call per card = 692 calls |
| 3 | **`getUser()` makes a network request every time** | GoTrueClient `_getUser()` → `_request(this.fetch, 'GET', ${this.url}/user)` | Not cached, not deduped by the SDK |
| 4 | **All 692 calls fire in a 16ms burst** | Timestamp analysis: first call at +30687ms, last at +30703ms (Δ=16ms) | Synchronous batch during React effect commit phase |
| 5 | **67 actual HTTP requests hit Supabase** | `window.fetch` interceptor counted 67 `/auth/v1/user` calls vs 692 `getUser()` invocations | Navigator Locks serializes; browser caps at 6 concurrent connections |
| 6 | **Flood is navigation-triggered, not ongoing** | Count stabilized at 692 and did not increase over 70+ seconds of idle time | One-time burst per mount, not a timer/interval |
| 7 | **Steady-state pages (e.g., `/about`) show 0 calls** | Interceptor measured 0 `getUser()` calls over 11+ seconds on `/about` | Only `/happenings` (and any page with many cards) is affected |
| 8 | **`getSession()` reads from storage — no network call** | GoTrueClient `getSession()` → `_useSession()` → `__loadSession()` reads from cookie storage | Safe drop-in for getting `user.id` |
| 9 | **Singleton client is NOT the issue** | `globalThis.__supabaseClient` returns same reference; singleton pattern works correctly | Each card gets the same client — the problem is calling `getUser()` at all |

---

## Root Cause

**File:** `web/src/components/happenings/HappeningCard.tsx`
**Lines:** 521–546

```tsx
useEffect(() => {
  let mounted = true;
  async function checkFavorite() {
    try {
      const { data: { user } } = await supabase.auth.getUser();  // ← NETWORK CALL
      if (!user) { ... return; }
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", event.id)
        .maybeSingle();
      if (!error && mounted) setFavorited(!!data);
    } catch { /* ignore */ }
  }
  checkFavorite();
  return () => { mounted = false; };
}, [event.id, supabase]);
```

**Why it floods:**
1. `/happenings` renders 692 HappeningCard components (all event occurrences in a ~90-day window)
2. React commits all 692 components in one batch
3. All 692 `useEffect` callbacks fire synchronously during the commit phase
4. Each calls `supabase.auth.getUser()` which queues a network request to `/auth/v1/user`
5. GoTrueClient's `_acquireLock(-1, ...)` serializes the actual HTTP requests, but all 692 calls are initiated

**Secondary issue on the same lines:** Each card also makes its own `favorites` query (`SELECT id FROM favorites WHERE user_id = $1 AND event_id = $2`), resulting in 692 additional Supabase DB queries.

---

## Architectural Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| Supabase Auth rate limiting | **HIGH** | 692 calls/page-load could trigger Supabase's auth rate limits (default: ~30 req/s per project) |
| User-perceived latency | **MEDIUM** | 692 queued requests block browser connection pool for other legitimate requests |
| Supabase cost | **MEDIUM** | Auth endpoint calls count toward project usage quotas |
| Data integrity | **NONE** | `getUser()` is read-only; no writes are affected |
| Production outage risk | **LOW** | Supabase handles the load, but sustained traffic at scale could trigger throttling |

---

## Decision: **GO** — Remediation Safe to Execute

The fix is low-risk, localized to one file, and does not change any data flows or auth behavior.

---

## Remediation Proposal (Ranked)

### Option A — Lift user + favorites to parent (RECOMMENDED)

**Risk:** Low | **Impact:** Eliminates all 692 per-card auth + DB calls
**Files:** `web/src/app/happenings/page.tsx`, `web/src/components/happenings/HappeningCard.tsx`

1. In the server component (`happenings/page.tsx`), query the authenticated user's full favorites set:
   ```sql
   SELECT event_id FROM favorites WHERE user_id = $currentUserId
   ```
2. Pass the `Set<string>` of favorited event IDs as a prop to a client wrapper
3. Pass `isFavorited: boolean` as a prop to each `HappeningCard`
4. Remove the `useEffect` + `getUser()` + per-card favorites query from `HappeningCard`
5. Keep the `toggleFavorite` click handler, but use `getSession()` instead of `getUser()` (for the user ID needed on toggle)

**Result:** 0 auth calls on mount. 1 DB query total (server-side). Toggle uses `getSession()` (storage-only, no network).

### Option B — Replace `getUser()` with `getSession()` in HappeningCard

**Risk:** Very Low | **Impact:** Eliminates 692 network calls, still has 692 DB queries
**Files:** `web/src/components/happenings/HappeningCard.tsx` only

1. Change line 525 from:
   ```tsx
   const { data: { user } } = await supabase.auth.getUser();
   ```
   to:
   ```tsx
   const { data: { session } } = await supabase.auth.getSession();
   const user = session?.user ?? null;
   ```
2. Same change on line 553 (toggleFavorite handler)

**Result:** 0 auth network calls. Still 692 favorites DB queries (addressed separately).

### Option C — Add virtualization (react-window / intersection observer)

**Risk:** Medium | **Impact:** Reduces rendered cards to ~10-15 visible
**Files:** Multiple components in happenings/

1. Only render cards visible in the viewport
2. Lazy-mount cards as user scrolls

**Result:** ~10-15 auth calls instead of 692. Best combined with Option A or B.

---

## Recommended Execution Sequence

1. **Option B first** (5-minute fix, immediate relief) — swap `getUser()` → `getSession()` in `HappeningCard.tsx`
2. **Option A second** (larger refactor) — lift favorites to server-side query, eliminating 692 per-card DB queries
3. **Option C later** (backlog) — virtualization for general page performance

---

## Verification Plan

After applying Option B:
- [x] `npm run build` passes — clean build, no type errors
- [x] Navigate to `/happenings` with fetch interceptor — confirm 0 `/auth/v1/user` calls
- [x] Favorite toggle still works (click heart, verify DB write) — verified on production (d14792fd deploy)
- [x] Logged-out user sees unfavorited state (no errors) — all 521 cards show "Add favorite", 0 console errors
- [x] No regressions on `/about`, `/events/[id]`, dashboard pages — build + 4889 tests pass

---

## Before / After Metrics (Option B Applied)

| Metric | Before (production, pre-fix) | After (dev server, post-fix) |
|--------|------------------------------|------------------------------|
| `auth.getUser()` calls per `/happenings` load | **692** | **0** |
| `auth.getSession()` calls per load | 0 | 1386 (692 × 2 in StrictMode; 692 in prod) |
| `/auth/v1/user` HTTP requests | **67** (serialized by lock) | **0** |
| Network bytes to Supabase Auth | ~67 × ~500B = ~33 KB | **0 B** |
| `<article>` elements rendered | 692 | 692 (unchanged) |
| Test suite | 4889 pass | 4889 pass |
| Build | clean | clean |

**Measurement method:** Monkey-patched `globalThis.__supabaseClient.auth.getUser` and `.getSession` on dev server `/about` page, then clicked `<a href="/happenings">` for client-side navigation. Waited 8 seconds for full render + effects. Counted calls via `window.__authFlood.count` / `window.__sessionFlood.count`.

### Change summary

**File:** `web/src/components/happenings/HappeningCard.tsx`
- Line 525: `supabase.auth.getUser()` → `supabase.auth.getSession()` + extract `session?.user` (checkFavorite useEffect)
- Line 553: `supabase.auth.getUser()` → `supabase.auth.getSession()` + extract `session?.user` (toggleFavorite click handler)

Both call sites only needed `user.id` for the favorites query. `getSession()` reads from cookie storage with zero network cost.

---

## Option A Applied: Server-Side Favorites Lift

**Date:** 2026-03-01

### Problem (post-Option B)

Option B eliminated 692 `/auth/v1/user` network calls, but each HappeningCard still makes its own `SELECT id FROM favorites WHERE user_id = $1 AND event_id = $2` query on mount — 521+ individual DB round-trips per page load for authenticated users.

### Solution

Lift the favorites lookup to a single server-side batch query in `happenings/page.tsx`. Pass pre-computed `isFavorited` boolean to each card via props.

### Tri-state contract

| `isFavorited` value | Meaning | Card behavior |
|---------------------|---------|---------------|
| `true` / `false` | Server-provided known status | Use directly, skip client query |
| `null` | Anonymous user (no session) | Render unfavorited, skip client query |
| `undefined` (omitted) | Server fetch failed / not provided | Run existing client-side fallback |

### Files changed

| File | Change |
|------|--------|
| `web/src/app/happenings/page.tsx` | Added `getSession()` + batch `SELECT event_id FROM favorites WHERE user_id = $1`, intersect in memory via `Set.has()`. Scoped to `viewMode === "timeline"`. Applied `isFavorited` prop to all 4 `<HappeningsCard>` render sites. |
| `web/src/components/happenings/HappeningsCard.tsx` | Accept + pass through `isFavorited` prop |
| `web/src/components/happenings/HappeningCard.tsx` | Accept `isFavorited` prop, `useState(isFavorited === true)`, useEffect guard skips client query when prop is provided |
| `web/src/__tests__/happening-card-favorites-lift.test.tsx` | 5 behavioral tests: validates all tri-state paths, asserts `.from("favorites")` call counts |

### Before / After Metrics (Option A Applied)

| Metric | After Option B only | After Option A + B |
|--------|--------------------|--------------------|
| `auth.getUser()` calls per load | 0 | 0 |
| `auth.getSession()` calls per load (client) | 692 (prod) | 0 (server-side session read) |
| Per-card `SELECT FROM favorites` DB queries | **521+** (1 per card, authenticated) | **0** |
| Server-side favorites queries | 0 | **1** (batch) |
| `/auth/v1/user` HTTP requests | 0 | 0 |
| Test suite | 4889 pass | 4894 pass |
| Build | clean | clean |

### Design notes

- Fetches ALL user favorites with `.eq("user_id", userId)` then intersects with visible event IDs in memory via `Set.has()`. Avoids PostgREST `.in()` URL-length limits from 500+ UUIDs.
- Server-side uses `getSession()` (cookie-based, no network call) — safe for high-traffic public route.
- Only runs batch fetch when `viewMode === "timeline"` (map/series views don't render HappeningsCard).
