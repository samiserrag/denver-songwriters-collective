# Phase 7A — Media UX Clarity (STOP-GATE Investigation)

**Status:** PENDING APPROVAL
**Author:** Opus 4.6 (Junior Architect + Executor)
**Date:** February 2026
**Checked against:** DSC UX Principles §2, §7, §8, §10, §14; GOVERNANCE.md §Subordinate Architect Review Mode

> This document is an investigation and critique only. No code changes have been made.

---

## 1. Current-State Map

### 1.1 Media Surfaces Inventory

The platform has **6 distinct media upload surfaces** spread across **4 storage buckets** and **4 database tables**, plus 2 cover-image-only paths that write directly to entity columns.

#### A) Profile Photos

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `ProfilePhotosSection` | `components/profile/ProfilePhotosSection.tsx` |
| Storage bucket | `avatars` | `:50` — `.from("avatars").upload(storagePath, file)` |
| Storage path | `{userId}/profile-gallery/{fileId}.{ext}` | `:47` |
| DB table | `profile_images` | `:69` — `.from("profile_images").insert(...)` |
| DB columns | `id, user_id, image_url, storage_path, created_at, deleted_at` | `:10-17` (type definition) |
| Aspect ratio | 1:1 (square) | `:213` — `aspectRatio={1}` |
| Max file size | 5 MB | `:214` — `maxSizeMB={5}` |
| Auto-set behavior | First upload + no avatar → auto-sets `profiles.avatar_url` | `:90-108` |
| Delete pattern | Soft-delete (`deleted_at` timestamp) | `:127-129` |
| Header copy | "Profile Photos" | `:201` |
| Subtitle copy | "Upload multiple photos and choose which one to display as your profile picture." | `:203-206` |
| Prompt banner | Amber banner: "Choose your profile picture! Hover over a photo and click the ✓ button..." | `:226-233` |

#### B) Event (Happening) Photos

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `EventPhotosSection` | `components/events/EventPhotosSection.tsx` |
| Storage bucket | `event-images` | `:50` — `.from("event-images").upload(storagePath, file)` |
| Storage path | `{eventId}/{uuid}.{ext}` | `:47` |
| DB table | `event_images` | `:69` — `.from("event_images").insert(...)` |
| DB columns | `id, event_id, image_url, storage_path, uploaded_by, created_at, deleted_at` | `:10-19` (type definition) |
| Aspect ratio | 4:3 | `:213` — `aspectRatio={4/3}` |
| Max file size | 5 MB | `:214` — `maxSizeMB={5}` |
| Auto-set behavior | First image + no cover → auto-sets `events.cover_image_url` | `:95-111` |
| Delete pattern | Soft-delete (`deleted_at` timestamp) | `:130-133` |
| Header copy | "Happening Photos" | `:199` |
| Cover badge | **Hardcoded `bg-emerald-500`** — NOT theme tokens | `:261` |

#### C) Venue Photos

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `VenuePhotosSection` | `components/venue/VenuePhotosSection.tsx` |
| Storage bucket | `avatars` (shared with profile) | `:50` — `.from("avatars").upload(storagePath, file)` |
| Storage path | `venues/{venueId}/{fileId}.{ext}` | `:47` |
| DB table | `venue_images` | `:69` — `.from("venue_images").insert(...)` |
| DB columns | `id, venue_id, image_url, storage_path, uploaded_by, created_at, deleted_at` | `:10-19` (type definition) |
| Aspect ratio | 16:9 | `:212` — `aspectRatio={16/9}` |
| Max file size | 5 MB | `:213` — `maxSizeMB={5}` |
| Auto-set behavior | **NONE** — no auto-cover on first upload | (absent from file; contrast with Profile `:90-108` and Event `:95-111`) |
| Delete pattern | Soft-delete (`deleted_at` timestamp) | `:127-130` |
| Header copy | "Venue Photos" | `:198` |

#### D) Event Cover Image (via EventForm)

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `EventForm` (inline section) | `dashboard/my-events/_components/EventForm.tsx` |
| Storage bucket | `event-images` | `:1912` (via Explore agent) |
| Storage path | `{userId}/{timestamp}.{ext}` | `:1912` |
| DB column | `events.cover_image_url` (no separate table) | Direct column update |
| Aspect ratio | 4:3 | `:1918` — `aspectRatio={4/3}` |
| Max file size | 5 MB | `:1919` |
| Label | "Cover Image (optional)" | `:1910` |
| Recommendation | "Recommended: 1200x900px (4:3). Most phone photos are already 4:3." | `:1916` |

