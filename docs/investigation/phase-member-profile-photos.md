# Investigation: Member Profile Image Gallery + Choose Profile Image

**Phase:** Member Profile Enhancements — Slice 5
**Mode:** INVESTIGATION (NO EXECUTION)
**Status:** Awaiting STOP-GATE approval

---

## 1. Goal

Enable members to upload multiple profile images (a personal gallery) and choose which image to display as their profile avatar. This should work in both onboarding and the dashboard profile editor.

---

## 2. Current State Findings

### 2.1 Profile Avatar Schema

**Table:** `profiles`
**Column:** `avatar_url` (TEXT, nullable)

Current schema stores a single avatar URL:
```typescript
// From database.types.ts (lines 2256, 2301, 2346)
avatar_url: string | null
```

**Current Storage Path Pattern:**
```
avatars/{user_id}/avatar.{ext}
```

The profile edit page (`dashboard/profile/page.tsx`) handles avatar upload:
- Uses `ImageUpload` component with `aspectRatio={1}` and `shape="circle"`
- Uploads to `avatars` bucket with path `{userId}/avatar.{ext}`
- Uses `upsert: true` to replace existing avatar
- Updates `profiles.avatar_url` directly after upload

### 2.2 Existing Gallery Infrastructure

**Tables:**
- `gallery_albums` — Album metadata (cover_image_url, created_by, etc.)
- `gallery_images` — Individual photos (image_url, album_id, uploaded_by, etc.)

**Storage Bucket:** `gallery-images`
- 10MB max file size
- Public bucket
- Path pattern: `{user_id}/photo-{timestamp}-{uuid}.{ext}`

**Cover Image Selection Pattern (from AlbumManager.tsx):**
```typescript
// Set cover image
const handleSetCover = useCallback(async (imageUrl: string) => {
  const supabase = createClient();
  const { error } = await supabase
    .from("gallery_albums")
    .update({ cover_image_url: imageUrl })
    .eq("id", album.id);
  // ...
}, [album.id, router]);
```

This pattern can be adapted for profile images.

### 2.3 Storage Buckets & RLS

**`avatars` bucket (current profile photos):**
- 5MB max, public
- RLS: Users can only access files in their own folder (`{user_id}/*`)

**`gallery-images` bucket:**
- 10MB max, public
- RLS: Users can only upload/modify in their own folder

### 2.4 ImageUpload Component

Located at `components/ui/ImageUpload.tsx`:
- Supports drag-and-drop, cropping, aspect ratio enforcement
- Props: `currentImageUrl`, `onUpload`, `onRemove`, `aspectRatio`, `shape`
- Handles single image upload with crop modal
- Output: 800x800px max for square (1:1) images

### 2.5 Onboarding Profile

Located at `app/onboarding/profile/page.tsx`:
- Currently does NOT include avatar upload
- Uses accordion sections for different profile fields
- Conditional sections based on identity flags

---

## 3. Schema Design Options

### Option A: New `profile_images` Table (RECOMMENDED)

Create a dedicated table for profile images, similar to `gallery_images` but profile-specific.

**Pros:**
- Clean separation from community gallery
- Dedicated RLS policies for profile images
- Easy to add future profile-specific metadata (e.g., "professional", "casual")
- No risk of profile photos appearing in public gallery
- Simpler queries for profile-related operations

**Cons:**
- New table and storage management
- Slightly more code to maintain

**Schema:**
```sql
CREATE TABLE profile_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT profile_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Index for fast user lookups
CREATE INDEX idx_profile_images_user_id ON profile_images(user_id);

-- RLS: Users can only manage their own images
ALTER TABLE profile_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile images"
  ON profile_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile images"
  ON profile_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile images"
  ON profile_images FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view profile images (for profile pages)
CREATE POLICY "Public can view profile images"
  ON profile_images FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = profile_images.user_id AND profiles.is_public = true
    )
  );
```

