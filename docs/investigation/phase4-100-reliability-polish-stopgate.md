# STOP-GATE 0 — Phase 4.100 Reliability Polish Investigation

**Status:** INVESTIGATION COMPLETE — Awaiting Approval
**Date:** January 2026
**Scope:** Post-launch polish for unattended TV/display reliability
**Risk Level:** LOW — All changes are additive and removable

---

## 1. Files & Line Numbers — Current State

### Polling & Timers

| File | Line | Purpose |
|------|------|---------|
| `display/page.tsx` | 91-94 | Clock timer (1s interval) with cleanup |
| `display/page.tsx` | 252-256 | Polling interval (5s) with cleanup |
| `lineup/page.tsx` | 312-317 | Polling interval (10s) with cleanup |
| `useLineupPolling.ts` | 230-233 | Polling interval (configurable) with cleanup |
| `LineupStateBanner.tsx` | 25-36 | "Seconds ago" timer (1s) with cleanup |

### Connection State Tracking

| File | Line | State Variables |
|------|------|-----------------|
| `display/page.tsx` | 79-82 | `lastUpdated`, `connectionStatus`, `failureCount` |
| `lineup/page.tsx` | 96-99 | `lastUpdated`, `connectionStatus`, `failureCount` |
| `useLineupPolling.ts` | 88-90 | `lastUpdated`, `connectionStatus`, `failureCount` |

### Banner Component

| File | Line | Feature |
|------|------|---------|
| `LineupStateBanner.tsx` | 17-115 | Connection health display (prominent + subtle variants) |
| `LineupStateBanner.tsx` | 45-78 | Subtle variant (TV display) — hides when connected |
| `LineupStateBanner.tsx` | 82-113 | Prominent variant (control page) — always visible |

---

## 2. Connection State Extension Points

### Current State Flow

```
fetchData() success → setConnectionStatus("connected"), setFailureCount(0)
fetchData() failure → setFailureCount(prev + 1)
                    → failureCount >= 2 → setConnectionStatus("disconnected")
                    → failureCount < 2 → setConnectionStatus("reconnecting")
```

### Proposed Extension Point for "Recovered" Signal

**Insert location:** Inside `fetchData()` success block, BEFORE setting state

```typescript
// Proposed logic (NOT implementation, just design)
const wasDisconnected = connectionStatus === "disconnected";
// ... existing state updates ...
if (wasDisconnected) {
  // Trigger one-time "recovered" signal
}
```

**Files requiring this change:**
1. `display/page.tsx` lines 233-237
2. `lineup/page.tsx` lines 294-298
3. `useLineupPolling.ts` lines 202-207

---

## 3. Shared Logic Analysis

| Feature | display/page.tsx | lineup/page.tsx | useLineupPolling.ts |
|---------|------------------|-----------------|---------------------|
| Polling interval | 5s (hardcoded) | 10s (hardcoded) | configurable |
| Connection tracking | Inline | Inline | Inline |
| Banner | Uses LineupStateBanner | Uses LineupStateBanner | N/A (returns state) |
| Timer cleanup | ✅ | ✅ | ✅ |

### Decision: Parallel Handling Required

**Reason:** `display/page.tsx` does NOT use `useLineupPolling`. It has its own inline implementation. Modifications must be applied to BOTH:
1. `display/page.tsx` (TV display)
2. `useLineupPolling.ts` (used by lineup control)

Note: `lineup/page.tsx` has its own inline implementation too and does NOT use the hook currently. For Phase 4.100, we should modify the inline implementations in both pages.

---

## 4. Proposed Insertion Points

### Feature 1: Immediate Refresh on Visibility/Focus

| File | Insert Location | Pattern |
|------|-----------------|---------|
| `display/page.tsx` | After line 256 (polling effect) | New useEffect with `visibilitychange` + `focus` listeners |
| `lineup/page.tsx` | After line 317 (polling effect) | Same pattern |

**Proposed implementation pattern:**
```typescript
React.useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      fetchData();
    }
  };
  const handleFocus = () => fetchData();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
  };
}, [fetchData]);
```