**Note:** EventForm cover and EventPhotosSection both write to `event-images` bucket but use **different path formats** (`{userId}/{timestamp}` vs `{eventId}/{uuid}`).

#### E) Blog Cover Image

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `BlogPostForm` | `dashboard/admin/blog/BlogPostForm.tsx` |
| Storage bucket | `blog-images` | `:126` — `.from('blog-images').upload(fileName, file)` |
| Storage path | `{authorId}/cover-{timestamp}.{ext}` | `:125` |
| DB column | `blog_posts.cover_image_url` (no separate table) | `:138` — `setFormData(prev => ({ ...prev, cover_image_url: urlWithTimestamp }))` |
| Aspect ratio | **Unspecified** (no `aspectRatio` prop passed to ImageUpload) | (absent from upload call) |
| Max file size | Default (5 MB from ImageUpload defaults) | (inherits from ImageUpload) |
| Auto-set behavior | None | — |
| Cover removal | Clears state only; **does NOT delete from storage** | `:150` — `setFormData(prev => ({ ...prev, cover_image_url: "" }))` |

#### F) Gallery (Community Album System)

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Upload component | `UserGalleryUpload` | `dashboard/gallery/UserGalleryUpload.tsx` |
| Storage bucket | `gallery-images` | `:417` — `.from("gallery-images").upload(...)` |
| Storage path | `{userId}/{timestamp}-{i}.{ext}` | `:414` |
| DB table | `gallery_images` | `:434` — `.from("gallery_images").insert(...)` |
| Album table | `gallery_albums` | `app/gallery/page.tsx` |
| Max file size | **10 MB** (different from 5 MB entity limit) | `:374` (Explore agent finding) |
| Auto-approve | `is_approved: true` on upload | `:436` |
| Album label | "Album (recommended)" | `:489` |
| Visibility model | `is_published` + `is_hidden` (NOT `deleted_at`) | `app/gallery/[slug]/page.tsx:107-108` |
| Unassigned handling | `UnassignedPhotosManager` with **HARD delete** | `dashboard/gallery/_components/UnassignedPhotosManager.tsx` |

#### G) Gallery Public Pages

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Listing page | `app/gallery/page.tsx` | Filters: `is_published=true AND is_hidden=false` |
| Album detail | `app/gallery/[slug]/page.tsx` | Filters: `is_published=true, is_hidden=false` |
| Ordering | `is_featured DESC → sort_order ASC → created_at DESC` | `gallery/[slug]/page.tsx:109-111` |
| Pagination | 24 images per page | `gallery/[slug]/page.tsx:16` — `IMAGES_PER_PAGE = 24` |
| Cover fallback | `album.cover_image_url` → first visible image | `gallery/page.tsx` listing logic |

### 1.2 Storage Bucket Summary

| Bucket | Used By | Path Pattern |
|--------|---------|--------------|
| `avatars` | Profile photos, Venue photos | `{userId}/profile-gallery/*`, `venues/{venueId}/*` |
| `event-images` | Event photos, EventForm covers | `{eventId}/*`, `{userId}/*` |
| `gallery-images` | Gallery album photos | `{userId}/*` |
| `blog-images` | Blog covers, blog gallery | `{authorId}/cover-*`, `{authorId}/gallery-*` |

### 1.3 Shared Upload Component

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `ImageUpload` | `components/ui/ImageUpload.tsx` |
| Primary CTA | "Save original image" (accent bg, full-width) | `:412-430` |
| Secondary CTA | "Save cropped image" (border style) | `:437-456` |
| Output format | JPEG 0.9 quality | `:285` |
| Max dimensions | 800px (1:1 square), 1200px (landscape) | `:282-283` |
| Supported types | JPEG, PNG, WebP, GIF | Validated in component |

### 1.4 Card Display Component

| Attribute | Value | Evidence |
|-----------|-------|----------|
| Component | `PosterMedia` | `components/media/PosterMedia.tsx` |
| Variants | `card` (200px max-h, bounded) and `detail` (full-width, natural-h) | Explore agent finding |
| Object fit | `object-contain` with letterbox bg `bg-[var(--color-bg-tertiary)]` | Both variants |
| Aspect ratio | 3:2 for cards (per CONTRACTS.md) | CONTRACTS.md Event Poster Media |

