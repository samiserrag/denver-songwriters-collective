# STOP-GATE REPORT: Weekly Open Mics This Week Email

**Phase:** 0 (Investigation Complete)
**Status:** AWAITING APPROVAL
**Date:** January 2026

---

## 1. One-Page Spec

### 1.1 Goal

Send a personalized weekly email every Sunday night (America/Denver) listing upcoming open mics for the next 7 days. Help songwriters plan their week and increase event attendance.

### 1.2 Data Inputs

| Source | Data | Purpose |
|--------|------|---------|
| `profiles` | `id`, `email`, `full_name`, `city`, `zip_code` | Recipients + personalization |
| `notification_preferences` | `email_event_updates` | Consent check |
| `events` | `event_type = 'open_mic'`, `is_published = true`, `status = 'active'` | Open mic list |
| `venues` | `name`, `city`, `state`, `latitude`, `longitude` | Venue info + location filtering |
| `occurrence_overrides` | `status`, `date_key` | Skip cancelled occurrences |
| `favorites` | `event_id`, `user_id` | Highlight favorited events (future enhancement) |

### 1.3 Filtering Rules

1. **Event Type:** `event_type = 'open_mic'` only
2. **Published:** `is_published = true`
3. **Active:** `status = 'active'`
4. **Date Range:** Sunday (send day) through Saturday (7 days)
5. **Not Cancelled:** Exclude occurrences where `occurrence_overrides.status = 'cancelled'`
6. **Timezone:** All dates computed in `America/Denver`

### 1.4 Personalization Logic (MVP)

| Level | Logic | Fallback |
|-------|-------|----------|
| **MVP (Phase 1)** | No personalization — all recipients get same list | N/A |
| **Future** | Filter by user's `city` or `zip_code` + 25mi radius | Show all if no location set |

**MVP Rationale:** Start simple, measure engagement, add personalization in Phase 2.

### 1.5 Send Schedule

| Setting | Value |
|---------|-------|
| Day | Sunday |
| Time | 8:00 PM America/Denver |
| Trigger | Vercel Cron (new infrastructure) |
| Kill Switch | `ENABLE_WEEKLY_DIGEST=true` env var |

### 1.6 Email Template Outline

**Subject:** `🎤 Open Mics This Week in Denver`

**Structure:**
```
[Header: DSC Logo]

Hey {first_name or "friend"},

Here are the open mics happening this week:

────────────────────────────────
MONDAY, JANUARY 27
────────────────────────────────
🎤 Words Open Mic
   7:00 PM · Mercury Cafe · Free
   [View Details →]

🎤 Blazin' Bite Open Mic
   8:00 PM · Blazin' Bite Seafood & BBQ · Free
   [View Details →]

────────────────────────────────
TUESDAY, JANUARY 28
────────────────────────────────
(events...)

────────────────────────────────

That's X open mics across Y venues this week.

[Browse All Happenings →]

────────────────────────────────
[Unsubscribe] · [Email Preferences]

— From Sami Serrag on Behalf of the Denver Songwriters Collective
```

### 1.7 Unsubscribe / Consent Handling

| Mechanism | Implementation |
|-----------|----------------|
| **Consent Gate** | Only send if `notification_preferences.email_event_updates = true` |
| **Unsubscribe Link** | Links to `/dashboard/settings` (existing preferences page) |
| **Kill Switch** | `ENABLE_WEEKLY_DIGEST=false` disables feature entirely |
| **Rate Limit** | 1 email per user per digest run (existing mailer rate limit) |

**CRITICAL GAP IDENTIFIED:** Newsletter subscribers (`newsletter_subscribers` table) have no self-service unsubscribe mechanism. However, this feature uses `notification_preferences` (which has a UI), not the newsletter table. **No blocker for this feature.**

---

## 2. Files/Modules to Change

### 2.1 New Files

| File | Purpose |
|------|---------|
| `web/src/lib/email/templates/weeklyOpenMicsDigest.ts` | Email template |
| `web/src/app/api/cron/weekly-open-mics/route.ts` | Cron handler endpoint |
| `web/src/lib/digest/weeklyOpenMics.ts` | Business logic (fetch events, build per-user emails) |
| `web/src/__tests__/weekly-open-mics-digest.test.ts` | Unit + integration tests |
| `vercel.json` | Cron schedule configuration |

### 2.2 Modified Files

| File | Change |
|------|--------|
| `web/src/lib/email/registry.ts` | Register `weeklyOpenMicsDigest` template |
| `web/src/lib/notifications/preferences.ts` | Add `weeklyOpenMicsDigest` to `EMAIL_CATEGORY_MAP` → `event_updates` |
| `web/src/lib/featureFlags.ts` | (Already has `isWeeklyDigestEnabled()` — no change needed) |
| `CLAUDE.md` | Document new cron infrastructure |

### 2.3 No Changes Required

| Area | Reason |
|------|--------|
| Database schema | Existing tables sufficient |
| RLS policies | Cron uses service role client |
| Frontend UI | Uses existing `/dashboard/settings` for preferences |

---

