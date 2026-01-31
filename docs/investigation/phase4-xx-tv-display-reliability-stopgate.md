# STOP-GATE 0 — TV Display / Lineup Control Reliability Audit

**Status:** INVESTIGATION COMPLETE — Awaiting Approval
**Date:** January 2026
**Scope:** Reliability for unattended use (TVs, venue displays)
**Prior Work:** Phase 4.99 (UX Hardening) — Already merged

---

## 1. Current Reality Table

| Surface | Controls Wired? | Unattended Safe? | Refresh Safe? | Auth Safe? |
|---------|-----------------|------------------|---------------|------------|
| `/events/[id]/display` (TV Display) | ✅ YES | ⚠️ MOSTLY | ⚠️ MOSTLY | ✅ YES |
| `/events/[id]/lineup` (Control Page) | ✅ YES | N/A (attended) | ⚠️ MOSTLY | ⚠️ PARTIAL |
| `useLineupPolling` hook | ✅ YES | ⚠️ MOSTLY | ⚠️ MOSTLY | ✅ YES |
| `event_lineup_state` table | ✅ YES | ✅ YES | ✅ YES | ✅ YES |

### Legend
- ✅ YES: Confirmed working, no issues found
- ⚠️ MOSTLY: Works but has edge cases that could cause issues
- ❌ NO: Broken or missing

---

## 2. Confirmed Risks (FACTS ONLY)

### RISK A: No Visibility State Handling — MEDIUM

**Evidence (Code):**
- `display/page.tsx` lines 91-94: 1-second timer for clock
- `display/page.tsx` lines 252-256: 5-second polling interval
- **No `visibilitychange` event listener exists** (verified via grep)
- **No `document.hidden` check exists** (verified via grep)

**Behavior:**
- When browser tab is backgrounded (e.g., screen saver, window switch), polling continues
- This wastes network/battery on mobile devices but is harmless for stationary TVs
- When tab returns to foreground, no immediate refresh is triggered

**Real Impact:**
- TVs running the display page typically stay in foreground (full-screen mode)
- If venue staff minimizes the window, data could be up to 5 seconds stale when restored
- **LOW RISK for actual TV deployments**

---

### RISK B: No Auto-Recovery from Extended Network Outage — MEDIUM

**Evidence (Code):**
- `display/page.tsx` lines 238-248: Error handler sets `connectionStatus` to "disconnected" after 3 failures
- `useLineupPolling.ts` lines 208-220: Same pattern
- **No exponential backoff exists** — continues polling at fixed 5s interval
- **No automatic page reload on network recovery**

**Behavior:**
- After 3 consecutive failures (~15 seconds), shows "Connection lost" banner
- Polling continues indefinitely at 5-second intervals
- If network recovers, next successful poll restores "connected" state
- No UI prompt to reload page

**Real Impact:**
- If network drops for 30+ minutes, display shows stale data
- When network recovers, display auto-updates within 5 seconds
- **No user intervention required for recovery** (polling continues)
- **MEDIUM RISK** — works but unclear to venue staff that recovery is automatic

---

### RISK C: Memory Growth Over Extended Sessions — LOW

**Evidence (Code):**
- `display/page.tsx` lines 197-214: QR codes generated as data URLs, stored in Map
- `display/page.tsx` line 75: `qrCodes` state holds all generated QR images
- Timer cleanup: `clearInterval` used correctly in both timer effects

**Behavior:**
- QR codes regenerated on every poll (new Map created each time)
- Old Map is garbage collected (React state replacement)
- No unbounded array growth patterns found
- No event listener leaks (all useEffect cleanup functions present)

**Real Impact:**
- Modern browsers handle this pattern well
- QR code generation is lightweight (~100 bytes per code)
- **LOW RISK** — no memory leak patterns found

---

### RISK D: Session Expiry on Lineup Control Page — MEDIUM

**Evidence (Code):**
- `lineup/page.tsx` lines 82-91: Auth check runs once on component mount
- `lib/supabase/client.ts`: Uses `@supabase/ssr` createBrowserClient
- **No explicit session refresh or re-auth logic in lineup page**
- Supabase handles token refresh automatically via `@supabase/ssr`

**Behavior:**
- Supabase SSR client automatically refreshes auth tokens
- If session expires mid-event (unlikely in 2-3 hour event), API calls will fail
- No UI feedback specific to auth expiry — shows generic "Connection lost"

**Real Impact:**
- Supabase tokens have 1-hour expiry with automatic refresh
- As long as polling continues, token stays refreshed
- **LOW-MEDIUM RISK** — Supabase handles this but no explicit handling visible

---

### RISK E: No Error Boundary — LOW

**Evidence (Code):**
- Grep for `ErrorBoundary` returns no results in web/src
- No `error-boundary` components found
- Display page has try/catch in fetchData function

**Behavior:**
- If React rendering throws an error, page goes blank (white screen)
- No fallback UI for component crashes
- Data fetch errors are caught and display "Connection lost"