---

## 2. Confusion Inventory

### 2.1 Naming Confusion: "Photos" Overloaded

| Surface | Header Text | What User Sees | What It Actually Does |
|---------|-------------|----------------|----------------------|
| Profile dashboard | "Profile Photos" | Grid of photos with avatar selection | Manages `profile_images` + sets `profiles.avatar_url` |
| Event dashboard | "Happening Photos" | Grid of photos with cover selection | Manages `event_images` + sets `events.cover_image_url` |
| Venue dashboard | "Venue Photos" | Grid of photos with cover selection | Manages `venue_images` + sets `venues.cover_image_url` |
| Gallery dashboard | "My Gallery" (upload section) | Bulk upload with album assignment | Manages `gallery_images` in `gallery_albums` |
| Gallery dashboard | "Unassigned Photos" | Grid with move/delete actions | Manages `gallery_images` where `album_id IS NULL` |
| EventForm | "Cover Image (optional)" | Single image upload | Sets `events.cover_image_url` only (no `event_images` row) |
| BlogPostForm | Cover image section | Single image upload | Sets `blog_posts.cover_image_url` only |

**Confusion point:** A user who uploads a "profile photo" might expect it to also appear in the gallery. A user who uploads a "happening photo" might not understand why it's separate from gallery photos tagged to the same event. The word "photos" is used for 5 different things.

### 2.2 Auto-Behavior Inconsistency

| Surface | First-Upload Auto-Set? | Banner/Prompt? |
|---------|------------------------|----------------|
| Profile | YES — auto-sets avatar | YES — amber "Choose your profile picture!" banner |
| Event | YES — auto-sets cover | No banner |
| Venue | **NO** — does NOT auto-set cover | No banner |
| Blog | NO — manual only | No banner |
| Gallery | N/A (album-based) | Warning if no album selected |

**Confusion point (§14):** Users uploading venue photos may expect the same auto-cover behavior they experienced on profile or event photos. The inconsistency feels like a bug.

### 2.3 Delete Pattern Inconsistency

| Surface | Delete Mechanism | Reversible? |
|---------|-----------------|-------------|
| Profile photos | Soft-delete (`deleted_at`) | Yes (admin could restore) |
| Event photos | Soft-delete (`deleted_at`) | Yes |
| Venue photos | Soft-delete (`deleted_at`) | Yes |
| Gallery photos (in albums) | `is_hidden` flag | Yes (toggle visibility) |
| Gallery unassigned photos | **HARD delete** (row removed) | **NO** |
| Blog cover | State clear only; **storage file orphaned** | N/A (file persists) |

**Confusion point (§8 Dead States):** Unassigned gallery photos are the only surface using irreversible hard delete. Blog cover "removal" orphans storage files — the image remains in the bucket with no reference.

### 2.4 Storage Bucket Cross-Contamination

The `avatars` bucket is used for both profile photos (`{userId}/profile-gallery/*`) and venue photos (`venues/{venueId}/*`). The `event-images` bucket is used by both `EventPhotosSection` (path: `{eventId}/*`) and `EventForm` cover uploads (path: `{userId}/*`).

**Confusion point:** This is not user-facing but creates maintenance risk. A storage cleanup targeting "profile photos" in the `avatars` bucket could accidentally affect venue photos.

### 2.5 Aspect Ratio Inconsistency

| Surface | Upload Aspect | Display Aspect | Mismatch? |
|---------|--------------|----------------|-----------|
| Profile | 1:1 | 1:1 (avatar circle) | No |
| Event cover (EventForm) | 4:3 | 3:2 (card per CONTRACTS.md) | **YES** |
| Event photos (section) | 4:3 | 1:1 (grid thumbnails) | **YES** |
| Venue photos | 16:9 | 1:1 (grid thumbnails) | **YES** |
| Blog cover | Unspecified | Variable | Undefined |
| Gallery | Mixed (per crop) | 1:1 (grid) → natural (lightbox) | Partial |

**Confusion point:** EventForm recommends 4:3 ("Most phone photos are already 4:3") but CONTRACTS.md specifies 3:2 for card display (`aspect-[3/2]`). Photos uploaded at 4:3 will be slightly cropped when displayed on cards.

### 2.6 Max File Size Inconsistency

