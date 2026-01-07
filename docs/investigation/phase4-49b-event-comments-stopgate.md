# Phase 4.49b: Event Comments Everywhere — STOP-GATE Investigation

> **Status:** Investigation complete. Awaiting Sami's approval before implementation.
> **Date:** 2026-01-07

---

## STEP 0: STOP-GATE Requirements

### 1. Existing Notification System for Blog/Gallery Comments

**Finding: NO comment notifications exist.**

Neither blog nor gallery comments trigger any notifications. The investigation document (`docs/INVESTIGATIONS/comments-and-notifications.md`) proposed this as a future feature but it was never implemented.

**Current notification infrastructure:**
- `notifications` table — user inbox notifications
- `create_user_notification()` — SECURITY DEFINER function for creating notifications
- `sendEmailWithPreferences()` — helper that creates dashboard notification + sends email respecting preferences
- Three preference categories: `claim_updates`, `event_updates`, `admin_notifications`

**No comment-specific templates exist** in `/lib/email/templates/`.

### 2. Tables, Triggers, API Routes for Notifications

| Component | Location | Purpose |
|-----------|----------|---------|
| `notifications` table | DB | User dashboard notifications |
| `notification_preferences` table | DB | User email preference toggles |
| `create_user_notification()` | DB function | Creates notification bypassing RLS |
| `sendEmailWithPreferences()` | `lib/email/sendWithPreferences.ts` | Dashboard notification + email |
| `EMAIL_CATEGORY_MAP` | `lib/notifications/preferences.ts` | Maps template → preference category |
| `/api/notifications` | API route | GET/PATCH user notifications |

**Current preference categories:**
- `claim_updates` — event claims
- `event_updates` — RSVPs, reminders, cancellations
- `admin_notifications` — admin-only alerts

**No triggers exist.** All notifications are created explicitly in API routes.

### 3. Proposed Smallest Re-use Path for EVENT Comments

**Recommendation:** Reuse existing infrastructure with minimal additions.

| Need | Solution |
|------|----------|
| Dashboard notification | Use `create_user_notification()` in comment POST handler |
| Email notification | Use `sendEmailWithPreferences()` + new `eventComment` template |
| Preference category | Add to existing `event_updates` category (matches RSVPs) |
| Host notification | Look up host from `event_hosts` table |
| Reply notification | Look up parent comment author |

**New code required:**
1. Email template: `eventCommentNotification.ts`
2. Add `eventCommentNotification` to `EMAIL_CATEGORY_MAP` under `event_updates`
3. Notification trigger in comment POST handler (both member and guest paths)

**No new tables, triggers, or cron jobs required.**

---

## Implementation Summary

### Schema Changes (Migration)

```sql
-- Add guest support + soft delete to event_comments
ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS guest_name text,
ADD COLUMN IF NOT EXISTS guest_email text,
ADD COLUMN IF NOT EXISTS guest_verified boolean DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id),
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT FALSE;

-- Make user_id nullable (now either member or guest)
ALTER TABLE public.event_comments
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint: must be member OR guest
ALTER TABLE public.event_comments
ADD CONSTRAINT member_or_guest_comment
CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL));

-- Add guest_verifications.comment_id for polymorphic target
ALTER TABLE public.guest_verifications
ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.event_comments(id) ON DELETE SET NULL;

-- Update RLS for guest comments (service role inserts, public reads)
CREATE POLICY "Service role can insert guest comments"
  ON public.event_comments FOR INSERT
  WITH CHECK (
    -- Either authenticated user inserting their own
    (auth.uid() = user_id)
    -- OR service role (for guest comments)
    OR (auth.jwt()->>'role' = 'service_role')
  );
```

### Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/20260107000002_event_comments_guest_support.sql` | Schema migration |
| `web/src/app/api/events/[id]/comments/route.ts` | Remove DSC gate, add notifications |
| `web/src/app/api/guest/event-comment/request-code/route.ts` | NEW: Request verification code |
| `web/src/app/api/guest/event-comment/verify-code/route.ts` | NEW: Verify and post comment |
| `web/src/components/comments/CommentThread.tsx` | Add `event_comments` to tableName union |
| `web/src/components/events/EventComments.tsx` | NEW wrapper using CommentThread |
| `web/src/app/events/[id]/page.tsx` | Mount EventComments component |
| `web/src/lib/email/templates/eventCommentNotification.ts` | NEW: Email template |
| `web/src/lib/notifications/preferences.ts` | Add to EMAIL_CATEGORY_MAP |

### Notification Logic

**On new top-level comment:**
```typescript
// 1. Find event host(s)
const { data: hosts } = await supabase
  .from("event_hosts")
  .select("user_id")
  .eq("event_id", eventId)
  .eq("invitation_status", "accepted");

// 2. For each host, create dashboard notification
for (const host of hosts) {
  await supabase.rpc("create_user_notification", {
    p_user_id: host.user_id,
    p_type: "event_comment",
    p_title: "New comment on your event",
    p_message: `${commenterName} commented on "${eventTitle}"`,
    p_link: `/events/${eventSlug}#comments`,
  });
}

// 3. Send email with preferences
await sendEmailWithPreferences({
  supabase,
  userId: host.user_id,
  templateKey: "eventCommentNotification",
  payload: { to: hostEmail, subject, html, text },
});
```

**On reply:**
```typescript
// Look up parent comment author
const { data: parent } = await supabase
  .from("event_comments")
  .select("user_id, guest_email")
  .eq("id", parentId)
  .single();

// If member, notify via dashboard + optional email
if (parent.user_id) {
  await supabase.rpc("create_user_notification", { ... });
  await sendEmailWithPreferences({ ... });
}
// If guest, no notification (guests don't have accounts)
```

### Guest Flow

Reuses `guest_verifications` table with new `comment_id` column:

1. **Request code:** `POST /api/guest/event-comment/request-code`
   - Creates `guest_verifications` record with `comment_id = NULL`
   - Sends 6-digit code via email

2. **Verify + post:** `POST /api/guest/event-comment/verify-code`
   - Validates code
   - Creates `event_comments` row with guest fields
   - Updates `guest_verifications.comment_id` and `verified_at`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Spam from guests | Rate limiting (existing: 5 codes/hour), verification required |
| Breaking RSVP verification | `comment_id` is separate from `rsvp_id`, no overlap |
| Missing FK hint | Will use `event_comments_user_id_fkey` for profile join |
| Host with no email | Dashboard notification always created (email optional) |

---

## Acceptance Tests (12 required)

1. Comments section appears on DSC event page
2. Comments section appears on community event page
3. Member can post comment and it appears
4. Guest can request verification code
5. Guest can verify and post comment
6. Guest comment shows "(guest)" label, no profile link
7. Reply to comment works (threading)
8. Host receives dashboard notification for new comment
9. Parent comment author receives notification for reply
10. Empty state shows "No comments yet"
11. API no longer returns 400 for community events
12. Guest cannot insert directly via RLS (must use service endpoint)

---

## Open Questions

**None.** All decisions locked per Sami's approval:
- All events immediately
- Comments ON by default
- Guest support now (not future)
- Host controls deferred

---

## STOP-GATE APPROVAL

**Awaiting Sami's approval to proceed with implementation.**

Checklist:
- [ ] Notification re-use path approved (event_updates category, no new system)
- [ ] Guest verification via existing guest_verifications + comment_id column
- [ ] Email template: eventCommentNotification under event_updates preference
