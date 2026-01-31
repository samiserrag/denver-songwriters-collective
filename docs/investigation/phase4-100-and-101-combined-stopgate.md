# STOP-GATE — Phase 4.100 + Phase 4.101 Combined Investigation

**Status:** INVESTIGATION COMPLETE — Awaiting Approval
**Date:** January 2026

---

# PHASE 4.100 — RELIABILITY POLISH

## 1. Investigation Verification ✅

**Report location:** `docs/investigation/phase4-100-reliability-polish-stopgate.md`

### Verified Against Actual Code

| File | Report Line | Actual Line | Status |
|------|-------------|-------------|--------|
| `display/page.tsx` - connectionStatus | 81 | 81 | ✅ Match |
| `display/page.tsx` - failureCount | 82 | 82 | ✅ Match |
| `display/page.tsx` - polling interval | 252-256 | 254 (5s) | ✅ Match |
| `lineup/page.tsx` - connectionStatus | 98 | 98 | ✅ Match |
| `lineup/page.tsx` - failureCount | 99 | 99 | ✅ Match |
| `lineup/page.tsx` - polling interval | 312-317 | 315 (10s) | ✅ Match |
| `LineupStateBanner.tsx` - variants | Yes | Line 9, 20, 45 | ✅ Match |

### Confirmed: Pages Do NOT Use useLineupPolling.ts

Both pages have inline implementations. The hook exists but is unused by these pages.

---

## 2. STOP-GATE CRITIQUE — Red Team Analysis

### Risk 1: Double-Fetch on visibilitychange + focus

**Scenario:** User clicks into tab → both `visibilitychange` (visible) and `focus` fire simultaneously.

**Analysis:**
- `visibilitychange` fires when `document.visibilityState` changes
- `focus` fires when window gains focus
- These CAN fire in quick succession (~0-50ms apart)

**Mitigation:** Use shared debounce function with 50ms delay
```typescript
const debouncedFetch = useMemo(() => {
  let timeoutId: NodeJS.Timeout | null = null;
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(fetchData, 50);
  };
}, [fetchData]);
```

**Risk Level:** LOW with debounce

### Risk 2: Listener Cleanup Correctness

**Requirement:** All listeners must be removed on unmount.

**Pattern:**
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("focus", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("focus", handler);
  };
}, [/* deps */]);
```

**Risk:** If `fetchData` changes identity on every render (it's in useCallback with deps), the effect will re-run and re-add listeners.

**Mitigation:** The debounced function reference must be stable. Use `useRef` for the debounce timeout, and ensure cleanup removes the correct handler.

**Risk Level:** LOW with proper cleanup

### Risk 3: "Connection lost" Banner Stuck After Success

**Current behavior:**
- `connectionStatus` set to `"disconnected"` when `failureCount >= 2`
- On success: `setConnectionStatus("connected")`, `setFailureCount(0)`

**Potential issue:** If `failureCount` is in the dependency array of `fetchData`, and `failureCount` changes, `fetchData` reference changes → could cause timing issues.

**Analysis of current code:**
```typescript
// display/page.tsx line 249
}, [eventId, supabase, urlDate, failureCount]);
```

`failureCount` IS in the dependency array. This means:
- Every failure increments `failureCount` → `fetchData` reference changes
- This doesn't cause stuck state because success ALWAYS sets `connectionStatus("connected")`

**Risk Level:** NONE — current code handles this correctly

### Risk 4: State Duplication Causing Regressions

**Analysis:** Both pages have independent state. No shared state between them.

**Potential issue:** None — they're separate pages.

**Risk Level:** NONE

### Risk 5: "Connection Restored" Banner Loops Continuously

**Proposed logic:**
```typescript
const wasDisconnected = connectionStatus === "disconnected";
// ... success updates ...
if (wasDisconnected) {
  setShowRecovered(true);
  setTimeout(() => setShowRecovered(false), 5000);
}
```

**Potential issue:** If component re-renders during the 5-second window, could we set multiple timeouts?

**Mitigation:** Store timeout ID in `useRef` and clear on unmount:
```typescript
const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// In fetchData success:
if (wasDisconnected && !showRecovered) {
  setShowRecovered(true);
  if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
  recoveryTimeoutRef.current = setTimeout(() => setShowRecovered(false), 5000);
}