| Surface | Max Size | Evidence |
|---------|----------|----------|
| Profile/Event/Venue photos | 5 MB | `maxSizeMB={5}` |
| Gallery photos | **10 MB** | `UserGalleryUpload` validation |
| Blog cover | 5 MB (default) | Inherited from ImageUpload |

**Confusion point:** A user who successfully uploads a 7 MB photo to the gallery will get a confusing error if they try to upload the same file as a venue photo.

### 2.7 Cover Image vs Entity Photos: Two Upload Paths for Events

Events have TWO separate upload paths:
1. **EventForm** "Cover Image" — uploads to `event-images/{userId}/{timestamp}`, writes directly to `events.cover_image_url`
2. **EventPhotosSection** — uploads to `event-images/{eventId}/{uuid}`, creates `event_images` row, can be promoted to cover

**Confusion point:** A host might upload a cover via EventForm, then upload photos via EventPhotosSection. The cover image does NOT appear in the photo grid (different path, no `event_images` row). The host may re-upload the same image to the grid to make it appear there.

### 2.8 Theme Token Violation

`EventPhotosSection.tsx:261` uses hardcoded `bg-emerald-500` for the "Current Cover" badge. Per CONTRACTS.md and the Locked Layout Rules, all colors must use theme tokens. This badge will have inconsistent appearance across themes.

---

## 3. Canonical Media Model Proposal

### 3.1 Proposed Terminology

| Concept | Current (Confusing) | Proposed (Canonical) |
|---------|---------------------|---------------------|
| Profile photo collection | "Profile Photos" | "My Photos" (with subtitle: "These are your personal photos. Choose one as your profile picture.") |
| Entity cover image | "Cover Image" / "Happening Photos" / "Venue Photos" | "Cover & Photos" (unified section header for all entity dashboards) |
| Gallery album photos | "My Gallery" + "Unassigned Photos" | "Community Gallery" (with subtitle: "Photos shared with the community in albums.") |
| The selected avatar | "Profile picture" / "avatar" / "profile photo" | "Profile picture" (consistently) |
| The selected cover | "Cover photo" / "cover image" | "Cover image" (consistently) |

### 3.2 Proposed Behavioral Alignment

| Behavior | Current | Proposed |
|----------|---------|----------|
| Auto-cover on first upload | Profile + Event only | ALL entity photo surfaces (Profile, Event, Venue, Blog) |
| Delete pattern | Mixed (soft/hard/orphan) | Soft-delete (`deleted_at`) everywhere, including gallery unassigned |
| Blog cover removal | Orphans storage file | Delete from storage on removal |
| Cover badge styling | Hardcoded `bg-emerald-500` | Theme token `--pill-bg-success` / `--pill-fg-success` |

### 3.3 Proposed Aspect Ratio Contract

| Surface | Upload Aspect | Display Aspect | Rationale |
|---------|--------------|----------------|-----------|
| Profile | 1:1 | 1:1 | Avatar is circular/square |
| Event cover | **3:2** (align with CONTRACTS.md) | 3:2 | Matches card display; eliminates upload→display mismatch |
| Event photos | 3:2 | 3:2 grid → natural lightbox | Consistent with cover |
| Venue | 16:9 | 16:9 header → 1:1 grid | Wide venue shots are the common case |
| Blog cover | **16:9** (specify explicitly) | 16:9 header | Standard blog header ratio |
| Gallery | User-chosen | 1:1 grid → natural lightbox | Creative freedom |

### 3.4 Proposed Max File Size Contract

| Surface | Proposed Max | Rationale |
|---------|-------------|-----------|
| All entity photos | 5 MB | Sufficient for web display; consistent |
| Gallery photos | 5 MB (reduce from 10 MB) | Align with entity limit; 5 MB is generous for web |

OR: Raise all to 10 MB for consistency. Either direction resolves the mismatch; 5 MB is recommended for page performance.

### 3.5 Proposed EventForm Cover → Entity Photos Unification

The EventForm "Cover Image" upload should create an `event_images` row in addition to setting `events.cover_image_url`. This ensures:
- The cover appears in the photo grid
- No duplicate uploads needed
- Cover can be changed by selecting a different grid photo

This mirrors how Profile and Venue photos already work (upload → grid → select as cover/avatar).

### 3.6 Proposed Storage Path Normalization