## 3. Test Plan

### 3.1 Unit Tests

| Test | Description |
|------|-------------|
| `getUpcomingOpenMics()` | Returns only open_mic events in 7-day window |
| `getUpcomingOpenMics()` | Excludes cancelled occurrences via overrides |
| `getUpcomingOpenMics()` | Groups events by date correctly |
| `getUpcomingOpenMics()` | Handles recurring events (expands occurrences) |
| `getUpcomingOpenMics()` | Respects Denver timezone |
| `buildDigestEmail()` | Generates correct HTML structure |
| `buildDigestEmail()` | Uses first name if available, "friend" otherwise |
| `buildDigestEmail()` | Shows 0 events gracefully (empty state) |
| Template registration | `weeklyOpenMicsDigest` in registry |
| Preference mapping | Template maps to `event_updates` category |

### 3.2 Integration Tests

| Test | Description |
|------|-------------|
| Preference gating | Users with `email_event_updates=false` don't receive |
| Preference gating | Users with `email_event_updates=true` receive |
| Kill switch | `ENABLE_WEEKLY_DIGEST=false` skips all sends |
| Rate limiting | Same user doesn't get duplicate in same run |
| Cron auth | Endpoint returns 401 without `CRON_SECRET` |

### 3.3 Manual Tests

| Test | Steps |
|------|-------|
| Email renders correctly | 1. Trigger cron locally 2. Check email in Fastmail sent folder 3. Verify structure, links, unsubscribe |
| Links work | Click "View Details" → lands on event page |
| Unsubscribe works | Click unsubscribe → lands on settings page |
| Empty week | Test with no open mics in window → graceful empty state |
| Timezone accuracy | Verify dates match Denver timezone expectations |

---

## 4. Risks and Edge Cases

### 4.1 Timezone Risks

| Risk | Mitigation |
|------|------------|
| User in different timezone sees "wrong" dates | All dates shown with day-of-week + date (e.g., "Monday, Jan 27") — unambiguous |
| Cron fires at wrong time | Vercel cron uses UTC; configure for 03:00 UTC = 8:00 PM Denver (MST) |
| DST transitions | Use `America/Denver` timezone-aware logic (existing pattern in codebase) |

### 4.2 Recurring Series Risks

| Risk | Mitigation |
|------|------------|
| Series generates duplicate entries | `expandOccurrencesForEvent()` already dedupes by date_key |
| Override not applied | Existing `applyOccurrenceOverride()` handles this |
| Series with no occurrences in window | Filtered out naturally by date range |

### 4.3 User Preference Risks

| Risk | Mitigation |
|------|------------|
| User has no preference row | `shouldSendEmail()` defaults to `true` (existing behavior) |
| User unsubscribed | `email_event_updates=false` blocks send |
| New user mid-week | Will receive on next Sunday |

### 4.4 Deliverability Risks

| Risk | Mitigation |
|------|------------|
| Spam classification | DSC already sends event emails via same infrastructure; established sender reputation |
| High volume | ~100 users currently; rate limiting in mailer handles scale |
| Bounce handling | Future enhancement — currently not tracked |

### 4.5 Edge Cases

| Case | Behavior |
|------|----------|
| 0 open mics this week | Send email with friendly "No open mics scheduled this week. Check back soon!" |
| User has no email | Skip (no email to send to) |
| Event has no venue | Show "Location TBD" |
| Very long list (20+ events) | Show all; consider pagination in future |

---

## 5. Architectural Decisions

### 5.1 Why Vercel Cron (Not Supabase/External)

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Vercel Cron | Zero new infra, same repo, env vars work | Limited to specific times | **Selected** |
| Supabase pg_cron | No external service | Requires SQL function, harder to test | Rejected |
| External (Inngest, etc.) | More features | New vendor, auth complexity | Rejected |

### 5.2 Why Service Role Client

Cron endpoints need to:
- Read all users' preferences
- Read all events regardless of RLS
- Send emails to any user

Service role client bypasses RLS appropriately for this system operation.

### 5.3 Why `event_updates` Category

The existing `email_event_updates` preference already covers:
- Event reminders
- Event updates
- Event cancellations
- RSVP confirmations

Weekly digest is another form of event update. Users who want event emails will want this; those who don't won't.

---

## 6. Implementation Phases

### Phase 1: MVP (This Approval)
- Cron infrastructure (Vercel cron + endpoint)
- Email template (no personalization)
- Preference gating
- Kill switch integration
- Tests

### Phase 2: Personalization (Future)
- Location-based filtering (user's city/zip)
- Highlight favorited events
- "Events you might like" section

### Phase 3: Engagement (Future)
- Open/click tracking
- Bounce handling
- Optimal send time per user

---

## 7. Approval Checklist

- [ ] Spec reviewed and approved
- [ ] File list approved
- [ ] Test plan approved
- [ ] Risk mitigations approved
- [ ] Proceed to Phase 1 implementation

---

**STOP-GATE:** Awaiting approval before any implementation.

**To proceed, please confirm:**
> "Approved for Phase 1 implementation"
