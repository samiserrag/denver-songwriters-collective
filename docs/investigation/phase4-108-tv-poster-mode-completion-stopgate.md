# Phase 4.108: TV Poster Mode Completion — STOP-GATE Investigation

**Goal:** Finish TV Poster Mode to be pixel-max, stable, and complete for live events.

**Status:** COMPLETE. All quality gates pass (lint 0, tests 3223, build success).

---

## 0) Current State Analysis

### File Under Review
`web/src/app/events/[id]/display/page.tsx`

### Current TV Mode Layout Structure (lines 597-990)

```
fixed inset-0 z-[9999] overflow-hidden
├── Background (absolute inset-0, SVG noise texture)
├── Content layer (relative z-10 h-full flex flex-col p-8)
│   ├── LineupStateBanner (subtle)
│   ├── Header (flex items-start justify-between mb-6)
│   │   ├── Left: Date box + Event title + venue + time
│   │   └── Right: LIVE badge + Event QR
│   ├── Host badges row (mb-6)
│   └── Main content (flex-1 grid grid-cols-12 gap-6 min-h-0)
│       ├── Flyer panel (col-span-3, if cover exists)
│       ├── Now Playing (col-span-4 or 5)
│       └── Up Next (col-span-5 or 7, flex-col min-h-0)
```

---

## 1) Issue: Layout Instability on "Go Live"

### Root Cause Analysis

**Current behavior (line 585):**
```typescript
const densityTier = getDensityTier(upNextSlots.length);
```

`upNextSlots` is computed from `timeslots.filter((_, idx) => idx > currentSlotIndex)` (line 572).

**Problem:** When host clicks "Go Live" (sets `now_playing_timeslot_id`):
- `currentSlotIndex` changes from -1 to 0
- `upNextSlots.length` decreases by 1 (the now-playing slot is removed)
- `densityTier` can change (e.g., 9 slots → 8 slots = medium → large)
- This causes visual reflow: spacing, typography, and QR visibility all change

### Proposed Fix

Compute tier from **total timeslots** (stable), not from **remaining slots** (variable):

```typescript
// BEFORE (line 585)
const densityTier = getDensityTier(upNextSlots.length);

// AFTER
const densityTier = getDensityTier(timeslots.length);
```

**Rationale:** The total number of timeslots doesn't change during the event. This gives a stable layout regardless of "now playing" state.

---

## 2) Issue: Up Next List Clipping

### Root Cause Analysis

The Up Next panel uses:
- `flex-1 overflow-hidden` (line 835)
- Parent: `flex-1 grid grid-cols-12 gap-6 min-h-0` (line 762)

The `flex-1` should expand to fill available space, but the combination of:
1. Fixed header height
2. Host badges row
3. CSS Grid with `flex-1` parent
4. `overflow-hidden` on the list container

...causes the list to be clipped when there are many slots.

### Current Height Chain
```
100vh (fixed inset-0)
└── p-8 (32px padding top/bottom = 64px total)
    └── flex flex-col h-full
        ├── Header (variable, ~140-170px depending on title length)
        ├── Host badges (variable, ~100-130px if present)
        └── Main content grid (flex-1 min-h-0)
            └── Up Next col (flex-1 overflow-hidden)
```

### Proposed Fix

1. **Remove fixed header/host heights** by using CSS Grid with `minmax(0, auto)` for header rows
2. **Ensure Up Next fills remaining space** with `minmax(0, 1fr)` for the content row
3. **Add auto-fit row sizing** for Up Next items based on available height

**New layout structure:**
```tsx
<div className="relative z-10 h-full grid grid-rows-[auto_auto_1fr] p-6">
  {/* Row 1: Header - auto height */}
  <header className="...">...</header>

  {/* Row 2: Host badges - auto height */}
  {allHosts.length > 0 && <div className="...">...</div>}

  {/* Row 3: Main content - fills remaining space */}
  <div className="grid grid-cols-12 gap-4 min-h-0">
    {/* Flyer | Now Playing | Up Next */}
  </div>
</div>
```

For Up Next items, calculate row height dynamically:
```typescript
// Calculate available height and distribute among slots
const upNextItemHeight = densityTier === "large" ? 72 : densityTier === "medium" ? 56 : 40;
```

---

## 3) Issue: QR Codes Only for Now Playing + Next Up