| Bucket | Entity | Proposed Path |
|--------|--------|---------------|
| `avatars` | Profile | `profiles/{userId}/{fileId}.{ext}` |
| `avatars` | Venue | `venues/{venueId}/{fileId}.{ext}` (no change) |
| `event-images` | Event | `events/{eventId}/{fileId}.{ext}` (normalize to entity-scoped) |
| `gallery-images` | Gallery | `gallery/{userId}/{fileId}.{ext}` (no change) |
| `blog-images` | Blog | `blogs/{authorId}/{fileId}.{ext}` (no change) |

The key fix: EventForm covers should use `events/{eventId}/*` (matching EventPhotosSection) instead of `{userId}/*`.

---

## 4. Risks + Classification

### Risk 1: EventForm Cover Upload Creates Orphan Images

**Severity:** non-blocking
**Category:** correctness

**Finding:** EventForm cover uploads write to `event-images/{userId}/{timestamp}` and only set `events.cover_image_url`. No `event_images` row is created. If the user later uploads a different cover, the previous file remains in storage with no DB reference.

**Evidence:** `EventForm.tsx:1912` (storage path uses `{userId}`) vs `EventPhotosSection.tsx:47` (uses `{eventId}`)

**Impact:** Storage bloat over time; orphaned files cannot be cleaned up without scanning all `events.cover_image_url` values. If a user changes cover 10 times, 9 files are orphaned.

**Mitigation:** Unify cover upload path with EventPhotosSection (Section 3.5).

### Risk 2: Blog Cover Removal Orphans Storage Files

**Severity:** non-blocking
**Category:** correctness

**Finding:** `BlogPostForm.tsx:150` clears `cover_image_url` from state but does NOT call `supabase.storage.from('blog-images').remove([...])`. The file persists in storage indefinitely.

**Evidence:** `BlogPostForm.tsx:150` — `setFormData(prev => ({ ...prev, cover_image_url: "" }))` — no storage deletion.

**Impact:** Same as Risk 1 — storage orphans accumulate. Smaller scale (fewer blog posts than events) but still a correctness issue.

**Mitigation:** Add storage deletion on cover removal, matching the pattern in `ProfilePhotosSection.tsx:138-139`.

### Risk 3: Hard Delete of Unassigned Gallery Photos Violates §8 (Dead States)

**Severity:** blocking
**Category:** correctness

**Finding:** `UnassignedPhotosManager.tsx` performs hard deletes — the row is removed from `gallery_images` and the file is removed from storage. This is the ONLY surface in the platform that permanently destroys user content without a soft-delete intermediate step.

**Evidence:** `UnassignedPhotosManager.tsx` — delete handler removes rows and storage files. Contrast with `ProfilePhotosSection.tsx:127-129` (soft-delete via `deleted_at`), `EventPhotosSection.tsx:130-133` (soft-delete), `VenuePhotosSection.tsx:127-130` (soft-delete).

**Impact:** If a user accidentally deletes an unassigned photo, there is no recovery path. This violates DSC UX Principles §8: "Any state the system allows must also be manageable" and "If users can create it, they must be able to... Delete it" (with the implication of recoverability per §11 soft constraints).

**Mitigation:** Change to soft-delete pattern (`deleted_at` timestamp) matching all other entity photo surfaces.

### Risk 4: Aspect Ratio Mismatch Between Upload Recommendation and Display Contract

**Severity:** non-blocking
**Category:** cosmetic

**Finding:** EventForm recommends 4:3 uploads ("Most phone photos are already 4:3") but CONTRACTS.md specifies 3:2 for card display (`aspect-[3/2]`). Images uploaded at 4:3 are cropped to 3:2 on cards, cutting off ~8% of vertical content.

**Evidence:** `EventForm.tsx:1916` ("Recommended: 1200x900px (4:3)") vs `CONTRACTS.md` Event Poster Media (`aspect-[3/2]`)

**Impact:** Hosts may compose cover images with important content near edges that gets cropped on cards. The recommendation actively misleads.

**Mitigation:** Change EventForm recommendation to 3:2 (1200x800px) to match display contract. Update `aspectRatio` prop from `4/3` to `3/2`.

### Risk 5: Venue Auto-Cover Missing Creates Unnecessary Friction

**Severity:** non-blocking
**Category:** cosmetic

**Finding:** Profile and Event surfaces auto-set the first uploaded photo as avatar/cover. Venue does not. A venue manager who uploads their first venue photo must then separately click "Set as cover" — an extra step that Profile and Event surfaces automate.

