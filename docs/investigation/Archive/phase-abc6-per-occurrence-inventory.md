# Phase ABC6: Per-Occurrence Inventory

## Tables in Scope

### Primary Action Tables (4)

| Table | Current Rows | Has date_key | Notes |
|-------|--------------|--------------|-------|
| `event_rsvps` | 10 | No | RSVP to attend event |
| `event_comments` | 7 | No | Comments on event |
| `event_timeslots` | 112 | No | Performer slots |
| `timeslot_claims` | 2 | No | Claims on slots |

### Related Tables (3)

| Table | Current Rows | Needs date_key? | Notes |
|-------|--------------|-----------------|-------|
| `guest_verifications` | 18 | **Yes** | Links to rsvps/comments/claims; has `event_id` but no `date_key` |
| `event_watchers` | 101 | No | Series-level watching (admin notification backstop) |
| `event_lineup_state` | 0 | **Yes** | "Now playing" pointer - needs date awareness for live display |

**STOP-GATE A FINDING:** `guest_verifications` and `event_lineup_state` must be included in scope.

---

## Current Database Schema

### event_rsvps
```
Unique: (event_id, user_id)
Unique partial: (event_id, lower(guest_email)) WHERE guest_email IS NOT NULL AND status <> 'cancelled'
Indexes: event_id, user_id, guest_email, status, offer_expires_at
```

### event_comments
```
No unique constraint
Indexes: event_id, user_id, parent_id, guest_email, guest_verification_id
Partial index: (event_id) WHERE is_deleted = false AND is_hidden = false
```

### event_timeslots
```
Unique: (event_id, slot_index)
Indexes: event_id
FK: Referenced by timeslot_claims.timeslot_id, event_lineup_state.now_playing_timeslot_id
```

### timeslot_claims
```
Partial unique: (timeslot_id) WHERE status NOT IN ('cancelled', 'no_show')
Indexes: member_id, guest_email, offer_expires_at, waitlist
```

### guest_verifications
```
Unique partial: (email, event_id) WHERE verified_at IS NULL AND locked_until IS NULL
Has: event_id, timeslot_id, claim_id, rsvp_id, comment_id
MISSING: date_key (needed to scope verification to specific occurrence)
```

### event_lineup_state
```
PK: event_id
Has: now_playing_timeslot_id
MISSING: date_key (needed for multi-occurrence lineup display)
```

---

## API Routes Inventory

### RSVP Routes (4 files)
| Route | Method | File |
|-------|--------|------|
| `/api/events/[id]/rsvp` | GET, POST, DELETE, PATCH | `app/api/events/[id]/rsvp/route.ts` |
| `/api/guest/rsvp/request-code` | POST | `app/api/guest/rsvp/request-code/route.ts` |
| `/api/guest/rsvp/verify-code` | POST | `app/api/guest/rsvp/verify-code/route.ts` |
| `/api/my-events/[id]/rsvps` | GET | `app/api/my-events/[id]/rsvps/route.ts` |

### Comment Routes (4 files)
| Route | Method | File |
|-------|--------|------|
| `/api/events/[id]/comments` | GET, POST | `app/api/events/[id]/comments/route.ts` |
| `/api/comments/[id]` | PATCH, DELETE | `app/api/comments/[id]/route.ts` |
| `/api/guest/event-comment/request-code` | POST | `app/api/guest/event-comment/request-code/route.ts` |
| `/api/guest/event-comment/verify-code` | POST | `app/api/guest/event-comment/verify-code/route.ts` |
| `/api/guest/comment-delete/request-code` | POST | `app/api/guest/comment-delete/request-code/route.ts` |
| `/api/guest/comment-delete/verify-code` | POST | `app/api/guest/comment-delete/verify-code/route.ts` |

### Timeslot Routes (4 files)
| Route | Method | File |
|-------|--------|------|
| `/api/my-events/[id]` | PATCH (timeslot config) | `app/api/my-events/[id]/route.ts` |
| `/api/my-events` | POST (create with timeslots) | `app/api/my-events/route.ts` |
| `/api/guest/timeslot-claim/request-code` | POST | `app/api/guest/timeslot-claim/request-code/route.ts` |
| `/api/guest/timeslot-claim/verify-code` | POST | `app/api/guest/timeslot-claim/verify-code/route.ts` |

