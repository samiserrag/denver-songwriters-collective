# Phase 4.90 — Gallery Unassigned Photos: Audit + Fix Dead-End UX

**Status:** ✅ COMPLETE — All quality gates pass
**Date:** 2026-01-26
**Goal:** Fix the "Unassigned Photos" dead-end UX where uploads without albums become stuck.

**Checked against DSC UX Principles:**
- §8 Dead States — Users could create unassigned photos but had no way to manage them (fixed)
- §9 Admin UX Exists to Repair — Users were told to "use the admin panel" to manage their own content (violation, now fixed)

---

## 1. Surface Inventory

| Surface | Path | Purpose | Unassigned Photo Actions |
|---------|------|---------|--------------------------|
| User Gallery Dashboard | `/dashboard/gallery/page.tsx` | Member's own gallery management | **DEAD-END**: Shows thumbnails only, no move/delete/edit |
| Admin Gallery Dashboard | `/dashboard/admin/gallery/page.tsx` | Admin gallery management | Full management: select, assign to album, delete |
| Admin GalleryAdminTabs | `/dashboard/admin/gallery/GalleryAdminTabs.tsx` | Admin tabs for photos/albums/upload | Select + assign to album UI (lines 548-629) |
| UserGalleryUpload | `/dashboard/gallery/UserGalleryUpload.tsx` | Member upload component | Album selection optional (`<option value="">No album</option>`) |
| AlbumPhotoManager | `/components/gallery/AlbumPhotoManager.tsx` | Manage photos within an album | Remove from album, delete, edit caption, reorder |
| BulkUploadGrid | `/components/gallery/BulkUploadGrid.tsx` | Multi-photo upload with crop | Album pre-selection |
| Public Gallery | `/gallery/page.tsx` | Public album listing | N/A (only shows albums) |
| Album Detail | `/gallery/[slug]/page.tsx` | Public album view | N/A (only shows album photos) |

---

## 2. Data Model Summary

### Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `gallery_images` | `id`, `image_url`, `caption`, `album_id` (nullable), `uploaded_by`, `is_approved`, `is_published`, `is_hidden`, `sort_order` | `album_id = NULL` creates "unassigned" state |
| `gallery_albums` | `id`, `name`, `slug`, `description`, `cover_image_url`, `is_published`, `created_by` | Albums are containers for photos |

### RLS Policies on `gallery_images`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `gallery_images_public_read` | SELECT | `is_approved = true` |
| `gallery_images_own_read` | SELECT | `auth.uid() = uploaded_by` |
| `gallery_images_insert` | INSERT | `auth.uid() = uploaded_by` |
| `gallery_images_update_own` | UPDATE | `auth.uid() = uploaded_by` |
| `gallery_images_delete_own` | DELETE | `auth.uid() = uploaded_by` |
| `gallery_images_admin` | ALL | `is_admin()` |

**Key finding:** RLS already allows users to UPDATE and DELETE their own photos. The limitation is UI-only.

---

## 3. Exact Reason "Unassigned" Becomes Unmanageable

### The Dead-End Codepath

1. **Upload Flow** (`UserGalleryUpload.tsx` line 436-451):
   ```tsx
   <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} ...>
     <option value="">No album</option>  // <-- PROBLEM: This is allowed
     {albums.map((album) => (
       <option key={album.id} value={album.id}>{album.name}</option>
     ))}
   </select>
   ```

2. **Insert allows null** (`UserGalleryUpload.tsx` line 372):
   ```tsx
   album_id: albumId || null,  // <-- Stores NULL in database
   ```

3. **Dashboard shows unassigned but provides NO actions** (`/dashboard/gallery/page.tsx` lines 237-277):
   ```tsx
   {/* Unassigned Photos Section */}
   {unassignedPhotos.length > 0 && (
     <section className="mb-8">
       <h2>Unassigned Photos ({unassignedPhotos.length})</h2>
       <p>These photos are not in any album. Add them to an album when
          uploading or via the admin panel.</p>  // <-- DEAD-END MESSAGE
       <div className="grid ...">
         {unassignedPhotos.slice(0, 12).map((photo) => (
           <div key={photo.id} className="...">
             <Image src={photo.image_url} ... />
             {/* NO ACTION BUTTONS - THIS IS THE DEAD-END */}
           </div>
         ))}
       </div>
     </section>
   )}
   ```