// In cleanup:
useEffect(() => {
  return () => {
    if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
  };
}, []);
```

**Risk Level:** LOW with useRef pattern

### Risk 6: Extended Disconnection Hint Timer

**Proposed:** Check every 30s if disconnected for 5+ minutes.

**Potential issue:** Timer not cleaned up on unmount.

**Mitigation:** Standard cleanup pattern with clearInterval.

**Risk Level:** LOW

---

## 3. Phase 4.100 Summary

### Changes Approved for Implementation

| Feature | Target | Risk | Mitigation |
|---------|--------|------|------------|
| Visibility/Focus refresh | display + lineup | LOW | 50ms debounce |
| "Connection restored" banner | display + lineup | LOW | useRef for timeout |
| Extended disconnection hint | display only | LOW | clearInterval cleanup |

### Non-Regression Boundaries

- ❌ Do NOT change polling intervals (5s display, 10s lineup)
- ❌ Do NOT modify date logic
- ❌ Do NOT add dependencies

---

# PHASE 4.101 — QR COVER BLOCKS

## 1. Investigation Findings

### Cover Image Sources

| Entity | DB Field | Page | Query Location |
|--------|----------|------|----------------|
| Event | `events.cover_image_url` | `/events/[id]` | Line 187 |
| Event (override) | `override_patch.cover_image_url` | `/events/[id]` | Line 461 |
| Venue | `venues.cover_image_url` | `/venues/[id]` | Line 110 |
| Profile | `profiles.avatar_url` | `/songwriters/[id]` | Line 46, 52 |

### Canonical URL Patterns

| Entity | Route | Pattern |
|--------|-------|---------|
| Event | `/events/[id]` | `/events/{slug or uuid}?date={dateKey}` |
| Venue | `/venues/[id]` | `/venues/{slug or uuid}` |
| Profile | `/songwriters/[id]` | `/songwriters/{slug or uuid}` |

### Existing QR Utilities

**Found 2 QR libraries:**

| Library | Package | Usage | Renders As |
|---------|---------|-------|------------|
| `qrcode` | `qrcode@1.5.4` | `display/page.tsx` | Data URL (PNG) |
| `qrcode.react` | `qrcode.react@4.2.0` | `ProfileQRCode.tsx` | **Inline SVG** ✅ |

**Existing components:**

| Component | File | Purpose |
|-----------|------|---------|
| `ProfileQRCode` | `components/ui/ProfileQRCode.tsx` | Profile QR + label |
| `TipQRCode` | `components/ui/ProfileQRCode.tsx` | Venmo/CashApp QR |
| `OrganizationQRCode` | `components/ui/ProfileQRCode.tsx` | Generic URL QR |

**Recommendation:** Use `QRCodeSVG` from `qrcode.react` for the new component.

### CSP Analysis

**Current img-src policy (next.config.ts line 61):**
```
img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://*.scdn.co https://*.spotifycdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org
```

| Image Type | Source | CSP Status |
|------------|--------|------------|
| Event cover | Supabase storage | ✅ Allowed (`https://*.supabase.co`) |
| Venue cover | Supabase storage | ✅ Allowed |
| Profile avatar | Supabase storage | ✅ Allowed |
| QR (data URL) | Inline | ✅ Allowed (`data:`) |
| QR (inline SVG) | Inline | ✅ No img-src needed |

**Verdict:** No CSP changes required.

---

## 2. STOP-GATE CRITIQUE — Red Team Analysis

### Risk 1: CSP for QR Images

**Options:**
1. Data URL (`data:image/png;base64,...`) — Allowed by `data:` in img-src
2. Inline SVG (`<svg>...</svg>`) — Not an img, no CSP restriction
3. External service — Would require CSP update

**Recommendation:** Use inline SVG via `QRCodeSVG` (option 2). Safest, no network requests, no CSP concerns.

**Risk Level:** NONE with inline SVG

### Risk 2: SSR/Hydration Mismatch

**Scenario:** If QR generation uses runtime values (current time, random), server and client could render differently.

