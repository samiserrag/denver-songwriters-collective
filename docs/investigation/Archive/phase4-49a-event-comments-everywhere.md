# Phase 4.49a: Event Comments Everywhere — STOP-GATE Investigation

> **Status:** Investigation complete. Awaiting Sami's approval before implementation.
> **Date:** 2026-01-07

---

## Goal

Every event detail page (`/events/[id]`) shows a Comments section. Any visitor can comment:
- **Members**: Sign in and comment directly
- **Guests**: Provide name + email, verify via 6-digit code, then comment

This aligns with guest patterns established in Phase 4.48b (Guest RSVP Support).

---

## Current State Analysis

### Existing Comment Components

| Component | Table | Used On | Guest Support |
|-----------|-------|---------|---------------|
| `CommentThread.tsx` | Multiple (gallery, blog, profiles, open_mic) | Gallery, Blog, Profiles | NO |
| `OpenMicComments.tsx` | `open_mic_comments` | NOT USED | NO |
| `EventComments.tsx` | `event_comments` | NOT USED | NO |

### Existing Comment Tables

| Table | user_id | is_deleted | is_hidden | parent_id | Guest Columns |
|-------|---------|------------|-----------|-----------|---------------|
| `event_comments` | NOT NULL | NO | YES | YES | NO |
| `open_mic_comments` | NOT NULL | YES | YES | YES | NO |
| `gallery_photo_comments` | NOT NULL | YES | YES | YES | NO |
| `gallery_album_comments` | NOT NULL | YES | YES | YES | NO |
| `blog_comments` | NOT NULL (author_id) | YES | YES | YES | NO |
| `profile_comments` | NOT NULL (author_id) | YES | YES | YES | NO |

**Key Finding:** NONE of the comment tables currently support guest comments. All require `user_id NOT NULL`.

### CommentThread Supported Tables

The generic `CommentThread.tsx` component supports these tables:
- `gallery_photo_comments`
- `gallery_album_comments`
- `blog_comments`
- `open_mic_comments`
- `profile_comments`

**Missing:** `event_comments` is NOT in the CommentThread tableName union type.

### Existing API Routes

| Route | Table | DSC-Only Gate |
|-------|-------|---------------|
| `/api/events/[id]/comments` | `event_comments` | YES (line 86-88) |

The existing API route blocks comments on non-DSC events:
```typescript
if (!event.is_dsc_event) {
  return NextResponse.json({ error: "Comments only available for DSC events" }, { status: 400 });
}
```

---

## Decision: Which Table to Use?

### Option A: Use `event_comments` table (RECOMMENDED)

**Pros:**
- Already exists with proper FK to `events`
- Has `is_host_only` for private host notes
- Has `is_hidden` and `hidden_by` for moderation
- Has `parent_id` for threading
- API route exists (needs DSC gate removal)

**Cons:**
- Missing `is_deleted` column (soft delete)
- Missing guest columns (`guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`)

### Option B: Use `open_mic_comments` table

**Pros:**
- Has `is_deleted` column
- Already in CommentThread tableName union

**Cons:**
- Name implies "open mic only"
- Would need to serve ALL event types (confusing)
- Duplicate data model with `event_comments`

**Recommendation:** Use `event_comments` and add missing columns.

---

## Recommended Approach

### Phase 4.49a: Enable Comments for ALL Events (Member-Only)

Minimal changes to enable comments on every event detail page, members only.

**Changes:**

1. **Remove DSC gate** in `/api/events/[id]/comments/route.ts` (line 86-88)
2. **Add `event_comments` to CommentThread** tableName union type
3. **Add `is_deleted` column** to `event_comments` table
4. **Mount CommentThread** on `/events/[id]/page.tsx` below the main content

**No guest support yet** — Phase 4.49b will add guest comments.

### Phase 4.49b: Add Guest Comment Support (Future)

1. **Migration:** Add guest columns to `event_comments`:
   - `guest_name text`
   - `guest_email text`
   - `guest_verified boolean DEFAULT FALSE`
   - `guest_verification_id uuid REFERENCES guest_verifications(id)`
   - Make `user_id` nullable with CHECK constraint

2. **API:** Add guest comment endpoints:
   - `POST /api/guest/comment/request-code` — Send verification code
   - `POST /api/guest/comment/verify` — Verify code and post comment

3. **UI:** Update CommentThread or create EventCommentThread with guest form

---

## Files to Change (Phase 4.49a)

| File | Change |
|------|--------|
| `supabase/migrations/20260107000002_event_comments_soft_delete.sql` | Add `is_deleted` column |
| `web/src/app/api/events/[id]/comments/route.ts` | Remove DSC gate |
| `web/src/components/comments/CommentThread.tsx` | Add `event_comments` to tableName |
| `web/src/app/events/[id]/page.tsx` | Mount CommentThread component |

### Migration Content

```sql
-- Phase 4.49a: Add soft delete to event_comments
ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_event_comments_visible
  ON public.event_comments(event_id)
  WHERE is_deleted = FALSE AND is_hidden = FALSE;
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Spam on public events | Rate limiting already exists (10 comments/5min/user) |
| Inappropriate content | `is_hidden` + `hidden_by` columns exist for moderation |
| Missing soft delete | Migration adds `is_deleted` column |
| CommentThread FK hint | Need to verify FK name: `event_comments_user_id_fkey` |

---

## Rollback Plan

1. Remove CommentThread from `/events/[id]/page.tsx`
2. Revert API route to DSC-only gate
3. Remove `event_comments` from CommentThread tableName union
4. Migration is additive (column add) — no rollback needed

---

## Acceptance Tests (Phase 4.49a)

| Test | Expected |
|------|----------|
| Member visits `/events/[id]` | Sees "Comments" section |
| Member posts comment | Comment appears in list |
| Non-logged-in visitor | Sees "Sign in to leave a comment" |
| DSC event comments | Work (unchanged) |
| Non-DSC event comments | Work (NEW - previously blocked) |
| Comment soft delete | Author can delete own comment |
| Comment moderation | Host/admin can hide comments |

---

## Open Questions for Sami

1. **Should comments be enabled for ALL events immediately, or phased rollout (DSC first, then community)?**
   - Recommendation: All events — simpler, consistent UX

2. **Should hosts be able to disable comments on their events?**
   - Recommendation: Not in 4.49a — keep scope minimal. Could add `comments_enabled` column later if needed.

3. **Proceed with Phase 4.49a (member-only) first, then 4.49b (guest support)?**
   - Recommendation: Yes — smaller, safer increments

---

## STOP-GATE APPROVAL

**Awaiting Sami's approval before proceeding with implementation.**

- [ ] Sami approves Phase 4.49a approach
- [ ] Sami confirms member-only first (guest support in 4.49b)
- [ ] Sami confirms comments for ALL events (not just DSC)