### Current Behavior (lines 902-912)
```typescript
{/* Only show QR for next up performer (index 0) in large tier */}
{densityTier === "large" && index === 0 && qrCodes.get(slot.claim.member.id) && (
  ...
)}
```

### Proposed Fix

Show QR for ALL performers with profiles, with adaptive sizes:

```typescript
// Large tier: 56px QR for all
// Medium tier: 44px QR for all
// Compact tier: 32px QR for index 0-2, none for rest

{qrCodes.get(slot.claim.member.id) && (
  (() => {
    if (densityTier === "compact" && index > 2) return null;
    const qrSize = densityTier === "large" ? 56 : densityTier === "medium" ? 44 : 32;
    return (
      <div className="bg-white rounded-md p-1 flex-shrink-0">
        <Image src={qrCodes.get(slot.claim.member.id)!} alt="QR" width={qrSize} height={qrSize} />
      </div>
    );
  })()
)}
```

**Note:** QR codes are already generated for ALL performers with profiles (lines 396-413). Only the rendering is gated.

---

## 4) Issue: HOST Label Not Prominent

### Current Behavior (lines 735-742)
```typescript
<p className={`text-xs uppercase tracking-wider ${
  h.role === "host"
    ? "text-[var(--color-accent-primary)] font-bold"
    : "text-gray-400"
}`}>
  {h.role === "host" ? "★ HOST" : "Co-host"}
</p>
```

### Proposed Fix

Make HOST label significantly larger and more visually distinct:

```typescript
{/* Role badge - prominent for HOST */}
{h.role === "host" ? (
  <div className="px-3 py-1 bg-[var(--color-accent-primary)] rounded-full">
    <span className="text-sm font-bold text-black uppercase tracking-wider">★ HOST</span>
  </div>
) : (
  <span className="text-xs text-gray-400 uppercase tracking-wider">Co-host</span>
)}
```

Move the label above the name instead of below for better hierarchy.

---

## 5) Issue: Cover Art Cropping

### Current Behavior (lines 767-774)
```typescript
<Image
  src={displayCoverImage}
  alt={event?.title || "Event flyer"}
  width={400}
  height={600}
  className="w-full h-full object-cover"
  priority
/>
```

`object-cover` crops the image to fill the container.

### Proposed Fix

Use `object-contain` with a dark background for letterboxing:

```typescript
<div className="flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-gray-900">
  <Image
    src={displayCoverImage}
    alt={event?.title || "Event flyer"}
    width={400}
    height={600}
    className="w-full h-full object-contain"
    priority
  />
</div>
```

---

## 6) Issue: Times in Now Playing Card

### Current Behavior (lines 805-806)
```typescript
<p className="text-xl text-[var(--color-text-accent)]">
  {formatSlotTime(event?.start_time || null, nowPlayingSlot.start_offset_minutes, nowPlayingSlot.duration_minutes)}
</p>
```

### Proposed Fix

1. **Remove slot times from Now Playing card** (delete lines 805-807)
2. **Add event time window to header** (after venue name):

```typescript
{/* Event time window */}
{event?.start_time && (
  <p className="text-xl text-[var(--color-text-accent)] mt-1">
    {formatEventTimeWindow(event.start_time, event.end_time)}
  </p>
)}

// Helper function
function formatEventTimeWindow(startTime: string, endTime: string | null): string {
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (endTime) {
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  }
  return `Starts ${formatTime(startTime)}`;
}
```

**Note:** Need to add `end_time` to the event query (line 285).

---

## 7) Issue: Missing DSC Join QR + Messaging

### Proposed Addition

Add a "Join DSC" section in the top-right area, above the Event QR:

```typescript
{/* DSC Join CTA */}
<div className="flex flex-col items-end gap-2 mb-4">
  <p className="text-xs text-gray-400 uppercase tracking-wider">Join the Collective</p>
  <div className="bg-white rounded-lg p-2 shadow-lg">
    <Image src={dscJoinQrCode} alt="Join DSC" width={80} height={80} className="rounded" />
  </div>
</div>
```

Add QR generation:
```typescript
const [dscJoinQrCode, setDscJoinQrCode] = React.useState<string | null>(null);

// In useEffect with other QR generation
const joinUrl = `${SITE_URL}/`;
const joinQr = await QRCode.toDataURL(joinUrl, {
  width: 80,
  margin: 1,
  color: { dark: "#1a1a1a", light: "#ffffff" },
});
setDscJoinQrCode(joinQr);
```

