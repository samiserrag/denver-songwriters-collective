# Phase 7A — Media UX Clarity: Execution Plan

**Status:** STOP — awaiting Sami approval before code edits
**Branch:** main
**HEAD at plan time:** 5faa664
**Investigation:** `docs/investigation/phase7a-media-ux-clarity-stopgate.md`
**Date:** 2026-02-06
**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States), §10 (Defaults), §14 (Confusing = Wrong)

---

## 1. Scope and Non-Goals

### In Scope (Targeted Fixes)

| Priority | Description |
|----------|-------------|
| **P0** | Unify dual event cover upload paths — eliminate orphan storage risk |
| **P1a** | Copy/terminology consistency across all 7 media surfaces |
| **P1b** | Delete-pattern consistency — unassigned gallery hard-delete → soft-delete |
| **P2a** | Storage path pattern and file-size limit consistency (10 MB standard) |
| **P2b** | Theme token cleanup on EventPhotosSection hardcoded colors |
| **P2c** | Aspect ratio alignment — EventForm cover upload → 3:2 |

### Non-Goals (Deferred)

- Full media-system rewrite (shared `useMediaUpload` hook, unified `MediaManager` component)
- Storage bucket consolidation (4 buckets → 1)
- Adding auto-cover behavior to VenuePhotosSection or BlogPostForm
- Venue upload aspect ratio change (16:9 is intentional for landscape venue photos)
- ProfilePhotosSection aspect ratio change (1:1 is intentional for avatars)
- Database schema changes or migrations
- RLS policy changes
- New components or abstractions

---

## 2. Work Packages

### WP-P0: Unify Event Cover Upload Path

**Objective:** EventForm cover upload should use the same `{eventId}/{uuid}.{ext}` storage path as EventPhotosSection and create an `event_images` row, eliminating orphan files that exist only in storage with no DB record.

**Problem:** EventForm uploads to `{userId}/{timestamp}.{ext}` (line 374) and only sets `events.cover_image_url` — no `event_images` row created. EventPhotosSection uploads to `{eventId}/{uuid}.{ext}` (line 54) and creates both an `event_images` row AND sets cover. This means EventForm covers are invisible in EventPhotosSection's grid and orphaned in storage if the cover is later changed.

**Exact files to change:**

| File | Lines | Change |
|------|-------|--------|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | 368–391 | Rewrite `handleImageUpload` to: (1) use `{eventId}/{uuid}.{ext}` path pattern, (2) insert `event_images` row, (3) set `events.cover_image_url`. For CREATE mode (no eventId yet), defer upload to post-creation or use current path with a TODO for future reconciliation. |
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | 393–395 | Update `handleImageRemove` to soft-delete the `event_images` row (set `deleted_at`) and clear `events.cover_image_url`. |

**Behavior change summary:**

| Before | After |
|--------|-------|
| EventForm cover → `{userId}/{timestamp}` in storage, no DB row | EventForm cover → `{eventId}/{uuid}` in storage + `event_images` row |
| Changing cover orphans old file in storage | Changing cover soft-deletes old `event_images` row |
| EventPhotosSection grid doesn't show EventForm-uploaded covers | All event covers appear in EventPhotosSection grid |

**Create-mode edge case:** When creating a NEW event (no `eventId` yet), the upload must happen AFTER the event is created. Two options:
- **Option A (Preferred):** Store file in local state, upload after event creation in `handleSubmit`. This is the pattern already used for deferred uploads in EventCreateForm.
- **Option B:** Upload to a temp path `pending/{uuid}.{ext}`, move after event creation.