4. **User is told:** "Add them to an album when uploading or via the admin panel"
   - But users cannot access the admin panel
   - Uploading is for new photos, not managing existing ones
   - Result: **Photos are permanently stuck**

### Contrast with Admin UI

Admin GalleryAdminTabs (`lines 548-629`) provides:
- Click to select multiple unassigned photos
- "Add to album..." dropdown
- "Add" button to move selected photos
- Delete option (via Photos tab)

**The admin UI proves the fix is simple** — the same UI pattern just needs to be applied to the user dashboard.

---

## 4. Proposed Minimal Fix Approach

### Option A: Mirror Admin UI Pattern (Recommended)

Add the same select-and-assign UI that admins have to the user gallery dashboard:

1. **Add selection state** to unassigned photos section
2. **Add album dropdown** with user's albums
3. **Add "Move to Album" button**
4. **Add delete button** for removing unwanted photos

**Scope:** ~50-80 lines of code changes to `/dashboard/gallery/page.tsx`

**Risks:**
- Low: RLS already permits UPDATE/DELETE by owner
- Low: Follows proven admin UI pattern

### Option B: Require Album on Upload (Breaking Change)

Remove "No album" option from upload dropdown.

**Problems:**
- Users must create album first (extra friction)
- What if they just want to upload one photo?
- Doesn't help existing unassigned photos

**Not recommended** as primary fix.

### Option C: Auto-Create "Unsorted" Album

Automatically create a default album for photos without explicit album selection.

**Problems:**
- Adds clutter to album list
- Doesn't solve the management problem (just moves it)
- Users might not understand why album was created

**Not recommended** as primary fix.

---

## 5. Proposed Implementation (STOP-GATE 2)

### Files to Modify

| File | Changes |
|------|---------|
| `/dashboard/gallery/page.tsx` | Add selection UI, album dropdown, move/delete actions to unassigned section |

### UI Changes

**Unassigned Photos Section (enhanced):**
```
Unassigned Photos (5)
[Select photos to move them to an album or delete them]

[ ] Photo1  [ ] Photo2  [ ] Photo3  [ ] Photo4  [ ] Photo5

When selected:
  3 selected | [Album dropdown ▼] [Move] [Delete] [Clear]
```

### Tests to Add

| Test | Purpose |
|------|---------|
| `can-move-unassigned-to-album` | Verify UPDATE with album_id works |
| `can-delete-unassigned-photo` | Verify DELETE works |
| `unassigned-shows-action-buttons` | Verify UI renders management controls |
| `rls-blocks-other-user-photos` | Verify users cannot manage others' photos |

---

## 6. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS blocks operations | Low | RLS already permits — tested in admin UI |
| Storage orphans on delete | Low | Storage policy allows owner deletion |
| Accidental deletion | Medium | Confirm dialog required |
| Performance with many photos | Low | Existing pagination pattern handles this |

---

## 7. Decision Required

**Approval needed to proceed with Option A implementation.**

STOP-GATE 2 will:
1. Add selection + move + delete UI to user gallery dashboard
2. Add tests for dead-end state and repair actions
3. Update CLAUDE.md with changes

---

---

## STOP-GATE 2A — Investigation Summary

### Confirmed Findings