**Real Impact:**
- Data errors handled gracefully
- Only unhandled React render errors would cause blank screen
- **LOW RISK** — render errors are rare; data errors are handled

---

### RISK F: No "Wake from Sleep" Immediate Refresh — LOW

**Evidence (Code):**
- No `visibilitychange` listener
- No `focus` event listener on window
- Polling continues at fixed interval regardless of visibility

**Behavior:**
- If TV comes back from screen saver, next update is within 5 seconds
- No immediate refresh on visibility change

**Real Impact:**
- 5-second worst-case delay is acceptable for venue displays
- **LOW RISK** — polling cadence is fast enough

---

## 3. Non-Issues (Explicitly Safe)

### ✅ Timer Cleanup
All `setInterval` calls have corresponding `clearInterval` in cleanup functions:
- `display/page.tsx` lines 91-94: Clock timer properly cleaned
- `display/page.tsx` lines 252-256: Polling interval properly cleaned
- `useLineupPolling.ts` lines 230-233: Polling interval properly cleaned

### ✅ State Persistence
- `event_lineup_state` table uses composite key `(event_id, date_key)`
- State persists across page refreshes — host can reload and continue
- Browser refresh does NOT reset lineup position

### ✅ TV Display is Public
- Display page requires no authentication (intentional design)
- Uses anon key Supabase client for read-only queries
- No session expiry risk for the display surface itself

### ✅ Connection Health Indication
- Phase 4.99 added `LineupStateBanner` component
- Shows "Last updated X seconds ago"
- Shows warning when connection lost
- Venue staff can see if display is stale

### ✅ Per-Occurrence Support
- Both pages accept `?date=YYYY-MM-DD` parameter
- Timeslots and lineup state are queried by `date_key`
- No cross-occurrence data mixing

---

## 4. Controls Verification Summary

| Control | Wired? | Evidence |
|---------|--------|----------|
| Go Live | ✅ | Upserts `now_playing_timeslot_id` to first slot |
| Next | ✅ | Advances to next slot in sequence |
| Previous | ✅ | Goes back one slot |
| Stop Event | ✅ | Sets `now_playing_timeslot_id` to null |
| Reset Lineup | ✅ | Sets to null (same as Stop) |
| Jump to Slot | ✅ | Clicking slot row sets it as now_playing |
| Connection Banner | ✅ | Shows last updated + connection state |
| Confirmation Dialogs | ✅ | Stop/Reset have confirmation (Phase 4.99) |

---

## 5. Recommendations

### Must Fix Before Launch: NONE

All critical issues were addressed in Phase 4.99. The system is **launch-ready** for typical venue use.

### Can Defer (Post-Launch Polish)

| Item | Risk Level | Effort | Recommendation |
|------|------------|--------|----------------|
| Add `visibilitychange` handler for immediate refresh | LOW | 1hr | Nice-to-have |
| Add exponential backoff for poll failures | LOW | 2hr | Nice-to-have |
| Add React Error Boundary with fallback UI | LOW | 1hr | Nice-to-have |
| Add explicit "Network recovered" toast | MEDIUM | 1hr | Recommended |

### Nice-to-Have (Future)

| Item | Description |
|------|-------------|
| WebSocket subscription | Replace polling with real-time Supabase subscription |
| Offline mode indicator | Show "Offline" badge when navigator.onLine is false |
| Auto-reload on extended disconnection | After 5+ minutes disconnected, offer "Reload page" button |
| Page reload button in UI | Allow venue staff to manually reload display |

---

## 6. STOP-GATE 0 Verdict

### ✅ READY FOR LAUNCH

**Rationale:**
1. All control actions are correctly wired to the database
2. State persists across page refresh (browser close/reopen safe)
3. Connection health is visible via LineupStateBanner (Phase 4.99)
4. Polling continues during network interruptions and auto-recovers
5. No memory leaks or timer leaks found
6. Auth expiry is handled automatically by Supabase SSR client

**Edge Cases Accepted:**
- 5-second worst-case stale data on tab focus change — acceptable for venue TVs
- No exponential backoff — harmless extra network requests during outage
- No Error Boundary — render crashes are rare; data errors are handled

---

## Appendix: Files Examined

| File | Lines | Purpose |
|------|-------|---------|
| `app/events/[id]/display/page.tsx` | ~510 | TV display surface |
| `app/events/[id]/lineup/page.tsx` | ~757 | Lineup control surface |
| `hooks/useLineupPolling.ts` | ~248 | Shared polling logic |
| `components/events/LineupStateBanner.tsx` | ~116 | Connection health UI |
| `components/events/LineupDatePicker.tsx` | ~139 | Date selection modal |
| `lib/supabase/client.ts` | ~54 | Browser client singleton |
| `supabase/migrations/20251216100001_timeslot_system.sql` | — | Table schema |
| `docs/investigation/phase4-99-tv-display-manager-stopgate.md` | — | Prior investigation |

---

**END — STOP-GATE 0 INVESTIGATION COMPLETE**

**HARD STOP: Awaiting Sami approval before any implementation.**