**Evidence:** `ProfilePhotosSection.tsx:90-108` (auto-avatar), `EventPhotosSection.tsx:95-111` (auto-cover), `VenuePhotosSection.tsx` (no auto-cover — absent from file).

**Impact:** Venue managers experience unnecessary friction (§7). With 91 venues in the database, this affects a meaningful number of users.

**Mitigation:** Add auto-cover behavior to VenuePhotosSection matching the existing Event pattern.

---

## 5. Test/Update Plan

### 5.1 Contracts Requiring Update

| Contract | File | Change Needed |
|----------|------|---------------|
| Event Poster Media aspect | `docs/CONTRACTS.md` | Clarify that upload recommendation should be 3:2, not 4:3 |
| Cross-Surface Media Consistency | `docs/CONTRACTS.md` (new section) | Add media consistency contract: auto-cover behavior, delete patterns, aspect ratios, max file sizes |
| Theme token compliance | `docs/CONTRACTS.md` | Add `EventPhotosSection` cover badge to theme token enforcement |

### 5.2 New Tests Needed

| Test Category | Description | Estimated Tests |
|---------------|-------------|-----------------|
| Auto-cover parity | Verify all 3 entity photo surfaces (profile, event, venue) auto-set first upload | 6 |
| Delete pattern parity | Verify all surfaces use soft-delete (no hard deletes) | 4 |
| Aspect ratio contract | Verify EventForm recommendation matches CONTRACTS.md display ratio | 2 |
| File size parity | Verify consistent max file size across surfaces | 3 |
| Theme token compliance | Verify no hardcoded color classes in cover badges | 2 |
| Storage orphan prevention | Verify cover changes/removals clean up previous files | 4 |
| EventForm cover → entity row | Verify cover upload creates `event_images` row | 3 |

**Estimated total:** ~24 new tests

### 5.3 Existing Tests Requiring Update

| Test File | Change |
|-----------|--------|
| `__tests__/phase4-112-profile-photo-auto-avatar.test.ts` | Expand to cross-surface auto-cover parity |
| `__tests__/unassigned-photos-manager.test.tsx` | Update delete expectations from hard to soft |
| `__tests__/gallery-upload-ux-nudges.test.tsx` | Update max file size if changed |
| `components/__tests__/card-variants.test.tsx` | Update aspect ratio expectations if changed |

### 5.4 Documentation Updates

| Document | Change |
|----------|--------|
| `CLAUDE.md` | Add Phase 7A entry to Recent Changes |
| `docs/CONTRACTS.md` | New Cross-Surface Media Consistency section |
| `docs/known-issues.md` | Remove any media-related items resolved by Phase 7A |

---

## 6. Subordinate Architect Critique Output

### 6.1 Assumptions List

1. **Assumption:** Users expect consistent behavior across all photo upload surfaces. *Basis:* DSC UX Principles §14 ("If something feels confusing, it probably is").
2. **Assumption:** Auto-cover on first upload is desirable, not surprising. *Basis:* Profile auto-avatar (Phase 4.112) was intentionally added and documented as positive UX.
3. **Assumption:** Soft-delete is preferable to hard-delete for user content. *Basis:* Every entity photo surface uses soft-delete; §8 requires manageability; §11 prefers recovery over prevention.
4. **Assumption:** Storage orphans are a correctness concern worth fixing, even though they don't affect users directly. *Basis:* §2 requires clean separation of concerns; orphaned files violate data integrity principles.
5. **Assumption:** The 4:3 → 3:2 aspect ratio change in EventForm will not break existing cover images. *Basis:* PosterMedia uses `object-contain` with letterbox, so existing 4:3 images will display correctly in 3:2 containers (with letterboxing).
6. **Assumption:** Reducing gallery max file size from 10 MB to 5 MB will not regress. *Basis:* 5 MB is generous for web-quality photos; no user complaints about the 5 MB limit on entity surfaces.
7. **Assumption:** The `blog-images` bucket orphan issue is low priority due to small blog post volume. *Basis:* Blog posts are admin-authored; volume is orders of magnitude lower than event/venue photos.

### 6.2 Risks (≥3)

#### Risk A

```
Finding: EventForm cover and EventPhotosSection use different storage path formats in the same bucket
Evidence: EventForm.tsx:1912 ({userId}/{timestamp}) vs EventPhotosSection.tsx:47 ({eventId}/{uuid})
Impact: Storage cleanup scripts cannot reliably distinguish cover uploads from entity photos; potential for accidental deletion of covers when cleaning "orphaned" files
Suggested delta: Unify path format to {eventId}/{uuid} for both; create event_images row for covers
Confidence: 0.85
```