**Storage:** Reuse existing `avatars` bucket with extended path pattern:
```
avatars/{user_id}/gallery/{timestamp}-{uuid}.{ext}
avatars/{user_id}/avatar.{ext}  -- Selected profile image (legacy path)
```

### Option B: Reuse `gallery_images` Table

Add a `profile_id` column to `gallery_images` to tag images as belonging to a profile gallery.

**Pros:**
- Reuses existing table and infrastructure
- Less migration work

**Cons:**
- Muddies the distinction between community gallery and profile photos
- More complex RLS policies
- Risk of accidental exposure in public gallery
- Harder to enforce profile-specific constraints

**Not Recommended** due to conceptual mixing and RLS complexity.

### Option C: Array Column on Profiles

Store multiple image URLs as a JSONB or TEXT[] array on the profiles table.

**Pros:**
- No new table
- Simple queries

**Cons:**
- Harder to manage (no cascade delete for storage files)
- No metadata per image (sort order, timestamps)
- Limited query flexibility
- Against relational best practices

**Not Recommended** due to maintenance complexity.

---

## 4. Recommended Approach: Option A

### 4.1 Migration (Draft)

```sql
-- ==========================================================
-- Migration: profile_images table for member photo gallery
-- ==========================================================

-- 1. Create profile_images table
CREATE TABLE IF NOT EXISTS profile_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_profile_images_user_id ON profile_images(user_id);

-- 3. Enable RLS
ALTER TABLE profile_images ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can view their own profile images
CREATE POLICY "Users can view own profile images"
  ON profile_images FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own profile images
CREATE POLICY "Users can insert own profile images"
  ON profile_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile images (for reordering)
CREATE POLICY "Users can update own profile images"
  ON profile_images FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profile images
CREATE POLICY "Users can delete own profile images"
  ON profile_images FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public can view profile images for public profiles
CREATE POLICY "Public can view public profile images"
  ON profile_images FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_images.user_id
      AND profiles.is_public = true
    )
  );

-- Admins can view all profile images
CREATE POLICY "Admins can view all profile images"
  ON profile_images FOR SELECT
  TO authenticated
  USING (is_admin());

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================
```

### 4.2 Storage Path Pattern

Use the existing `avatars` bucket with subfolder for gallery:
```
avatars/{user_id}/gallery/{timestamp}-{uuid}.{ext}
```

The current RLS policy already allows this:
```sql
-- "Users can upload their own avatar"
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 4.3 Flow: Choose Profile Image

When user selects an image from their gallery as profile avatar:
1. Copy the selected `image_url` to `profiles.avatar_url`
2. No file copy needed (same storage bucket)
3. `profiles.avatar_url` remains the source of truth for display

**Alternative:** Add `selected_image_id UUID REFERENCES profile_images(id)` to profiles table. This provides referential integrity but adds complexity. Recommend simple URL copy for MVP.

---

## 5. Files to Modify

### 5.1 New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_profile_images.sql` | Schema migration |
| `components/profile/ProfileImageGallery.tsx` | Gallery grid with upload, reorder, delete, select |
| `components/profile/ProfileImagePicker.tsx` | Modal/dropdown to choose profile image |

### 5.2 Modified Files

| File | Change |
|------|--------|
| `app/(protected)/dashboard/profile/page.tsx` | Add ProfileImageGallery section, integrate with existing avatar display |
| `app/onboarding/profile/page.tsx` | Add profile image upload step (optional) |
| `lib/supabase/database.types.ts` | Regenerate after migration |

### 5.3 Components to Reuse

| Component | How |
|-----------|-----|
| `ImageUpload` | For adding new images to gallery |
| `SortableContext` (dnd-kit) | For drag-and-drop reordering (pattern from AlbumManager) |

---

## 6. UI/UX Design

### 6.1 Dashboard Profile Page

Add new section "Profile Photos" between current avatar and Basic Info:

