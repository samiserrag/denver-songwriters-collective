# Venue Cover Image — Investigation Document

**Phase:** Venue Cover Image Upload + Display
**Status:** Step 0 Investigation Complete — Awaiting Approval
**Date:** January 2026

---

## Summary

Add cover image upload capability to venues, allowing admins and venue managers to upload/update venue cover images. Images should display on venue detail pages and optionally venue cards.

---

## Step 0A: Schema Check

### Current `venues` Table Structure

The `venues` table does **NOT** currently have a `cover_image_url` column.

**Current columns (from `database.types.ts`):**
- `id`, `slug`, `name`
- `address`, `city`, `state`, `zip`, `neighborhood`
- `phone`, `website_url`, `google_maps_url`, `map_link`, `contact_link`
- `accessibility_notes`, `parking_notes`, `notes`
- `created_at`, `updated_at`

### Naming Pattern Precedent

Other tables use `cover_image_url`:
- `events.cover_image_url` — Event poster/flyer
- `blog_posts.cover_image_url` — Blog header image
- `gallery_albums.cover_image_url` — Album cover

**Recommendation:** Add `cover_image_url TEXT` column to `venues` table (consistent naming).

### Storage Bucket

The codebase uses `gallery-images` bucket for:
- Gallery photo uploads (`BulkUploadGrid.tsx`)
- User avatar uploads

**Options:**
1. **Reuse `gallery-images`** — Simpler, already exists, bucket policies in place
2. **Create `venue-images`** — Better organization, but requires bucket creation + policies

**Recommendation:** Reuse `gallery-images` bucket with path convention: `venue-covers/{venue_id}/{filename}`

---

## Step 0B: Permissions Check

### Existing Venue Manager Auth System

**File:** `web/src/lib/venue/managerAuth.ts`

The codebase has a complete venue manager authorization system:

| Function | Purpose |
|----------|---------|
| `getActiveVenueGrant(supabase, venueId, userId)` | Get user's active grant for venue |
| `isVenueManager(supabase, venueId, userId)` | Check if user is manager (any role) |
| `isVenueOwner(supabase, venueId, userId)` | Check if user is specifically owner |
| `canEditVenue(supabase, venueId, userId)` | Check edit permission |
| `sanitizeVenuePatch(patch)` | Sanitize update fields to allowed list |

### Manager-Editable Fields (Current)

From `MANAGER_EDITABLE_VENUE_FIELDS`:
```typescript
[
  "name", "address", "city", "state", "zip", "phone",
  "website_url", "google_maps_url", "map_link", "contact_link",
  "neighborhood", "accessibility_notes", "parking_notes"
]
```

**Note:** `cover_image_url` needs to be added to this list.

### API Route Pattern

**File:** `web/src/app/api/venues/[id]/route.ts`

The venue PATCH endpoint follows this auth pattern:
```typescript
// Authorization: must be venue manager OR admin
const [isManager, isAdmin] = await Promise.all([
  isVenueManager(supabase, venueId, user.id),
  checkAdminRole(supabase, user.id),
]);

if (!isManager && !isAdmin) {
  return NextResponse.json(
    { error: "You do not have permission to edit this venue" },
    { status: 403 }
  );
}
```

This pattern should be reused for cover image upload.

---

## Step 0C: Uploader Reuse

### Existing `ImageUpload` Component

**File:** `web/src/components/ui/ImageUpload.tsx`

A reusable image upload component with:
- Drag-and-drop support
- Image cropping (ReactCrop library)
- File validation (JPG, PNG, WebP, GIF)
- Configurable aspect ratio and max size
- Remove/replace functionality

**Props:**
```typescript
interface ImageUploadProps {
  currentImageUrl?: string;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  aspectRatio?: number;    // Default: 16/9
  maxSizeMB?: number;      // Default: 5
  shape?: "square" | "wide" | "banner";
  label?: string;
  helpText?: string;
}
```

**Usage Example (from EventForm):**
```tsx
<ImageUpload
  currentImageUrl={event.cover_image_url}
  onUpload={(url) => setValue("cover_image_url", url)}
  onRemove={() => setValue("cover_image_url", "")}
  aspectRatio={16 / 9}
  label="Cover Image"
/>
```

### Upload Pattern

From `BulkUploadGrid.tsx`:
```typescript
// Upload to storage
const { error: uploadError } = await supabase.storage
  .from('gallery-images')
  .upload(fileName, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('gallery-images')
  .getPublicUrl(fileName);
```