#### Risk B

```
Finding: Gallery unassigned photos use hard delete — the only surface doing so
Evidence: UnassignedPhotosManager.tsx delete handler vs ProfilePhotosSection.tsx:127-129, EventPhotosSection.tsx:130-133, VenuePhotosSection.tsx:127-130 (all soft-delete)
Impact: Irreversible user data loss with no admin recovery path; violates §8 Dead States principle
Suggested delta: Change to soft-delete (deleted_at) matching all other surfaces; add admin "recover deleted" option in future phase
Confidence: 0.95
```

#### Risk C

```
Finding: Venue photos missing auto-cover creates inconsistency with Profile and Event surfaces
Evidence: VenuePhotosSection.tsx (no auto-cover logic) vs ProfilePhotosSection.tsx:90-108 (auto-avatar) and EventPhotosSection.tsx:95-111 (auto-cover)
Impact: Venue managers experience extra friction; may leave venue without cover image, degrading venue card display on /venues listing
Suggested delta: Add auto-cover logic to VenuePhotosSection matching the existing Event pattern (if images.length === 0 && !currentCoverUrl, auto-set)
Confidence: 0.90
```

#### Risk D

```
Finding: Blog cover removal orphans files in storage with no cleanup mechanism
Evidence: BlogPostForm.tsx:150 clears state only; no supabase.storage.from('blog-images').remove() call
Impact: Storage accumulation over time; small scale but sets a bad pattern
Suggested delta: Add storage deletion on cover removal (same pattern as ProfilePhotosSection.tsx:138-139)
Confidence: 0.80
```

### 6.3 Suggested Deltas (≥2)

#### Delta 1: Add Cross-Surface Media Consistency Contract to CONTRACTS.md

```
Finding: No contract exists for media upload consistency across surfaces
Evidence: docs/CONTRACTS.md — has Event Poster Media and Cross-Surface Event contracts but nothing for media upload behavior
Impact: Future feature work may introduce new inconsistencies without a contract to check against; regression risk increases
Suggested delta: Add "Cross-Surface Media Consistency" section to CONTRACTS.md defining: (a) auto-cover behavior requirement for all entity photo surfaces, (b) soft-delete requirement for all user content, (c) storage cleanup requirement on cover changes, (d) consistent max file size, (e) theme token requirement for all badges
Confidence: 0.90
```

#### Delta 2: Unify EventForm Cover Upload with EventPhotosSection

```
Finding: Two separate upload paths for event images create confusion and orphans
Evidence: EventForm.tsx:1912 (cover-only path) vs EventPhotosSection.tsx:47-111 (full entity photo path with auto-cover)
Impact: Covers uploaded via EventForm don't appear in photo grid; hosts may upload same image twice; orphaned files in storage
Suggested delta: EventForm cover upload should use EventPhotosSection's pattern: upload to {eventId}/{uuid}, create event_images row, AND set events.cover_image_url. The EventForm section would then display "this image will also appear in your Happening Photos"
Confidence: 0.75
```

#### Delta 3: Standardize Terminology in Upload Section Headers

```
Finding: "Profile Photos", "Happening Photos", "Venue Photos" are ambiguous — users may conflate these with gallery photos
Evidence: ProfilePhotosSection.tsx:201, EventPhotosSection.tsx:199, VenuePhotosSection.tsx:198 (headers) vs UserGalleryUpload.tsx (gallery upload)
Impact: Users may not understand the difference between entity photos (private to dashboard) and gallery photos (public community albums)
Suggested delta: Add clarifying subtitles: "These photos are for [your profile/this happening/this venue]. To share photos with the community, use the Gallery." Keep section headers short but add disambiguation.
Confidence: 0.70
```

---

## STOP — Awaiting Sami Approval

This investigation is complete. No code has been modified. The following actions require explicit approval before proceeding:

1. **Create implementation plan** for Phase 7A execution based on the canonical media model proposal (Section 3)
2. **Prioritize risks** — which risks to address first
3. **Scope decision** — full media model unification vs targeted fixes only
4. **File size decision** — standardize on 5 MB or 10 MB
5. **Aspect ratio decision** — change EventForm to 3:2 or update CONTRACTS.md to 4:3

**No implicit approvals. Silence is not consent.**