### Generic Guest Routes (3 files)
| Route | Method | File |
|-------|--------|------|
| `/api/guest/action` | POST | `app/api/guest/action/route.ts` |
| `/api/guest/request-code` | POST | `app/api/guest/request-code/route.ts` |
| `/api/guest/verify-code` | POST | `app/api/guest/verify-code/route.ts` |

### Admin Routes (1 file)
| Route | Method | File |
|-------|--------|------|
| `/api/admin/open-mics/[id]` | DELETE | `app/api/admin/open-mics/[id]/route.ts` |

**Total API files to modify: ~15**

---

## UI Components Inventory

### RSVP Components (5 files)
| Component | File |
|-----------|------|
| RSVPSection | `components/events/RSVPSection.tsx` |
| RSVPButton | `components/events/RSVPButton.tsx` |
| RSVPCard | `components/events/RSVPCard.tsx` |
| AttendeeList | `components/events/AttendeeList.tsx` |
| RSVPList (dashboard) | `dashboard/my-events/_components/RSVPList.tsx` |

### Comment Components (2 files)
| Component | File |
|-----------|------|
| EventComments | `components/events/EventComments.tsx` |
| CommentThread (shared) | `components/comments/CommentThread.tsx` |

### Timeslot Components (3 files)
| Component | File |
|-----------|------|
| TimeslotSection | `components/events/TimeslotSection.tsx` |
| GuestTimeslotClaimForm | `components/events/GuestTimeslotClaimForm.tsx` |
| GuestClaimModal | `components/events/GuestClaimModal.tsx` |

### Page Components (7 files)
| Page | File |
|------|------|
| Event detail | `app/events/[id]/page.tsx` |
| Event display (lineup) | `app/events/[id]/display/page.tsx` |
| Event lineup control | `app/events/[id]/lineup/page.tsx` |
| Dashboard (RSVP counts) | `app/(protected)/dashboard/page.tsx` |
| My RSVPs | `app/(protected)/dashboard/my-rsvps/page.tsx` |
| My Events | `app/(protected)/dashboard/my-events/page.tsx` |
| Admin Open Mics | `app/(protected)/dashboard/admin/open-mics/page.tsx` |

**Total UI files to modify: ~17**

---

## Email Templates Inventory

### RSVP-Related (7 files)
| Template | File | Needs date? |
|----------|------|-------------|
| rsvpConfirmation | `lib/email/templates/rsvpConfirmation.ts` | **YES** - "You're confirmed for {date}" |
| rsvpHostNotification | `lib/email/templates/rsvpHostNotification.ts` | **YES** - "Someone RSVP'd for {date}" |
| waitlistPromotion | `lib/email/templates/waitlistPromotion.ts` | **YES** - "Spot opened for {date}" |
| waitlistOffer | `lib/email/templates/waitlistOffer.ts` | **YES** - "Claim your spot for {date}" |
| eventReminder | `lib/email/templates/eventReminder.ts` | **YES** - "Reminder for {date}" |
| eventUpdated | `lib/email/templates/eventUpdated.ts` | **YES** - "{date} details changed" |
| eventCancelled | `lib/email/templates/eventCancelled.ts` | **YES** - "{date} cancelled" |

### Timeslot-Related (3 files)
| Template | File | Needs date? |
|----------|------|-------------|
| timeslotClaimConfirmation | `lib/email/templates/timeslotClaimConfirmation.ts` | **YES** - "Your slot on {date}" |
| timeslotSignupHostNotification | `lib/email/templates/timeslotSignupHostNotification.ts` | **YES** - "Someone claimed slot for {date}" |
| claimConfirmed | `lib/email/templates/claimConfirmed.ts` | **YES** |

### Occurrence Override Emails (2 files)
| Template | File | Already has date? |
|----------|------|-------------------|
| occurrenceCancelledHost | `lib/email/templates/occurrenceCancelledHost.ts` | YES |
| occurrenceModifiedHost | `lib/email/templates/occurrenceModifiedHost.ts` | YES |