### Feature 2: "Connection Restored" Banner

| File | Change Location | Change Type |
|------|-----------------|-------------|
| `display/page.tsx` | Add state line ~83 | `const [showRecovered, setShowRecovered] = React.useState(false)` |
| `display/page.tsx` | In fetchData success (~236) | Check `wasDisconnected`, set `showRecovered(true)` |
| `display/page.tsx` | After line 286 (banner) | Conditional render of recovery message |
| `LineupStateBanner.tsx` | Add prop `showRecovered` | Optional prop for one-time message |

**Auto-dismiss pattern:**
```typescript
// After setting showRecovered(true)
setTimeout(() => setShowRecovered(false), 5000); // Auto-dismiss after 5s
```

### Feature 3: Extended Disconnection Prompt (5+ minutes)

| File | Change Location | Change Type |
|------|-----------------|-------------|
| `display/page.tsx` | Add state line ~84 | `const [disconnectedSince, setDisconnectedSince] = React.useState<Date | null>(null)` |
| `display/page.tsx` | Add state line ~85 | `const [showOfflineHint, setShowOfflineHint] = React.useState(false)` |
| `display/page.tsx` | In fetchData failure | If newly disconnected, set `disconnectedSince` |
| `display/page.tsx` | In fetchData success | Clear `disconnectedSince` and `showOfflineHint` |
| `display/page.tsx` | New useEffect | Check if disconnected > 5 minutes, show hint ONCE |

**Timer pattern:**
```typescript
React.useEffect(() => {
  if (connectionStatus !== "disconnected" || !disconnectedSince) return;

  const checkDuration = () => {
    const mins = (Date.now() - disconnectedSince.getTime()) / 60000;
    if (mins >= 5 && !showOfflineHint) {
      setShowOfflineHint(true);
    }
  };

  const interval = setInterval(checkDuration, 30000); // Check every 30s
  return () => clearInterval(interval);
}, [connectionStatus, disconnectedSince, showOfflineHint]);
```

---

## 5. Memory Leak Risk Assessment

| Listener | File | Cleanup Required | Pattern |
|----------|------|------------------|---------|
| `visibilitychange` | display/page.tsx | ✅ Yes | `removeEventListener` in cleanup |
| `focus` | display/page.tsx | ✅ Yes | `removeEventListener` in cleanup |
| `visibilitychange` | lineup/page.tsx | ✅ Yes | `removeEventListener` in cleanup |
| `focus` | lineup/page.tsx | ✅ Yes | `removeEventListener` in cleanup |
| Timer for offline hint | display/page.tsx | ✅ Yes | `clearInterval` in cleanup |
| Timer for recovery dismiss | display/page.tsx | ⚠️ Potential | Use `useRef` for timeout ID |

**Risk Mitigation:**
- All event listeners must be removed in useEffect cleanup
- setTimeout for recovery dismiss must be stored in ref and cleared on unmount
- No unbounded array growth patterns

---

## 6. Risk Table

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Listener not cleaned up | LOW | Memory leak over hours | Explicit cleanup in all useEffects |
| Double-fetch on visibility + focus | MEDIUM | Extra network call | Debounce both events (50ms) |
| Recovery banner stuck visible | LOW | UI clutter | Use ref-tracked timeout with cleanup |
| Safari `visibilitychange` quirks | MEDIUM | No immediate refresh | Fallback to `focus` event as backup |
| Multiple tabs causing conflicts | LOW | No impact | Each tab has independent state |
| Offline hint shown repeatedly | LOW | UI annoyance | Use state flag to ensure single show |
| Mobile Safari background behavior | MEDIUM | Unpredictable refresh | Accept — polling will recover |
| Supabase token refresh interaction | NONE | N/A | Token refresh is automatic, orthogonal |

---

## 7. STOP-GATE CRITIQUE — Red Team Analysis

### Edge Case: Browser Sleep/Wake

**Scenario:** TV enters power-saving mode (screen off, browser backgrounded) for 30+ minutes, then wakes.

