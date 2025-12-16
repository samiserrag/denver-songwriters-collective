# Gallery Posts Feature Implementation Plan

## Overview
Allow users to create photo gallery posts (albums) with descriptions, captions for each photo, and enable commenting on both the gallery as a whole and individual images. Galleries require admin approval before publication.

## Existing Infrastructure (Already Available)
The database already has the required tables:
- `gallery_albums` - Album metadata (name, description, slug, created_by, is_published, cover_image_url, event_id, venue_id)
- `gallery_images` - Individual images (album_id, caption, image_url, is_approved, uploaded_by)

## New Database Requirements

### 1. New Table: `gallery_comments`
```sql
CREATE TABLE gallery_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  image_id UUID REFERENCES gallery_images(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT album_or_image CHECK (
    (album_id IS NOT NULL AND image_id IS NULL) OR
    (album_id IS NULL AND image_id IS NOT NULL)
  )
);
```

### 2. Add `is_approved` column to `gallery_albums`
The table already has `is_published` but we need `is_approved` for admin review workflow.

## Implementation Steps

### Step 1: Database Migration
- Add `gallery_comments` table
- Add `is_approved` column to `gallery_albums` (default false)
- Add RLS policies for both tables

### Step 2: Create Gallery Album Form Component
Similar to `BlogPostForm.tsx`, create `GalleryAlbumForm.tsx`:
- Album name/title
- Description (text area)
- Cover image selection
- Multiple image upload with individual captions
- Optional event/venue association
- Submit for approval workflow

### Step 3: User Dashboard Gallery Page
- `/dashboard/gallery` - List user's gallery albums
- `/dashboard/gallery/new` - Create new album
- `/dashboard/gallery/[id]/edit` - Edit existing album

### Step 4: Public Gallery Album Detail Page
- `/gallery/[slug]` - View individual gallery album
- Display album description, all images with captions
- Comments section for album-level comments
- Click on image to view in lightbox with image-specific comments

### Step 5: Update Gallery Page
- Show approved albums as cards/thumbnails
- Add "Create Album" CTA similar to blog's "Share Your Story"
- Keep existing individual images display as well

### Step 6: Admin Approval Interface
- `/dashboard/admin/gallery` - Already exists, extend to show pending albums
- Add approval workflow for new albums

### Step 7: Gallery Comments Component
Create `GalleryComments.tsx` similar to `BlogComments.tsx`:
- Accept albumId or imageId prop
- Display comments with user avatars
- Allow logged-in users to add comments
- Auto-approve comments (or require approval if desired)

## File Structure

```
web/src/
├── app/
│   ├── gallery/
│   │   ├── page.tsx (update - add album grid + CTA)
│   │   └── [slug]/
│   │       └── page.tsx (NEW - album detail view)
│   └── (protected)/
│       └── dashboard/
│           ├── gallery/
│           │   ├── page.tsx (NEW - user's albums list)
│           │   ├── new/
│           │   │   └── page.tsx (NEW - create album)
│           │   └── [id]/
│           │       └── edit/
│           │           └── page.tsx (NEW - edit album)
│           └── admin/
│               └── gallery/
│                   └── page.tsx (UPDATE - add album approval)
├── components/
│   └── gallery/
│       ├── GalleryGrid.tsx (existing)
│       ├── GalleryAlbumCard.tsx (NEW)
│       ├── GalleryAlbumForm.tsx (NEW)
│       ├── GalleryAlbumView.tsx (NEW)
│       ├── GalleryComments.tsx (NEW)
│       └── index.ts (update exports)
```

## Key Components

### GalleryAlbumCard
- Album cover image thumbnail
- Title
- Image count
- Creator name
- Created date

### GalleryAlbumForm
- Reuse `ImageUpload` component from blog
- Multiple image upload support
- Drag-to-reorder images
- Caption input for each image
- Description textarea
- Event/Venue selector (optional)

### GalleryAlbumView
- Hero with cover image or first image
- Album description
- Masonry grid of images
- Click image for lightbox with per-image comments
- Album-level comments section below

### GalleryComments
- Similar to BlogComments
- Props: albumId OR imageId
- Fetch/display comments for that target
- Comment submission form

## User Flow

1. **Create Album**: User goes to `/dashboard/gallery/new`
2. **Fill Form**: Adds title, description, uploads images with captions
3. **Submit**: Album saved with `is_approved = false`
4. **Admin Review**: Admin sees pending album in admin gallery page
5. **Approval**: Admin approves, sets `is_approved = true`
6. **Public View**: Album appears on `/gallery` page
7. **Comments**: Anyone can view, logged-in users can comment

## Estimated Implementation Order

1. Database migration (gallery_comments + is_approved column)
2. GalleryAlbumForm component
3. Dashboard gallery pages (list, new, edit)
4. GalleryAlbumCard component
5. GalleryAlbumView component
6. Public album detail page (/gallery/[slug])
7. GalleryComments component
8. Update main gallery page with albums + CTA
9. Update admin gallery page for album approval