**Analysis of QRCodeSVG:**
- Input: static URL string
- Output: deterministic SVG
- No time/random dependencies

**Risk Level:** NONE

### Risk 3: Layout on Mobile vs Projector

**Proposed component should:**
- Stack vertically on narrow screens (cover on top, QR below)
- Place QR beside cover on wide screens
- QR should be scannable size (min 100x100px)

**Mitigation:** Use responsive Tailwind classes.

**Risk Level:** LOW — standard responsive design

### Risk 4: Cover Image Missing

**Scenario:** Event/venue has no cover image set.

**Mitigation:** Show placeholder or hide cover section, still show QR.

**Risk Level:** LOW — graceful fallback

### Risk 5: URL Construction on Server

**Scenario:** Need `window.location.origin` for full URL, but server doesn't have window.

**Mitigation:** Use environment variable `NEXT_PUBLIC_SITE_URL` (already exists, line 46 in display/page.tsx).

**Risk Level:** NONE — existing pattern

---

## 3. Phase 4.101 Proposed Implementation

### New Component: `QrShareBlock.tsx`

```typescript
// components/shared/QrShareBlock.tsx
interface QrShareBlockProps {
  title: string;
  url: string;           // Canonical URL for QR
  imageSrc?: string;     // Cover image (optional)
  imageAlt?: string;
  variant?: "event" | "venue" | "profile";
  size?: "sm" | "md" | "lg";
}
```

**Features:**
- Uses `QRCodeSVG` from `qrcode.react`
- Responsive layout (stack on mobile, side-by-side on desktop)
- Optional cover image with fallback
- Label shows "Scan to visit" or similar

### Insertion Points

| Page | File | Location | Notes |
|------|------|----------|-------|
| Event | `app/events/[id]/page.tsx` | After hero section | Use `displayCoverImage` |
| Venue | `app/venues/[id]/page.tsx` | After cover image | Use `venue.cover_image_url` |
| Profile | `app/songwriters/[id]/page.tsx` | After avatar section | Use `songwriter.avatar_url` |

### URL Construction

```typescript
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";
const eventUrl = `${SITE_URL}/events/${event.slug || eventId}`;
```

---

## 4. Summary Table

| Phase | Feature | Risk | Approved? |
|-------|---------|------|-----------|
| 4.100 | Visibility/Focus refresh | LOW | Pending |
| 4.100 | "Connection restored" banner | LOW | Pending |
| 4.100 | Extended disconnection hint | LOW | Pending |
| 4.101 | QrShareBlock component | NONE | Pending |
| 4.101 | Event page integration | NONE | Pending |
| 4.101 | Venue page integration | NONE | Pending |
| 4.101 | Profile page integration | NONE | Pending |

---

## 5. Dependencies

| Phase | New Dependencies | Status |
|-------|------------------|--------|
| 4.100 | None | ✅ |
| 4.101 | None (`qrcode.react` already exists) | ✅ |

---

## 6. Test Plan

### Phase 4.100 Tests

| Test | Type | Approach |
|------|------|----------|
| Debounce triggers single fetch | Unit | Mock fetchData, fire visibility+focus, assert called once |
| "Recovered" state auto-dismisses | Unit | Assert state transitions with timers |
| Disconnection hint appears after threshold | Unit | Mock Date.now, assert state after 5min |

### Phase 4.101 Tests

| Test | Type | Approach |
|------|------|----------|
| QrShareBlock renders QR with correct URL | Unit | Render component, check QRCodeSVG value prop |
| QrShareBlock is SSR-safe | Unit | Render on server (no window access) |
| QrShareBlock handles missing image | Unit | Render without imageSrc prop |

---

# HARD STOP

**Both phases are ready for critique approval.**

**Awaiting Sami approval before any implementation.**

---

## Implementation Order (After Approval)

1. **Phase 4.100 PR:**
   - Visibility/Focus immediate refresh
   - "Connection restored" banner
   - Extended disconnection hint (display only)
   - Tests
   - CLAUDE.md update

2. **Phase 4.101 PR:**
   - Create `QrShareBlock.tsx` component
   - Integrate into event page
   - Integrate into venue page
   - Integrate into profile page
   - Tests
   - CLAUDE.md update
