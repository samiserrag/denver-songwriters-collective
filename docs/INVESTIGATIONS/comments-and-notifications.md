# Investigation Report: Threaded Replies + Profile Comments + Notifications

**Date:** January 2026
**Status:** Investigation Only (No Code Changes)

---

## Part 2: Threaded Replies + Profile Comments

### 2.1 Existing Comment Tables

| Table | Entity | Columns | Threading | Moderation |
|-------|--------|---------|-----------|------------|
| `event_comments` | DSC Events | id, event_id, user_id, **parent_id**, content, is_host_only, is_hidden, hidden_by | **Yes** | is_hidden + hidden_by |
| `open_mic_comments` | Open Mics | id, event_id, user_id, content | No | None |
| `blog_comments` | Blog Posts | id, post_id, author_id, content, is_approved | No | is_approved |
| `gallery_album_comments` | Albums | id, album_id, user_id, content, is_deleted | No | is_deleted |
| `gallery_photo_comments` | Photos | id, image_id, user_id, content, is_deleted | No | is_deleted |

**Key Finding:** Only `event_comments` has `parent_id` for threading. Others need schema changes.

### 2.2 Current RLS Policies

| Table | Public Read | Owner Access | Admin Override |
|-------|-------------|--------------|----------------|
| event_comments | Non-hidden, non-host-only | Own comments visible | Yes (via raw_app_meta_data) |
| open_mic_comments | All | Own delete | Admin delete |
| blog_comments | Approved only | Own visible | is_admin() function |
| gallery_*_comments | Non-deleted | Own visible | Admin check |

### 2.3 Current UI Components

| Component | Path | Features |
|-----------|------|----------|
| EventComments | `components/events/EventComments.tsx` | API-routed, no threading UI |
| OpenMicComments | `components/events/OpenMicComments.tsx` | Direct Supabase, delete support |
| BlogComments | `components/blog/BlogComments.tsx` | Server-loaded, read-only after |
| GalleryComments | `components/gallery/GalleryComments.tsx` | Both types, soft delete, cooldown |

### 2.4 Recommended Approach: Add parent_comment_id

**Option A: Add parent_id to existing tables** (RECOMMENDED)

Add `parent_id` column to:
- `blog_comments`
- `gallery_album_comments`
- `gallery_photo_comments`
- `open_mic_comments`

**Why Option A:**
- Minimal migration risk
- Entity-specific RLS stays intact
- Easier to reason about permissions per entity
- No data migration needed

**Option B: Unified comments table** (NOT RECOMMENDED)

Create single `comments` table with:
- `entity_type` (enum: blog, event, gallery_album, gallery_photo, profile, open_mic)
- `entity_id` (uuid reference)
- `parent_comment_id` (self-reference)

**Why NOT Option B:**
- Complex RLS policies (must check entity_type for each rule)
- Harder to index efficiently
- Foreign key constraints to multiple tables not possible
- Would require data migration from 4+ existing tables

### 2.5 Profile Comments (New Table Required)

**Proposed Schema:**
```sql
CREATE TABLE profile_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES profile_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Profile owner can self-moderate, admin can override
```

**Moderation Model:**
- Profile owner: Can hide/delete comments on their profile
- Admin: Can override and force-hide
- Comment author: Can delete own comments

---

## Part 3: Notifications

### 3.1 Existing Notification Infrastructure