```
┌─────────────────────────────────────────────────┐
│ Profile Photos                                   │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ [✓]  │ │      │ │      │ │  +   │           │
│  │ img1 │ │ img2 │ │ img3 │ │ Add  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                  │
│  Drag to reorder. Click star to set as profile. │
└─────────────────────────────────────────────────┘
```

- Current profile image shows checkmark/star badge
- "Add" button opens ImageUpload modal
- Drag handles for reordering
- Click image to set as profile avatar
- Delete button on hover

### 6.2 Onboarding (Optional)

Add optional "Add a photo" step in onboarding accordion:
- Single image upload initially
- Can skip ("I'll add photos later")
- Photo becomes profile avatar automatically

---

## 7. Test Plan

| Test Case | Expected |
|-----------|----------|
| Upload image to profile gallery | Image appears in gallery, stored in `profile_images` |
| Set image as profile avatar | `profiles.avatar_url` updated, checkmark shows |
| Reorder images | `sort_order` updates, UI reflects order |
| Delete image | Image removed from gallery and storage |
| Delete selected avatar | Falls back to next image or empty |
| Public profile view | Shows avatar, doesn't expose gallery |
| RLS: Can't access other user's gallery | Query returns empty for other user's images |

---

## 8. Smoke Checklist

- [ ] Upload profile image in dashboard
- [ ] Set image as avatar
- [ ] Reorder images via drag-and-drop
- [ ] Delete profile image
- [ ] View profile page shows correct avatar
- [ ] Onboarding photo upload works (if implemented)
- [ ] RLS prevents cross-user access

---

## 9. STOP-GATE Decisions

### Decision 1: Schema Approach

**Options:**
- A) New `profile_images` table (RECOMMENDED)
- B) Reuse `gallery_images` with `profile_id` column
- C) JSONB/TEXT[] array on profiles table

**Recommendation:** Option A — cleanest separation, best RLS control

**Awaiting approval: [ ]**

### Decision 2: Storage Bucket

**Options:**
- A) Reuse `avatars` bucket with `/gallery/` subfolder (RECOMMENDED)
- B) Create new `profile-gallery` bucket

**Recommendation:** Option A — existing RLS already supports subfolder pattern, no new bucket needed

**Awaiting approval: [ ]**

### Decision 3: Avatar Selection Mechanism

**Options:**
- A) Copy selected image URL to `profiles.avatar_url` (RECOMMENDED)
- B) Add FK `selected_image_id` to profiles table (referential integrity)

**Recommendation:** Option A for MVP — simpler, works with existing avatar display logic

**Awaiting approval: [ ]**

### Decision 4: Max Images Per User

**Options:**
- A) No limit (RECOMMENDED for MVP)
- B) Limit to 10 images
- C) Limit based on role (songwriter gets more)

**Recommendation:** Option A for MVP — can add limits later if storage becomes concern

**Awaiting approval: [ ]**

### Decision 5: Onboarding Integration

**Options:**
- A) Skip for MVP — only dashboard (RECOMMENDED)
- B) Add optional photo step to onboarding

**Recommendation:** Option A — onboarding is already complex, users can add photos from dashboard

**Awaiting approval: [ ]**

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Storage costs | Start with 5MB limit per image, monitor usage |
| Complex UI | Reuse existing components (ImageUpload, dnd-kit) |
| Breaking avatar display | Avatar URL stays in profiles table, no display changes |
| Migration failure | Test locally first, additive-only migration |

---

## 11. Summary

This investigation recommends creating a new `profile_images` table to store multiple profile photos per user, reusing the existing `avatars` storage bucket with a subfolder pattern. The user's selected profile avatar continues to be stored in `profiles.avatar_url` for backwards compatibility.

**Next Steps (after approval):**
1. Apply database migration
2. Regenerate types
3. Build ProfileImageGallery component
4. Integrate into dashboard profile page
5. Add tests
6. Update CLAUDE.md

---

**Document created:** 2026-01-17
**Author:** Claude (repo agent)
**Awaiting:** Sami's STOP-GATE approval on decisions 1-5