### General (1 file)
| Template | File | Needs date? |
|----------|------|-------------|
| verificationCode | `lib/email/templates/verificationCode.ts` | **YES** - "Verify for {event} on {date}" |

**Total email templates to modify: ~11**

---

## Notification/Waitlist Logic (3 files)

| File | Needs date? |
|------|-------------|
| `lib/waitlistOffer.ts` | **YES** - waitlist per occurrence |
| `lib/waitlistOfferClient.ts` | **YES** - client helpers |
| `lib/notifications/eventUpdated.ts` | **YES** - notify for specific date |

---

## Test Files (12 files)

| Test File | Tests |
|-----------|-------|
| `__tests__/phase4-48b-guest-rsvp.test.ts` | Guest RSVP flow |
| `__tests__/phase4-49b-event-comments.test.ts` | Event comments |
| `__tests__/phase4-43-rsvp-always.test.ts` | RSVP availability |
| `__tests__/phase4-51a-event-watchers.test.ts` | Watcher notifications |
| `__tests__/phase4-51c-guest-rsvp-notifications.test.ts` | Guest RSVP notifications |
| `__tests__/phase4-51c-guest-rsvp-discoverability.test.ts` | Guest CTA |
| `__tests__/phase4-51d-union-fanout-watch.test.ts` | Notification fanout |
| `__tests__/notification-icons.test.ts` | Notification UI |
| `__tests__/notification-preferences.test.ts` | Email preferences |
| `__tests__/api-my-events-timeslots.test.ts` | Timeslot API |
| `__tests__/signup-lane-detection.test.ts` | Signup detection |
| `__tests__/timeslot-patch-persistence.test.ts` | Timeslot persistence |

---

## Summary Totals

| Category | Files |
|----------|-------|
| Database tables | 6 (4 primary + 2 related) |
| API routes | ~15 |
| UI components | ~17 |
| Email templates | ~11 |
| Notification logic | 3 |
| Test files | 12 |
| **Total** | **~64 files** |

---

## Backfill Strategy

### For RSVPs (10 rows)
- 8 are for recurring events (is_recurring=true or day_of_week set)
- Compute next occurrence using `expandOccurrencesForEvent()` logic
- Use "today" at migration time as reference

### For Comments (7 rows)
- Some are on recurring events, some on one-time
- Same logic: compute next occurrence for recurring, use event_date for one-time

### For Timeslots (112 rows)
- Most are test data ("Tes Open Mic Series")
- All currently have is_recurring=false based on sample
- Backfill using event_date or today if no event_date

### For Claims (2 rows)
- Both on "TEST Open Mic Thursdays Series" (is_recurring=false)
- Claims inherit date_key from their timeslot

### For guest_verifications (18 rows)
- Add date_key column
- Backfill based on linked event's next occurrence

### For event_lineup_state (0 rows)
- No data to migrate
- Add date_key column, make it part of PK

---

## Migration Plan

### Migration 1: Add columns (additive, safe)
1. Add `date_key TEXT` to: event_rsvps, event_comments, event_timeslots, guest_verifications, event_lineup_state
2. Add indexes on (event_id, date_key)
3. DO NOT drop old constraints yet

### Migration 2: Backfill data (idempotent script)
1. For each table, compute date_key for NULL rows
2. Use TypeScript script with `expandOccurrencesForEvent()` logic
3. For events with no computable date, use today

### Migration 3: Enforce constraints (breaking)
1. Set NOT NULL on date_key columns
2. Drop old unique constraints
3. Add new unique constraints including date_key
4. Update event_lineup_state PK to (event_id, date_key)

---

## Questions Resolved from Prompt

1. **Additional action tables?** YES - `guest_verifications` and `event_lineup_state` are in scope
2. **Claims need date_key?** No - claims inherit via timeslot_id → timeslots.date_key join
3. **Watchers need date_key?** No - watchers are series-level admin backstop (by design)

---

**STOP-GATE A RESULT:**

Two additional tables found:
- `guest_verifications` - MUST include (stores pending verification with event_id)
- `event_lineup_state` - MUST include (points to now-playing timeslot)

Ready for approval to proceed with Step 1 (Schema migration).
