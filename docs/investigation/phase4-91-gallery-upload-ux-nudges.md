# Phase 4.91 — Gallery Upload UX Tightening

**Status:** ✅ COMPLETE — All quality gates pass
**Date:** 2026-01-26
**Goal:** Reduce "unassigned photo" creation by improving the upload flow with nudges and inline album creation awareness.

**Checked against DSC UX Principles:**
- §7 UX Friction — Friction is contextual, lightweight, and learnable (one-time confirmation with dismiss option)
- §8 Dead States — Combined with Phase 4.90 to eliminate the unassigned photo dead-end
- §10 Defaults Should Match Common Case — Label changed to "Album (recommended)" to guide toward organizing photos
- §11 Prefer Soft Constraints — Warns and nudges rather than blocking unassigned uploads

---

## 1. Problem Statement

Phase 4.90 fixed the dead-end UX for managing unassigned photos. However, the root cause remains: users can easily upload photos without selecting an album. This phase tightens the upload UX to:

1. Make users aware of their upload destination before uploading
2. Nudge users toward album selection without blocking uploads
3. Add friction for "unassigned" uploads (one-time confirm dialog)

---

## 2. Investigation Summary (STOP-GATE 1)

### Current Upload UI Location

**File:** `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx` (~742 lines)

### Current UX Flow

1. Album dropdown defaults to `""` (No album)
2. "No album" option text: `<option value="">No album</option>`
3. Label text: "Album (optional)"
4. Insert uses: `album_id: albumId || null`
5. No warning about unassigned destination
6. **Inline album creation already exists** (lines 453-528)

### Key Finding

Inline album creation (`+ New album` button → create form) already works correctly. The gaps are purely UX-related:
- No visual nudge when "No album" is selected
- No clear indication of upload destination
- No friction before uploading to unassigned

---

## 3. Implementation (STOP-GATE 2)

### Files Modified

| File | Change |
|------|--------|
| `UserGalleryUpload.tsx` | Added destination label, nudge banner, confirm dialog, updated label text |

### Files Created

| File | Purpose |
|------|---------|
| `__tests__/gallery-upload-ux-nudges.test.tsx` | 15 tests for UX behaviors |

### UX Changes

#### 1. Label Text Change
- Before: "Album (optional)"
- After: "Album (recommended)"

#### 2. Destination Label (Always Visible)
Shows above the dropzone:
- When album selected: "Uploading to: **Summer Photos**" (accent color)
- When no album: "Uploading to: **Unassigned Photos**" (amber color)

#### 3. Nudge Banner (Conditional)
Amber warning banner appears between metadata section and dropzone when no album is selected:
```
⚠️ No album selected
Photos uploaded without an album go to "Unassigned Photos" and won't appear
in the public gallery. Select or create an album above to organize your photos.
```

#### 4. One-Time Confirm Dialog
When clicking upload with no album selected (and user hasn't dismissed):
- Title: "Upload to Unassigned Photos?"
- Message: "This photo / These N photos will go to 'Unassigned Photos' and won't appear in the public gallery until you move it/them to an album."
- Checkbox: "Don't show this again"
- Buttons: "Go back" / "Upload anyway"

### localStorage Key

**Key name:** `dsc_gallery_unassigned_warning_dismissed_v1`

**Behavior:**
- Read on component mount
- Set to `"true"` when user checks "Don't show again" and confirms
- When set, confirm dialog is skipped entirely

---

## 4. Test Coverage

| Test Category | Tests | Coverage |
|---------------|-------|----------|
| Album Label Text | 1 | "Album (recommended)" shown, not "optional" |
| Destination Label | 3 | Shows album name / Unassigned, updates on change |
| Nudge Banner | 3 | Shows when no album, hides when album selected |
| Confirm Dialog | 4 | Shows/hides correctly, has all expected elements |
| localStorage | 2 | Checks on mount, uses correct key name |
| **Total** | **15** | Full UX contract |

---

## 5. Quality Gates

| Gate | Result |
|------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2673 passed (15 new) |
| Build | ✅ Success |

---

## 6. Before/After Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Album dropdown label | "Album (optional)" | "Album (recommended)" |
| Upload destination visibility | None | Always shows "Uploading to: X" |
| No album selected | No warning | Amber nudge banner appears |
| First unassigned upload | No friction | Confirm dialog appears |
| Subsequent unassigned uploads | No friction | Skipped if "Don't show again" was checked |
| Album selected | Same | Nudge hidden, dialog skipped |

---

## 7. Key Design Decisions

1. **Non-blocking:** Unassigned uploads still work - we add friction, not prevention
2. **One-time dialog:** Users who understand can dismiss permanently via checkbox
3. **Destination label always visible:** Clear feedback regardless of selection
4. **Nudge banner only when needed:** Clean UI when album is selected
5. **localStorage persistence:** Preference survives browser sessions

---

## 8. Files Reference

### Main Implementation
- `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx`
  - Lines 3: Added `useEffect` import
  - Lines 8: Added `AlertTriangle` icon import
  - Lines 170-184: New state + localStorage logic
  - Lines 324-360: `handleUploadClick` + `handleConfirmUnassigned` functions
  - Lines 699-720: Destination label + nudge banner
  - Lines 769-784: Confirm dialog render
  - Lines 787-849: `UnassignedConfirmDialog` component

### Tests
- `web/src/__tests__/gallery-upload-ux-nudges.test.tsx` (15 tests)

---

## 9. Relationship to Phase 4.90

- **Phase 4.90:** Fixed the dead-end for managing existing unassigned photos
- **Phase 4.91:** Reduces creation of new unassigned photos through UX friction

Together, these phases provide a complete solution:
1. Existing unassigned photos can be managed (4.90)
2. Future unassigned photos are less likely to be created (4.91)
