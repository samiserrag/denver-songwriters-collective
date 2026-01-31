# Phase 4.109: TV Poster Mode "Final 10%" - Layout, QR, CTA, Fit-20

**Status:** Implementation complete. All quality gates pass.

## Goal

Complete TV Poster Mode to be pixel-perfect for live events with:
- Zero clipping for up to 20 slots
- 2-column adaptive layout for Up Next
- Consistent black/white QR codes
- Large CTA text in header
- Same-size QR tiles with updated labels

## Hard Requirements from Feedback

| # | Requirement | Current State | Fix |
|---|-------------|---------------|-----|
| 1 | Use empty space - remove horizontal band | Large gap between header and content | Add CTA text in header, tighten layout |
| 2 | Up Next = 2 columns when needed | Single column only | CSS Grid 2-col when >10 slots |
| 3 | Adaptive slot sizing | Fixed sizing per tier | Scale based on slot count |
| 4 | Now Playing smaller vertically | Takes too much space | Reduce vertical footprint |
| 5 | Now Performing name bigger | QR dominates | Increase name size relative to QR |
| 6 | Performer QR black/white | Uses gold `#d4a853` on transparent | Change to `#000000` on `#ffffff` |
| 7 | Add CTA text in header | Empty space exists | "Scan the QR codes to Follow and Support the Artists and our Collective" |
| 8 | Top-right QR pair same size, new labels | Different sizes, "Join DSC" / "This Event" | Equal size, "OUR COLLECTIVE" / "EVENT PAGE" |
| 9 | Cover art contain-fit | Uses object-contain (✓ correct) | Verify stable across Go Live |
| 10 | Layout stability | Computed from timeslots.length | Verify no tier jumps |

## Implementation Plan

### B1) Stable density computation (VERIFY)
- Already uses `timeslots.length` (Phase 4.108)
- Confirm no regression

### B2) Up Next 2-column adaptive layout
```tsx
// When >10 slots, use 2 columns
const use2Columns = upNextSlots.length > 10;

<div className={`grid ${use2Columns ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
  {/* slots */}
</div>
```

### B3) Adaptive slot sizing
```tsx
// Slot count determines sizing, not tier
const slotDisplayCount = Math.min(allUpNextSlots.length, 20);
const slotSize = slotDisplayCount <= 10 ? 'large' : 'small';
```

### B4) Now Playing card tune
- Reduce avatar from 140px to 100px
- Reduce vertical padding
- Increase name from `text-3xl` to `text-4xl`

### B5) Performer QRs everywhere
- Already showing for all performers (Phase 4.108)
- Fix color to black/white

### B6) QR color consistency
Change from:
```tsx
color: { dark: "#d4a853", light: "#00000000" }
```
To:
```tsx
color: { dark: "#000000", light: "#ffffff" }
```

### B7) Header CTA + QR label changes
Add centered CTA in header gap:
```tsx
<p className="text-center text-gray-300 text-sm">
  Scan the QR codes to Follow and Support the Artists and our Collective
</p>
```

QR labels:
- "Join DSC" → "OUR COLLECTIVE"
- "This Event" → "EVENT PAGE"
- Both QRs same 80px size

### B8) Flyer contain-fit
- Already uses `object-contain` (verified)
- Add `aspect-[2/3]` container to lock height

## Files to Modify

| File | Changes |
|------|---------|
| `app/events/[id]/display/page.tsx` | All TV mode changes |
| `__tests__/phase4-108-tv-poster-mode.test.ts` → rename to `phase4-109` | Updated tests |

## Test Plan

1. Density tier stable across live/not-live
2. Up Next renders 2 columns when >10 slots
3. Performer QR uses `#000000`/`#ffffff`
4. QR labels are "OUR COLLECTIVE" and "EVENT PAGE"
5. Flyer uses object-contain
6. 10-slot scenario fits (1 column)
7. 20-slot scenario fits (2 columns)

## Checklist

- [x] Investigation document exists
- [x] Implementation complete
- [x] Tests updated (phase4-109-tv-poster-mode.test.ts - 31 tests)
- [x] Lint passes (0 errors, 0 warnings)
- [x] Tests pass (3224 total)
- [x] Build succeeds
- [ ] Manual smoke: 10-slot, 20-slot scenarios
- [ ] Screenshots before/after
- [ ] CLAUDE.md updated