**Current behavior:** Next poll happens within 5 seconds of wake.

**With Phase 4.100:** `visibilitychange` fires immediately on wake → instant refresh.

**Risk:** None. `visibilitychange` is widely supported.

### Edge Case: Mobile Safari Quirks

**Scenario:** iOS Safari has aggressive background tab throttling.

**Current behavior:** Polling may be severely throttled (15+ seconds).

**With Phase 4.100:** `visibilitychange` fires on return to foreground → instant refresh.

**Risk:** LOW. Safari supports `visibilitychange` since iOS 7.

### Edge Case: Multiple Tabs Open to Same Event

**Scenario:** Venue staff opens display in two tabs.

**Current behavior:** Both tabs poll independently, both update independently.

**With Phase 4.100:** Both tabs get immediate refresh on visibility/focus.

**Risk:** NONE. Independent state is correct behavior.

### Edge Case: Battery/Network Usage

**Scenario:** TV running display 24/7.

**Current behavior:** 720 polls/hour (5s interval).

**With Phase 4.100:** 720 polls/hour + occasional visibility/focus refreshes.

**Risk:** NEGLIGIBLE. Maybe +1-5 extra fetches per day.

### Edge Case: Supabase Token Refresh

**Scenario:** Display runs for 2+ hours, auth token expires.

**Current behavior:** Supabase SSR client auto-refreshes tokens.

**With Phase 4.100:** No change to token handling.

**Risk:** NONE. Orthogonal concern.

### Edge Case: Rapid Tab Switching

**Scenario:** Staff rapidly switches tabs multiple times.

**Current behavior:** N/A (no listener).

**With Phase 4.100:** Could trigger multiple fetches in quick succession.

**Mitigation:** Add 50ms debounce to visibility/focus handlers.

---

## 8. Non-Regression Checklist

| Behavior | Must Preserve | How Verified |
|----------|---------------|--------------|
| 5-second polling on display | ✅ | Don't modify setInterval line |
| 10-second polling on lineup | ✅ | Don't modify setInterval line |
| Timer cleanup on unmount | ✅ | Keep existing cleanup functions |
| Connection status → banner | ✅ | Keep existing state flow |
| Date picker for recurring events | ✅ | Don't touch date logic |
| Confirmation dialogs | ✅ | Don't touch modal logic |

---

## 9. Implementation Summary

### Files to Modify

1. **`web/src/app/events/[id]/display/page.tsx`**
   - Add visibility/focus effect (new useEffect after line 256)
   - Add recovered state + conditional render
   - Add extended disconnection hint logic

2. **`web/src/app/events/[id]/lineup/page.tsx`**
   - Add visibility/focus effect (new useEffect after line 317)
   - Add recovered state + conditional render
   - (Skip extended disconnection hint — attended use, less critical)

3. **`web/src/components/events/LineupStateBanner.tsx`**
   - Add optional `showRecovered` prop
   - Add recovery message variant

### Files NOT Modified

- `useLineupPolling.ts` — Not used by either page currently
- `LineupDatePicker.tsx` — Unrelated
- `LineupControlSection.tsx` — Unrelated

### No New Dependencies

All changes use native browser APIs:
- `document.visibilityState`
- `document.addEventListener("visibilitychange")`
- `window.addEventListener("focus")`
- `setTimeout` / `clearTimeout`

---

## 10. Verdict

### ✅ SAFE TO PROCEED

**Rationale:**
1. All changes are additive (new useEffects, new state)
2. No modification to existing polling logic
3. All listeners have explicit cleanup patterns
4. No schema changes
5. No routing changes
6. No new dependencies
7. Fully removable without breaking anything

**Estimated effort:** 2-3 hours

**Recommended implementation order:**
1. Feature 1: Visibility/Focus refresh (highest value, lowest risk)
2. Feature 2: Recovery banner (high value, low risk)
3. Feature 3: Extended disconnection hint (lower priority, TV display only)

---

**HARD STOP: Awaiting Sami approval before implementation.**