**Tables:**
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_notifications` | User inbox | user_id, type (text), title, message, link, is_read |
| `admin_notifications` | Admin queue | user_id, type (enum), title, message, metadata, is_read |

**Notification Types (admin only):**
- new_user, event_signup, correction_submitted
- gallery_created, blog_post_created, volunteer_signup, host_claim

**API Routes:**
- `GET /api/notifications` - Fetch last 50
- `PATCH /api/notifications` - Mark as read

**Helper Functions:**
- `create_user_notification()` - DB function (SECURITY DEFINER)
- `createAdminNotification()` - RPC wrapper in `lib/notifications.ts`

### 3.2 Existing Email Infrastructure

**System:** Nodemailer with Fastmail SMTP

**Templates (13 total, none for comments):**
- verificationCode, claimConfirmed, waitlistOffer
- rsvpConfirmation, waitlistPromotion, hostApproval/Rejection
- contactNotification, newsletterWelcome
- eventReminder, eventUpdated, eventCancelled (templated)
- suggestionResponse

**Rate Limiting:** 1 email/minute per recipient per template

**Kill Switch:** `ENABLE_WEEKLY_DIGEST` env var (default: false)

### 3.3 Recommended Notification Architecture

#### In-App Notifications

**Trigger Points:**
1. New comment on user's blog post → notify post author
2. New comment on user's event → notify event organizer
3. New comment on user's album/photo → notify album owner or photo uploader
4. New comment on user's profile → notify profile owner
5. Reply to user's comment (any entity) → notify parent comment author
6. Admin hides user's comment → notify comment author

**Implementation:**
```typescript
// New helper: createCommentNotification()
export async function createCommentNotification(
  recipientId: string,
  type: 'new_comment' | 'comment_reply' | 'comment_hidden',
  entityType: 'blog' | 'event' | 'gallery_album' | 'gallery_photo' | 'profile',
  entityId: string,
  commenterId: string,
  commentPreview: string
) {
  // Call create_user_notification() RPC
}
```

#### Email Notifications

**User Preference Table:**
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_comments BOOLEAN DEFAULT true,
  email_replies BOOLEAN DEFAULT true,
  email_digest BOOLEAN DEFAULT false, -- Weekly digest instead of immediate
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

**Dashboard UI Location:** `/dashboard/settings` (new preferences tab)

**Email Templates Needed:**
1. `commentNotification` - Immediate: "New comment on your [entity]"
2. `commentReplyNotification` - Immediate: "[Name] replied to your comment"
3. `weeklyCommentDigest` - Batched: "Your weekly activity summary"

#### Weekly Digest Integration

**Respect Kill Switch:**
```typescript
import { isWeeklyDigestEnabled } from '@/lib/featureFlags';

// In digest cron job:
if (!isWeeklyDigestEnabled()) {
  console.log('Weekly digest disabled via kill switch');
  return;
}
```

**Recipient Computation Rules:**
| Notification Type | Recipients |
|-------------------|------------|
| New comment on blog | Post author + admin |
| New comment on event | Event organizer + admin |
| New comment on album | Album owner + admin |
| New comment on photo | Photo uploader + album owner + admin |
| New comment on profile | Profile owner + admin |
| Reply to comment | Parent comment author |

---

## Recommended PR Sequence

### PR2: Threaded Replies (Database + UI)

**Scope:**
1. Migration: Add `parent_id` to 4 comment tables
2. Migration: Create `profile_comments` table
3. Update RLS policies for threading
4. Create `CommentThread` component (recursive rendering)
5. Add reply UI to existing comment components
6. Add profile comments section to `/members/[id]` page

**Estimated Files:**
- 1 migration file
- 1 new component (`CommentThread.tsx`)
- 4 component updates (existing comment components)
- 1 page update (`/members/[id]/page.tsx`)

### PR3: Notifications (In-App + Email)

**Scope:**
1. Migration: Create `notification_preferences` table
2. Create notification preference UI in dashboard settings
3. Add notification triggers to comment creation flows
4. Create email templates for comment notifications
5. Create weekly digest email template
6. Add cron job for weekly digest (Vercel Cron or Edge Function)

**Estimated Files:**
- 1 migration file
- 3 email templates
- 1 settings page component
- 1 cron/edge function
- Updates to comment API routes

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Notification spam | Rate limit + digest option |
| Infinite reply chains | UI depth limit (3 levels) |
| Performance on deep threads | Limit fetch to 2 levels, "Load more" |
| Email deliverability | Use existing Fastmail SMTP |
| Privacy concerns | Respect notification preferences |

---

## Appendix: File Locations

| Purpose | Path |
|---------|------|
| Database types | `web/src/lib/supabase/database.types.ts` |
| Event comments | `web/src/components/events/EventComments.tsx` |
| Blog comments | `web/src/components/blog/BlogComments.tsx` |
| Gallery comments | `web/src/components/gallery/GalleryComments.tsx` |
| Notification API | `web/src/app/api/notifications/route.ts` |
| Notification helpers | `web/src/lib/notifications.ts` |
| Email system | `web/src/lib/email/` |
| Feature flags | `web/src/lib/featureFlags.ts` |
