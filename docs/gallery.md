# Gallery Feature

## Overview

Community-submitted photo albums with admin approval workflow.

## Database Schema

### `gallery_images`

```sql
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  album_id UUID REFERENCES gallery_albums(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `gallery_albums`

```sql
CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

```sql
-- gallery_images
CREATE INDEX gallery_images_uploaded_by_idx ON gallery_images(uploaded_by);
CREATE INDEX gallery_images_event_idx ON gallery_images(event_id);
CREATE INDEX gallery_images_venue_idx ON gallery_images(venue_id);
CREATE INDEX gallery_images_approved_idx ON gallery_images(is_approved);
CREATE INDEX gallery_images_album_idx ON gallery_images(album_id);

-- gallery_albums
CREATE INDEX gallery_albums_slug_idx ON gallery_albums(slug);
CREATE INDEX gallery_albums_published_idx ON gallery_albums(is_published);
```

## RLS Policies

### `gallery_images`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| gallery_images_public_read | SELECT | `is_approved = true` |
| gallery_images_own_read | SELECT | `auth.uid() = uploaded_by` |
| gallery_images_insert | INSERT | `auth.uid() = uploaded_by` |
| gallery_images_update_own | UPDATE | `auth.uid() = uploaded_by` |
| gallery_images_delete_own | DELETE | `auth.uid() = uploaded_by` |
| gallery_images_admin | ALL | `is_admin()` |

### `gallery_albums`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| gallery_albums_public_read | SELECT | `is_published = true` |
| gallery_albums_admin_all | ALL | `is_admin()` |

## User Flow

1. **Upload**: User uploads images (stored in Supabase Storage bucket)
2. **Pending**: Images start with `is_approved = false`
3. **Admin Review**: Admin approves via `/dashboard/admin/gallery`
4. **Published**: Approved images/albums appear on public `/gallery` page
5. **Album Detail**: Individual albums at `/gallery/[slug]`

## UI Features

### Public Gallery (`/gallery`)

- **Albums Section**: Shows published albums with cover images and photo counts
- **All Photos Section**: Paginated grid of individual approved photos
- **Pagination**: 24 images per page

### Album Detail (`/gallery/[slug]`)

- **Breadcrumb Navigation**: Gallery → Album Name
- **Album Metadata**: Name, description, photo count, creation date
- **Event/Venue Links**: If album is associated with an event or venue
- **Paginated Grid**: 24 images per page

### Lightbox

- **Keyboard Navigation**: Arrow keys (left/right), Escape to close
- **Prev/Next Buttons**: Visual navigation with hover states
- **Image Counter**: "3 / 24" display
- **Metadata Display**: Caption, photographer name, event/venue
- **Focus Trap**: Body scroll prevented when open
- **Accessibility**: Focus-visible rings, ARIA labels

### GalleryGrid Component

```typescript
// Key features
- Masonry-style CSS columns layout
- Button elements for accessibility (not divs)
- Lazy loading via loading="lazy"
- Focus-visible rings on hover/focus
- Keyboard hint for desktop users
```

## Key Files

### Public Pages

| File | Purpose |
|------|---------|
| `src/app/gallery/page.tsx` | Main gallery page with albums and photos |
| `src/app/gallery/[slug]/page.tsx` | Album detail page |

### Components

| File | Purpose |
|------|---------|
| `src/components/gallery/GalleryGrid.tsx` | Responsive image grid with lightbox |

### Admin

| File | Purpose |
|------|---------|
| `src/app/(protected)/dashboard/admin/gallery/page.tsx` | Admin gallery server component |
| `src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx` | Admin tabs (Photos, Albums, Upload) |

## Storage

Images are stored in Supabase Storage:
- **Bucket**: `gallery` (or configured bucket name)
- **Path Pattern**: `{user_id}/{filename}`
- **Public Access**: Via signed URLs or public bucket

## Lighthouse Scores

| Metric | Score |
|--------|-------|
| Performance | 89 |
| Accessibility | 94 |
| Best Practices | 96 |
| SEO | 100 |

**Note**: LCP ~3.7s is due to text hydration delay, not image loading. Images use `next/image` with lazy loading.

## Migrations

| Migration | Purpose |
|-----------|---------|
| `20251206_gallery_and_blog.sql` | Creates `gallery_images` table with RLS |
| `20251206_gallery_albums.sql` | Creates `gallery_albums` table, adds `album_id` |