---

## Proposed Implementation

### 1. Database Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_venue_cover_image.sql`

```sql
-- Add cover_image_url column to venues table
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN venues.cover_image_url IS 'URL to venue cover/banner image';
```

### 2. Update Manager-Editable Fields

**File:** `web/src/lib/venue/managerAuth.ts`

Add `"cover_image_url"` to `MANAGER_EDITABLE_VENUE_FIELDS` array.

### 3. New API Endpoint for Image Upload

**Option A:** Extend existing `/api/venues/[id]` PATCH endpoint
- Pros: Consistent with current architecture
- Cons: Need to handle file upload in same endpoint

**Option B:** New dedicated endpoint `/api/venues/[id]/cover-image` (POST/DELETE)
- Pros: Clean separation, better for file handling
- Cons: Additional route

**Recommendation:** Option B — separate endpoint for cleaner file handling

**New File:** `web/src/app/api/venues/[id]/cover-image/route.ts`

```
POST /api/venues/[id]/cover-image
  - Accept: multipart/form-data or base64 image
  - Auth: venue manager OR admin
  - Upload to gallery-images/venue-covers/{venue_id}/{timestamp}-{filename}
  - Update venues.cover_image_url

DELETE /api/venues/[id]/cover-image
  - Auth: venue manager OR admin
  - Remove from storage
  - Set venues.cover_image_url = NULL
```

### 4. UI Touchpoints

| Location | Change |
|----------|--------|
| `/venues/[id]/page.tsx` | Display cover image as hero banner if exists |
| `/dashboard/my-venues/page.tsx` | Add "Edit" link/button per venue |
| `/dashboard/my-venues/[id]/page.tsx` (NEW) | Venue edit form with ImageUpload |
| `VenueCard.tsx` (optional) | Show thumbnail cover if exists |
| Admin venue pages | ImageUpload component for admins |

### 5. Storage Path Convention

```
gallery-images/
└── venue-covers/
    └── {venue_id}/
        └── {timestamp}-{original_filename}
```

Example: `gallery-images/venue-covers/abc123/1705123456789-brewery-exterior.jpg`

---

## Tests Required

| Test File | Coverage |
|-----------|----------|
| `__tests__/venue-cover-image-upload.test.ts` | API endpoint auth, upload, delete |
| `__tests__/venue-cover-image-display.test.ts` | UI rendering on detail page |
| `managerAuth.test.ts` (update) | Verify cover_image_url in allowed fields |

**Minimum test count:** 15-20 tests

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Storage costs | Use reasonable max size (5MB), standard compression |
| Orphaned files | Delete from storage when cover removed |
| Permission bypass | Reuse proven `isVenueManager` + `checkAdminRole` pattern |
| Missing column in queries | Update all venue SELECT queries to include `cover_image_url` |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_*.sql` | ADD COLUMN cover_image_url |
| `lib/venue/managerAuth.ts` | Add to MANAGER_EDITABLE_VENUE_FIELDS |
| `lib/supabase/database.types.ts` | Regenerate types |
| `app/api/venues/[id]/cover-image/route.ts` | NEW: Upload/delete endpoints |
| `app/venues/[id]/page.tsx` | Display cover image hero |
| `app/(protected)/dashboard/my-venues/page.tsx` | Add edit venue link |
| `app/(protected)/dashboard/my-venues/[id]/page.tsx` | NEW: Venue edit form |
| `components/venue/VenueCard.tsx` | Optional thumbnail display |

---

## STOP-GATE

**Awaiting approval before proceeding with Step 1 (Schema migration).**

Questions for approval:
1. Confirm storage bucket: reuse `gallery-images` or create `venue-images`?
2. Confirm API approach: dedicated endpoint (`/cover-image`) or extend PATCH?
3. Confirm display: hero banner on detail page, thumbnail on cards?
4. Any additional UI surfaces needed?

---

## Appendix: Key File References

- Venue manager auth: `web/src/lib/venue/managerAuth.ts`
- Venue API: `web/src/app/api/venues/[id]/route.ts`
- ImageUpload component: `web/src/components/ui/ImageUpload.tsx`
- Storage upload pattern: `web/src/components/gallery/BulkUploadGrid.tsx:330-332`
- Venue detail page: `web/src/app/venues/[id]/page.tsx`
- Venue claiming migration: `supabase/migrations/20260112000000_abc8_venue_claiming.sql`