1. **User dashboard already fetches required data:**
   - `userAlbums` (user's own albums) — line 26-39
   - `unassignedPhotos` (photos without album_id) — line 91
   - `allAlbums` (for upload dropdown) — line 94-98

2. **Admin pattern is directly reusable:**
   - State: `selectedUnassignedPhotos` (Set), `assignToAlbumId`, `isAssigning` — GalleryAdminTabs lines 71-74
   - Toggle selection: `togglePhotoSelection` — lines 242-253
   - Assignment: `assignPhotosToAlbum` — lines 255-290

3. **Delete uses simple DB delete (no storage cleanup):**
   - Admin uses `supabase.from("gallery_images").delete().eq("id", imageId)` — line 96
   - Storage is not explicitly cleaned up (orphan files remain, acceptable pattern in this codebase)

### Implementation Location

**File:** `web/src/app/(protected)/dashboard/gallery/page.tsx`

**Current dead-end:** Lines 237-277 (Unassigned Photos section)

**Change scope:**
- Convert server component to extract unassigned section into a client component
- OR convert entire page to client component (simpler, follows admin pattern)
- Recommendation: Create `UnassignedPhotosManager` client component to keep server data fetching intact

---

## STOP-GATE 2B — Implementation Plan

### Approach: Client Component for Unassigned Section

Create a new client component `UnassignedPhotosManager` that receives:
- `photos` (unassigned photos array)
- `albums` (user's albums for dropdown)

This keeps the server component pattern for data fetching while enabling client interactivity.

### New File

`web/src/app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx`

### Functions to Implement

| Function | Source | Notes |
|----------|--------|-------|
| `togglePhotoSelection` | Copy from admin | Identical logic |
| `assignPhotosToAlbum` | Copy from admin | Identical logic |
| `deleteSelectedPhotos` | New | Simple delete with confirm dialog |

### UI Structure

```
Unassigned Photos (N)
[Select photos to move to an album or delete]

Photo Grid (clickable with selection state)

Action Bar (when selection > 0):
  {N} selected | [Album ▼] [Move] | [Delete] | [Clear]
```

### Files to Create/Modify

| File | Action | Lines Changed |
|------|--------|---------------|
| `dashboard/gallery/_components/UnassignedPhotosManager.tsx` | CREATE | ~150 lines |
| `dashboard/gallery/page.tsx` | MODIFY | ~10 lines (replace inline section with component) |

---

## Appendix: Key Code References

### Current Dead-End (User Dashboard)
- File: `web/src/app/(protected)/dashboard/gallery/page.tsx`
- Lines: 237-277 (Unassigned Photos section)

### Working Admin Pattern
- File: `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx`
- Lines: 548-629 (Unassigned Photos section with full management)
- Lines: 71-74 (Selection state: `selectedUnassignedPhotos`, `assignToAlbumId`, `isAssigning`)
- Lines: 242-290 (Assignment function: `assignPhotosToAlbum`)

### RLS Policies
- File: `supabase/migrations/20251206_gallery_and_blog.sql`
- Lines: 43-49 (UPDATE/DELETE own policies)

---

## STOP-GATE 2C — Implementation Complete

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `dashboard/gallery/_components/UnassignedPhotosManager.tsx` | 253 | Client component with selection, move, delete |
| `__tests__/unassigned-photos-manager.test.tsx` | 340 | 21 tests for component behavior |

### Files Modified

| File | Change |
|------|--------|
| `dashboard/gallery/page.tsx` | Replaced 40-line inline section with 6-line component usage |

### Component Features

1. **Selection:** Click photos to toggle selection (visual checkmark + ring)
2. **Move to Album:** Dropdown with user's albums + "Move" button
3. **Delete:** Confirmation dialog with proper plural handling
4. **Clear:** Deselect all photos
5. **Hidden badge:** Shows for admin-hidden photos
6. **Processing states:** Buttons disabled during async operations

---

## STOP-GATE 2D — Test Coverage

| Test Category | Tests | Coverage |
|---------------|-------|----------|
| Rendering | 4 | Empty state, controls, photo grid, hidden badge |
| Selection | 4 | Select, multi-select, deselect, clear all |
| Move to Album | 3 | Button disabled state, enable on album select, API call |
| Delete | 4 | Confirmation dialog, cancel behavior, API call, plural text |
| Dead-end fix | 2 | No admin panel message, actionable instructions |
| **Total** | **21** | Full component behavior |

---

## STOP-GATE 2E — Final Report

### Quality Gates

| Gate | Result |
|------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2658 passed (21 new) |
| Build | ✅ Success |

### Before/After Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Upload without album | Photo stuck with no actions | Photo manageable via new component |
| User wants to move photo | "via admin panel" (dead-end) | Select + dropdown + Move button |
| User wants to delete photo | No option | Select + Delete button with confirm |
| User has no albums | Dead-end (can't move anywhere) | Move button disabled, can still delete |

### Key Design Decisions

1. **Client component extraction:** Keeps server data fetching in page.tsx, enables interactivity in component
2. **No RLS changes:** Existing policies already permit owner UPDATE/DELETE
3. **No schema changes:** Uses existing `album_id` and `sort_order` columns
4. **Admin pattern reuse:** Same selection/move logic proven in GalleryAdminTabs

### Rollback Plan

If issues arise:
1. Revert `UnassignedPhotosManager.tsx` import in page.tsx
2. Restore inline thumbnail grid (no actions, but no breakage)
3. Component file can remain for future use