**Risk/rollback plan:**
- Risk: Create-mode deferred upload adds complexity to `handleSubmit`.
- Risk: Existing orphan files from previous EventForm uploads remain in storage (no migration needed — they're harmless, just wasted space).
- Rollback: Revert the `handleImageUpload` and `handleImageRemove` functions to previous implementation.

**Acceptance criteria:**
1. In edit mode, EventForm cover upload creates `event_images` row with correct `event_id`
2. In edit mode, uploaded cover appears in EventPhotosSection grid
3. In create mode, cover image uploads successfully after event creation
4. Removing a cover soft-deletes the `event_images` row (sets `deleted_at`)
5. No new orphan storage files created

---

### WP-P1a: Copy and Terminology Consistency

**Objective:** Standardize upload helper text, labels, and recommendations across all 7 media surfaces to eliminate contradictory guidance.

**Exact files to change:**

| File | Lines | Current Copy | New Copy |
|------|-------|-------------|----------|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | 1924–1926 | "Recommended: 1200×900px (4:3). Most phone photos are already 4:3." | "Recommended: 1200×800px (3:2). Max 10 MB." |
| `web/src/components/events/EventPhotosSection.tsx` | 218–219 | "Add photos for {eventTitle}. Click on an image to set it as the cover photo." | "Add photos for {eventTitle}. Hover over a photo to set it as the cover." |
| `web/src/components/venue/VenuePhotosSection.tsx` | 190–191 | "Upload photos of {venueName}. Choose one to display as the cover image." | "Upload photos of {venueName}. Hover over a photo to set it as the cover." |
| `web/src/components/venue/VenuePhotosSection.tsx` | 206–207 | "Click or drag to upload. JPG, PNG, WebP, or GIF. Max 5MB." | "Click or drag to upload. JPG, PNG, WebP, or GIF. Max 10 MB." |
| `web/src/components/profile/ProfilePhotosSection.tsx` | (helper text near upload) | Confirm current copy, align to "Max 10 MB" if not already | Update to "Max 10 MB" if currently says 5 MB |

**Behavior change summary:**
- All surfaces consistently say "Hover over a photo" (not "Click on an image") for set-as-cover
- All surfaces show "Max 10 MB" in file size guidance
- EventForm recommendation text reflects the 3:2 aspect ratio decision

**Risk/rollback plan:**
- Risk: Zero — copy-only changes, no logic affected.
- Rollback: Revert text strings.

**Acceptance criteria:**
1. No surface says "Max 5MB" — all say "Max 10 MB"
2. All "set as cover" instructions use consistent verb ("Hover over a photo")
3. EventForm recommendation says 3:2, not 4:3

---

### WP-P1b: Delete-Pattern Consistency (Gallery Hard-Delete → Soft-Archive)

**Objective:** Change UnassignedPhotosManager from hard-delete to soft-archive using the **existing** `is_hidden` field on `gallery_images`, matching the gallery system's established visibility model.

**Problem:** UnassignedPhotosManager is the ONLY surface that permanently removes `gallery_images` rows (lines 107–110). This is inconsistent and irreversible. The gallery system already has a visibility model (`is_hidden` boolean) used throughout the codebase — `dashboard/gallery/page.tsx` filters `.eq("is_hidden", false)` (line 58), and `AlbumManager.tsx` uses `is_hidden` for admin moderation.

**Schema-safe approach:** The `gallery_images` table does NOT have a `deleted_at` column (unlike `event_images` and `venue_images`). Instead of adding a new column (which would require a migration — declared non-goal), this WP uses the existing `is_hidden = true` field. The Photo interface in `UnassignedPhotosManager.tsx` already declares `is_hidden: boolean` (line 14), and the dashboard gallery page already excludes hidden photos from queries.

**Exact files to change:**

| File | Lines | Change |
|------|-------|--------|
| `web/src/app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx` | 106–117 | Replace `.delete().eq("id", photoId)` with `.update({ is_hidden: true }).eq("id", photoId)` |
| `web/src/app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx` | 96–98 | Update confirmation text from "This cannot be undone." to "Photos will be hidden. An admin can restore them if needed." |

**Behavior change summary:**

| Before | After |
|--------|-------|
| Delete permanently removes row from `gallery_images` | Delete sets `is_hidden = true` (row preserved, excluded from queries) |
| "This cannot be undone" confirmation text | "Photos will be hidden. An admin can restore them if needed." text |
| Deleted photos gone forever | Hidden photos recoverable via admin `is_hidden = false` update |

**Why `is_hidden` and not a new column:**
- `is_hidden` already exists on `gallery_images` (no migration needed)
- `dashboard/gallery/page.tsx` line 58 already filters `.eq("is_hidden", false)` — hidden photos are automatically excluded
- `dashboard/gallery/page.tsx` line 91 already tracks hidden count: `myPhotos?.filter(p => p.is_hidden).length`
- `UnassignedPhotosManager.tsx` already renders a "Hidden" badge for `is_hidden` photos (lines 240–246)
- This is the same pattern used by admin moderation in `AlbumManager.tsx`

**Risk/rollback plan:**
- Risk: Hidden photos still count against storage. Acceptable — admin can hard-delete via DB if needed.
- Rollback: Revert to `.delete()` call.

**Acceptance criteria:**
1. Deleting unassigned photos sets `is_hidden = true` instead of removing the row
2. Hidden photos no longer appear in the unassigned photos grid (already guaranteed by existing `.eq("is_hidden", false)` filter)
3. Confirmation dialog text updated
4. No regression in gallery album or photo views
5. No migration required — uses existing `is_hidden` column only

---

### WP-P2a: Storage Path and File-Size Consistency

**Objective:** Standardize `maxSizeMB` to 10 across all upload surfaces. Standardize storage paths to `{entityType}/{entityId}/{uuid}.{ext}` pattern where feasible without breaking existing URLs.

**File-size changes:**

| File | Line | Current | New |
|------|------|---------|-----|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | 1921 | `maxSizeMB={5}` | `maxSizeMB={10}` |
| `web/src/components/events/EventPhotosSection.tsx` | 232 | `maxSizeMB={5}` | `maxSizeMB={10}` |
| `web/src/components/venue/VenuePhotosSection.tsx` | 200 | `maxSizeMB={5}` | `maxSizeMB={10}` |
| `web/src/components/profile/ProfilePhotosSection.tsx` | 214 | `maxSizeMB={5}` | `maxSizeMB={10}` |

**Surfaces already at 10 MB (no change needed):**
- `BlogPostForm.tsx` line 417: `maxSizeMB={10}` (cover image)
- `BlogPostForm.tsx` line 599: `maxSizeMB={10}` (inline images)
- `UserGalleryUpload.tsx` line 297: `maxSize = 10 * 1024 * 1024` (gallery bulk)

**Storage path — NOT changing in this tract:**
- VenuePhotosSection uses `avatars` bucket with `venues/{venueId}/...` — changing bucket would break existing URLs. Deferred to full media rewrite.
- ProfilePhotosSection uses `avatars` bucket with `profile-gallery/{userId}/...` — same reason.
- EventForm path change is handled in WP-P0.

**Behavior change summary:**
- All 7 media surfaces accept files up to 10 MB (was 5 MB on 4 surfaces)
- No storage path changes except EventForm (covered in WP-P0)

**Risk/rollback plan:**
- Risk: Larger files increase Supabase storage costs. Acceptable — 10 MB is already the standard on 3 surfaces.
- Risk: Larger files may slow upload on poor connections. Acceptable — users already upload 10 MB to gallery.
- Rollback: Change `maxSizeMB` values back to 5.

**Acceptance criteria:**
1. All 7 upload surfaces accept 10 MB files
2. No surface rejects a 7 MB image upload
3. Existing images continue to display correctly

---

### WP-P2b: Theme Token Cleanup (EventPhotosSection)

**Objective:** Replace hardcoded `emerald-500` colors in EventPhotosSection with theme-aware CSS custom properties, matching VenuePhotosSection's pattern.

**Exact files to change:**

| File | Line | Current | New |
|------|------|---------|-----|
| `web/src/components/events/EventPhotosSection.tsx` | 245 | `border-emerald-500 ring-2 ring-emerald-500/30` | `border-[var(--color-border-accent)] ring-2 ring-[var(--color-accent-primary)]/30` |
| `web/src/components/events/EventPhotosSection.tsx` | 259 | `bg-emerald-500 text-white` | `bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]` |
| `web/src/components/events/EventPhotosSection.tsx` | 283 | `bg-emerald-500/80 hover:bg-emerald-500` | `bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]` |
| `web/src/components/events/EventPhotosSection.tsx` | 289 | `Check className="w-5 h-5 text-white"` | `Check className="w-5 h-5 text-[var(--color-text-on-accent)]"` |

**Reference:** VenuePhotosSection.tsx lines 224, 238, 262 already use theme tokens (`--color-border-accent`, `--color-accent-primary`, `--color-background`).

**Behavior change summary:**
- EventPhotosSection cover badge and buttons follow the active theme (Sunrise/Night) instead of always showing emerald green
- Visual appearance in Night theme is nearly identical (gold replaces emerald)
- Sunrise theme gets proper light-mode contrast

**Risk/rollback plan:**
- Risk: Subtle color change may surprise users familiar with emerald. Minimal impact — the function is the same.
- Rollback: Revert to hardcoded emerald values.

**Acceptance criteria:**
1. Cover badge, cover border, and set-as-cover button use theme tokens
2. Both Sunrise and Night themes render correctly
3. No hardcoded `emerald` remaining in EventPhotosSection

---

### WP-P2c: Aspect Ratio Alignment (EventForm → 3:2)

**Objective:** Change EventForm cover upload aspect ratio from 4:3 to 3:2, matching the locked HappeningCard poster aspect (`aspect-[3/2]` per CLAUDE.md Locked Layout Rules).

**Note:** CONTRACTS.md line 69 says 4:3 but is stale. CLAUDE.md Locked Layout (line 679) and actual HappeningCard code (line 663) both use 3:2. This change aligns the upload hint with what the display actually renders.

**Exact files to change:**

| File | Line | Current | New |
|------|------|---------|-----|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | 1918 | `aspectRatio={4/3}` | `aspectRatio={3/2}` |
| `web/src/components/events/EventPhotosSection.tsx` | 229 | `aspectRatio={4 / 3}` | `aspectRatio={3 / 2}` |

**Surfaces NOT changing (intentionally different):**
- VenuePhotosSection: `aspectRatio={16/9}` — landscape venue photos are intentional
- ProfilePhotosSection: `aspectRatio={1}` — square avatar crops are intentional
- BlogPostForm: `aspectRatio={4/3}` — blog covers display at different ratios than event posters; deferred

**CONTRACTS.md update needed:** Line 69 should be updated from "4:3" to "3:2" to match reality. See Section 4 (Contract/Doc Plan).

**Behavior change summary:**
- Crop suggestion in EventForm and EventPhotosSection is now 3:2 instead of 4:3
- Users who "Save original image" (primary CTA per Phase 4.85) are unaffected
- Users who crop will get a ratio matching the card display

**Risk/rollback plan:**
- Risk: Existing 4:3 images will still display correctly (`object-cover` handles ratio differences)
- Rollback: Change aspect ratio values back to `4/3`.

**Acceptance criteria:**
1. EventForm crop modal suggests 3:2 ratio
2. EventPhotosSection crop modal suggests 3:2 ratio
3. Existing images continue to display correctly in HappeningCard

---

## 3. Test Plan

### New Test File: `__tests__/phase7a-media-ux-clarity.test.ts`

| Section | Tests | Mapped to WP |
|---------|-------|-------------|
| A. Event cover upload path | EventForm `handleImageUpload` uses `{eventId}/{uuid}` pattern; creates `event_images` row | WP-P0 |
| B. Event cover removal | `handleImageRemove` soft-deletes `event_images` row; clears `events.cover_image_url` | WP-P0 |
| C. Create-mode deferred upload | Cover file stored locally until event created; uploads post-creation | WP-P0 |
| D. Copy consistency | No surface contains "Max 5MB" text; all "set as cover" instructions consistent | WP-P1a |
| E. Soft-archive consistency | UnassignedPhotosManager uses `.update({ is_hidden: true })` not `.delete()` | WP-P1b |
| F. Confirmation text | UnassignedPhotosManager dialog says "Photos will be hidden. An admin can restore them if needed." | WP-P1b |
| G. File-size limits | All 7 surfaces accept `maxSizeMB >= 10` | WP-P2a |
| H. Theme tokens | EventPhotosSection contains no hardcoded `emerald` classes | WP-P2b |
| I. Aspect ratios | EventForm and EventPhotosSection use `3/2` aspect ratio | WP-P2c |
| J. CONTRACTS.md accuracy | Poster thumbnail aspect contract says "3:2" | WP-P2c |

**Estimated test count:** ~25–30 tests across 10 sections.

### Existing Test Updates

| Test File | Change |
|-----------|--------|
| `__tests__/card-variants.test.tsx` | Verify no regression on poster aspect ratio (should already pass — 3:2 is existing code) |
| `__tests__/unassigned-photos-manager.test.tsx` | Update delete assertions from `.delete()` to `.update({ is_hidden: true })` |
| `__tests__/gallery-upload-ux-nudges.test.tsx` | Verify no regression on upload flow |

---

## 4. Contract/Doc Plan

| Document | Change |
|----------|--------|
| `docs/CONTRACTS.md` line 69 | Change "4:3" to "3:2" to match locked layout and code reality |
| `docs/CONTRACTS.md` | Add new section: "§ Media Upload Consistency" documenting file-size standard (10 MB), delete pattern (soft-delete), and per-surface aspect ratio decisions |
| `CLAUDE.md` Recent Changes | Add Phase 7A entry after execution |

---

## 5. Open Questions

| # | Question | Blocking? | Suggested Resolution |
|---|----------|-----------|---------------------|
| 1 | **Create-mode cover upload timing:** Should EventForm defer file upload to post-creation (Option A) or upload to temp path (Option B)? | Not blocking — both work | **Option A preferred** (deferred upload). Simpler, no temp-path cleanup needed. EventCreateForm already uses this pattern. |
| 2 | **Existing orphan files:** ~N files exist in `event-images/{userId}/...` from previous EventForm uploads. Clean up? | Not blocking | Defer cleanup. Harmless wasted storage. Can be cleaned with a one-time script in a future phase. |
| 3 | **CONTRACTS.md 4:3 vs 3:2 stale value:** Should we update CONTRACTS.md as part of this tract or separately? | Not blocking — included in plan | Update in this tract (WP-P2c + Section 4). |

No truly blocking questions remain. All are resolvable with the suggested approach.

---

## 6. Subordinate Architect Critique Block

### Assumptions

| # | Assumption | Confidence |
|---|-----------|------------|
| 1 | Changing `maxSizeMB` from 5 to 10 on 4 surfaces will not cause Supabase storage policy violations | High — gallery already uses 10 MB and the storage bucket policies don't enforce file-size limits |
| 2 | Setting `is_hidden = true` on unassigned gallery photos instead of hard-deleting will not break the gallery page display | High — `dashboard/gallery/page.tsx` line 58 already filters `.eq("is_hidden", false)`; hidden photos are already excluded from all gallery views |
| 3 | Changing EventForm upload path from `{userId}/{timestamp}` to `{eventId}/{uuid}` will not break existing RLS storage policies | Medium — need to verify `event-images` bucket allows the new path pattern for authenticated users |
| 4 | The deferred upload pattern for create mode will work within the existing `handleSubmit` flow without race conditions | High — EventCreateForm already uses this pattern successfully |
| 5 | Updating the aspect ratio from 4:3 to 3:2 in ImageUpload's crop modal will not break existing uploaded images | High — `object-cover` CSS handles any source aspect ratio gracefully |

### Risks (≥3 required)

| # | Finding | Evidence | Impact | Suggested Delta | Confidence |
|---|---------|----------|--------|----------------|------------|
| R1 | **WP-P0 storage policy gap.** EventForm currently uploads to `{userId}/*` paths. The `event-images` bucket RLS policies (migration `20260118120000`) may only allow `{event_id}/*` paths for hosts/admins. Switching to `{eventId}/*` in EventForm could fail for non-admin event creators. | `EventForm.tsx:374` uses `session.user.id` in path; EventPhotosSection.tsx:54 uses `eventId` in path. Storage policies configured in `20260118120000` and `20260118200000`. | **Medium** — Could block non-admin event cover uploads until policy is verified/fixed. | Before implementing WP-P0, audit `event-images` storage policies to confirm authenticated users can write to `{eventId}/*` paths. If not, add a policy fix (would need a migration — which is declared non-goal). Alternative: keep `{userId}/*` path pattern but still create the `event_images` row. | Medium |
| R2 | **WP-P0 create-mode timing.** Deferred upload in `handleSubmit` adds file upload latency after event creation. If upload fails, the event exists without a cover — silent partial failure. | EventCreateForm uses deferred pattern; no existing error handling for post-create upload failure. | **Low** — User sees event created but cover may silently fail. Same risk exists in EventCreateForm today. | Add toast notification on post-create upload failure: "Event created but cover image failed to upload. You can add it from the edit page." | High |
| R3 | **WP-P1b soft-archive visibility — RESOLVED.** Confirmed that `dashboard/gallery/page.tsx` line 58 already filters `.eq("is_hidden", false)`. Setting `is_hidden = true` on "deleted" unassigned photos will automatically exclude them from all gallery views with no query changes needed. | `dashboard/gallery/page.tsx` line 58: `.eq("is_hidden", false)`; line 91: `.filter(p => p.is_hidden).length` for hidden count. | **None** — Existing filters already handle this. | No delta needed. | High |
| R4 | **WP-P2c aspect ratio contract drift.** CONTRACTS.md says 4:3 while code says 3:2. Updating CONTRACTS.md to 3:2 is correct but any tests that assert "4:3" from CONTRACTS.md will break. | `docs/CONTRACTS.md:69` says "4:3"; `CLAUDE.md:679` says "3:2"; `HappeningCard.tsx:663` uses `aspect-[3/2]`. | **Low** — Test breakage is immediately visible and easily fixed. | Search test files for "4:3" or "4/3" aspect ratio assertions before updating CONTRACTS.md. Fix any that reference the stale value. | High |

### Deltas (≥2 required)

| # | Finding | Evidence | Impact | Suggested Delta | Confidence |
|---|---------|----------|--------|----------------|------------|
| D1 | **WP-P0 scope may require storage policy audit** (not code change, just verification). The plan assumes `event-images` bucket allows `{eventId}/*` paths for authenticated users, but this hasn't been verified from the migration files. If the policy only allows host/admin writes, non-admin event creators would be blocked. | Migrations `20260118120000` and `20260118200000` configure policies but were not fully read in this session. | If policy is restrictive, WP-P0 either needs a migration (declared non-goal) or must keep `{userId}/*` path. | **Add pre-implementation step:** Read storage policy migrations and confirm path pattern compatibility before writing code. If incompatible, use hybrid approach: keep `{userId}/*` path but still create `event_images` row pointing to the storage URL. | High |
| D2 | **Gallery query filter — RESOLVED.** Verified in current session: `dashboard/gallery/page.tsx` line 58 already filters `.eq("is_hidden", false)`. The `is_hidden` soft-archive approach requires no query changes. No pre-flight needed for WP-P1b. | `dashboard/gallery/page.tsx` line 58: `.eq("is_hidden", false)`. | None — no pre-flight needed. | No delta needed. Pre-flight step removed for WP-P1b. | High |

---

## Execution Order

| Step | WP | Dependencies |
|------|-----|-------------|
| 1 | **Pre-flight:** Verify `event-images` storage policies (read migrations `20260118120000` + `20260118200000`) | Blocks WP-P0 only |
| 2 | WP-P1b | Independent — `is_hidden` soft-archive (no pre-flight needed; gallery filters already verified) |
| 3 | WP-P1a | Independent — copy/terminology fixes |
| 4 | WP-P0 | Depends on pre-flight storage policy check |
| 5 | WP-P2a | Independent — file-size limit changes |
| 6 | WP-P2b | Independent — theme token cleanup |
| 7 | WP-P2c | Independent — aspect ratio alignment |
| 8 | Tests | After all WPs complete |
| 9 | CONTRACTS.md + CLAUDE.md updates | After tests pass |

**Rationale for order:** P0 (event cover path unification) is the highest-value fix and should not be deferred behind cosmetic-only changes. The pre-flight storage policy read (Step 1) is a fast verification that unblocks P0 at Step 4. WP-P1b no longer needs a pre-flight (gallery `is_hidden` filtering confirmed in the delta update), so it can execute immediately at Step 2. P1a (copy fixes) pairs naturally after P1b. P2 changes are cosmetic/low-risk and slot in after the functional fixes. This order ensures P0 is reached no later than Step 4, not deferred to Step 7.

---

**STOP — awaiting Sami approval before code edits.**

No source code has been edited. No commits have been made.