Add messaging near performer QRs:
```typescript
{/* Guidance text */}
<p className="text-xs text-gray-500 italic mt-2">Scan a performer to follow + tip</p>
```

---

## 8) Issue: Empty Band / Wasted Space

### Root Cause

1. Header has `mb-6` (24px)
2. Host badges have `mb-6` (24px)
3. Main content has `p-8` (32px)
4. Large gaps accumulate

### Proposed Fix

1. Reduce padding: `p-8` → `p-6`
2. Reduce margins: `mb-6` → `mb-4`
3. Reduce gaps: `gap-6` → `gap-4`
4. Ensure content expands to fill available space using CSS Grid `1fr`

---

## Implementation Plan

### Files to Modify

| File | Changes |
|------|---------|
| `web/src/app/events/[id]/display/page.tsx` | All 8 issues |

### Detailed Changes

#### 1. Add `end_time` to EventInfo interface and query
```typescript
// Line 54-68: Add to interface
end_time: string | null;

// Line 285: Add to query select
.select("..., end_time, ...")
```

#### 2. Add `formatEventTimeWindow` helper
```typescript
// After line 103
function formatEventTimeWindow(startTime: string, endTime: string | null): string {
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };
  if (endTime) {
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  }
  return `Starts ${formatTime(startTime)}`;
}
```

#### 3. Add DSC Join QR state and generation
```typescript
// Line 133: Add state
const [dscJoinQrCode, setDscJoinQrCode] = React.useState<string | null>(null);

// In Event QR useEffect (line 489-514): Add DSC join QR generation
```

#### 4. Fix density tier computation
```typescript
// Line 585: Change from upNextSlots.length to timeslots.length
const densityTier = getDensityTier(timeslots.length);
```

#### 5. Restructure TV mode layout
```typescript
// Lines 597-990: Significant restructure
// - Change flex-col to grid-rows-[auto_auto_1fr]
// - Reduce padding/margins
// - Fix Up Next height calculation
```

#### 6. Fix cover art cropping
```typescript
// Line 773: Change object-cover to object-contain, add bg-gray-900
```

#### 7. Remove Now Playing times, add event time window to header
```typescript
// Line 655-663: Update to show event time window
// Lines 805-807: Remove slot time display
```

#### 8. Make HOST label prominent
```typescript
// Lines 735-742: Replace with prominent badge
```

#### 9. Show QR for all performers
```typescript
// Lines 902-912: Remove index === 0 gate, add adaptive sizing
```

#### 10. Add DSC Join CTA and performer guidance
```typescript
// In header right side, add DSC Join QR
// After performer QR, add guidance text
```

---

## Test Plan

### New Tests to Add

| Test | Description |
|------|-------------|
| Density tier stable on Go Live | Verify tier doesn't change when now_playing_timeslot_id is set |
| Cover art uses object-contain | Assert className contains object-contain |
| Up Next renders up to 20 items | With 20 slots, verify all render |
| QR for all claimed performers | Each claimed slot should have QR in large/medium tier |
| DSC Join QR exists in TV mode | Verify QR with homepage URL is rendered |
| Event time window in header | If end_time exists, show range; else show "Starts X" |
| No slot times in Now Playing | Verify formatSlotTime not called for now playing |

### Manual Smoke Tests

1. Load TV mode with 10 slots → all visible, QRs for all
2. Load TV mode with 20 slots → compact tier, all visible
3. Click "Go Live" → no layout reflow
4. Upload tall/wide flyer → fully visible (letterboxed)
5. View from 8-12 feet → HOST label clearly readable
6. Scan DSC QR → goes to homepage
7. Scan performer QR → goes to profile

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Layout changes affect non-TV mode | TV mode is isolated in `if (tvMode)` block |
| QR generation performance | Already memoized, no change to generation logic |
| Height calculation on different screens | Use CSS Grid with fr units, not fixed heights |

---

## STOP-GATE

**Awaiting approval before implementation.**

Changes are isolated to TV mode only. Quality gates (lint, test, build) will be verified before merge.

---

## Checklist

- [x] Investigation document exists
- [x] Stop-gate approval received from Sami
- [x] Implementation complete
- [x] Tests added (30 new tests)
- [x] Lint passes (0 errors, 0 warnings)
- [x] Tests pass (3223 total)
- [x] Build succeeds
- [x] CLAUDE.md updated
