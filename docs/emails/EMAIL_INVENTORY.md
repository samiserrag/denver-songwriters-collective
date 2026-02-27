# DSC Email Inventory

**Last Updated:** February 2026
**Status:** Complete audit of all email use cases

## Email Audit Status

✅ **Completed December 2025** — All templates audited for tone guide alignment.
✅ **Phase 4.24 (January 2026)** — Added 6 new templates for event claims and occurrence overrides.
✅ **Phase 4.25 (January 2026)** — Added user email preferences; dashboard notifications remain canonical.
✅ **Email Preferences Developer Contract (February 2026)** — Essential emails, full category mapping, unmapped template guard, CI coverage test.

PRs: #56, #57, #58, #59, #60, #61, #65, #66, #67, #68, #122

---

## Email Preferences

**Key Principle:** Preferences gate email delivery only. Dashboard notifications always appear (canonical).

Users can control email delivery via `/dashboard/settings`:
- **Master toggle** (`email_enabled`) — Stops all non-essential emails
- **Event claim updates** — Submission confirmations, approvals, rejections
- **Event updates** — Reminders, time/location changes, cancellations, digests
- **Admin alerts** — (Admins only) Claims, submissions, community activity

**How it works:**
1. Dashboard notification is created first (always)
2. Essential emails (e.g., `verificationCode`) bypass all preference checks
3. Unmapped templates are **skipped and logged as errors** (never silently sent)
4. Email is sent only if user's master toggle + category toggle both allow
5. Unsubscribing from emails never hides dashboard notifications

**Essential emails (always delivered):**
- `verificationCode` — Guest slot claim verification (security)

Users see: *"Security and account recovery emails are always delivered."*

**Implementation:**
- `notification_preferences` table stores per-user toggles
- `sendEmailWithPreferences()` helper enforces the preference check
- Templates mapped to categories via `EMAIL_CATEGORY_MAP` in `preferences.ts`
- `ESSENTIAL_EMAILS` set in `preferences.ts` for security/auth bypass
- `email-template-coverage.test.ts` enforces all templates are categorized (CI guard)

**Developer contract:** See `docs/email-preferences.md` for full checklist when adding templates.

## Summary

| Metric | Count |
|--------|-------|
| **Total Use Cases** | 31 |
| **Registry Templates** | 26 |
| **Covered (template exists + wired)** | 21 |
| **Templates Only (not wired)** | 9 |
| **Inline (needs consolidation)** | 2 |
| **Categorized in EMAIL_CATEGORY_MAP** | 30 |
| **Essential (bypass preferences)** | 1 |

---

## Email Use Cases

### Guest Verification (Phase 4)

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 1 | Guest Verification Code | `POST /api/guest/request-code` | `verificationCode.ts` | Covered |
| 2 | Guest Claim Confirmed | `POST /api/guest/verify-code` | `claimConfirmed.ts` | Covered |
| 3 | Guest Waitlist Confirmation | `POST /api/guest/verify-code` (slots full) | `claimConfirmed.ts` (waitlist variant) | Covered |
| 4 | Guest Waitlist Offer | `POST /api/guest/action` (cancel) | `waitlistOffer.ts` | Covered |

### Member RSVP

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 5 | Member RSVP Confirmed | `POST /api/events/[id]/rsvp` | `rsvpConfirmation.ts` | Covered |
| 6 | Member Waitlist Confirmed | `POST /api/events/[id]/rsvp` (at capacity) | `rsvpConfirmation.ts` (waitlist) | Covered |
| 7 | Member Waitlist Promotion | `DELETE /api/events/[id]/rsvp` | `waitlistPromotion.ts` | Covered |

### Host Management

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 8 | Host Application Approved | `PATCH /api/admin/host-requests/[id]` (approve) | `hostApproval.ts` | Covered |
| 9 | Host Application Rejected | `PATCH /api/admin/host-requests/[id]` (reject) | `hostRejection.ts` | Covered |

### Admin & Community

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 10 | Contact Form → Admin | `POST /api/contact` | Inline in route.ts | Inline |
| 11 | Suggestion Response | `PATCH /api/admin/event-update-suggestions/[id]` | `suggestionResponse.ts` | Covered |

### Subscriber

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 12 | Newsletter Welcome | `POST /api/newsletter` | Inline in route.ts | Inline |

### Event Lifecycle (Templates Only - Not Wired)

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 13 | Event Reminder | Cron/manual (future) | `eventReminder.ts` | Template only |
| 14 | Event Updated | Host updates time/location (future) | `eventUpdated.ts` | Template only |
| 15 | Event Cancelled | Host cancels (future) | `eventCancelled.ts` | Template only |

### Event Claims (Phase 4.24 - Templates Only)

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 16 | Claim Submitted | User submits event claim | `eventClaimSubmitted.ts` | Template only |
| 17 | Claim Approved | Admin approves claim | `eventClaimApproved.ts` | Template only |
| 18 | Claim Rejected | Admin rejects claim | `eventClaimRejected.ts` | Template only |
| 19 | Admin Claim Notification | New claim submitted | `adminEventClaimNotification.ts` | Template only |

### Occurrence Overrides (Phase 4.24 - Templates Only)

| # | Use Case | Trigger | Template | Status |
|---|----------|---------|----------|--------|
| 20 | Occurrence Cancelled | Host cancels single occurrence | `occurrenceCancelledHost.ts` | Template only |
| 21 | Occurrence Modified | Host modifies single occurrence | `occurrenceModifiedHost.ts` | Template only |

---

## Template Details

### 1. verificationCode.ts
- **Subject:** `Your code for {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Guest (unregistered)
- **Links:** None (code entry on same page)
- **Tone:** Good (warm, transactional)

### 2. claimConfirmed.ts
- **Subject:** `You're on the lineup for {eventTitle} — The Colorado Songwriters Collective` / `You're on the waitlist for {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Guest (verified)
- **Links:** Cancel URL (magic link)
- **Tone:** Good (celebratory/encouraging)

### 3. waitlistOffer.ts
- **Subject:** `A spot just opened up at {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Guest (waitlisted, now offered)
- **Links:** Confirm URL, Cancel URL
- **Tone:** Good (urgent but friendly)

### 4. rsvpConfirmation.ts
- **Subject:** `You're going to {eventTitle} — The Colorado Songwriters Collective` / `You're on the waitlist for {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Member (authenticated)
- **Links:** Event page, Calendar links
- **Tone:** Good (warm, helpful)

### 5. waitlistPromotion.ts
- **Subject:** `A spot just opened up at {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Member (waitlisted, now offered)
- **Links:** Confirm URL (event page with ?confirm=true)
- **Tone:** Good (exciting, clear deadline)

### 6. hostApproval.ts
- **Subject:** `You're approved as a host! — The Colorado Songwriters Collective`
- **Audience:** Member (applicant)
- **Links:** Dashboard link
- **Tone:** Good (celebratory)

### 7. hostRejection.ts
- **Subject:** `Update on your host application — The Colorado Songwriters Collective`
- **Audience:** Member (applicant)
- **Links:** Open mics page
- **Tone:** Good (empathetic, constructive)

### 8. suggestionResponse.ts
- **Subject:** Varies by status (approved/rejected/needs_info) — all include `— The Colorado Songwriters Collective`
- **Audience:** Community submitter
- **Links:** Open mics page, Submit form
- **Tone:** Good (appreciative, encouraging)

### 9. contactNotification.ts
- **Subject:** `[DSC Contact] Message from {name}`
- **Audience:** Admin
- **Links:** Reply-to button
- **Tone:** Good (functional, admin-facing)

### 10. newsletterWelcome.ts
- **Subject:** `Welcome to The Colorado Songwriters Collective!`
- **Audience:** Subscriber
- **Links:** Open mics page, Privacy
- **Tone:** Good (welcoming)

### 11-13. Event Lifecycle Templates (Template Only)
- **eventReminder.ts:** `Reminder: {eventTitle} is {tonight/tomorrow}! — The Colorado Songwriters Collective`
- **eventUpdated.ts:** `Update: {eventTitle} details have changed — The Colorado Songwriters Collective`
- **eventCancelled.ts:** `Cancelled: {eventTitle} on {date} — The Colorado Songwriters Collective`

### 14-17. Event Claim Templates (Phase 4.24 - Template Only)

#### eventClaimSubmitted.ts
- **Subject:** `Your claim for {eventTitle} is under review — The Colorado Songwriters Collective`
- **Audience:** Member (claimant)
- **Links:** Happenings page
- **Tone:** Good (acknowledging, sets expectations)

#### eventClaimApproved.ts
- **Subject:** `You're now the host of {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Member (new host)
- **Links:** Event management dashboard
- **Tone:** Good (celebratory, "Welcome to the table")

#### eventClaimRejected.ts
- **Subject:** `Update on your claim for {eventTitle} — The Colorado Songwriters Collective`
- **Audience:** Member (claimant)
- **Links:** Happenings page
- **Tone:** Good (empathetic, constructive — modeled after hostRejection.ts)

#### adminEventClaimNotification.ts
- **Subject:** `[DSC Claim] {requesterName} wants to host {eventTitle}`
- **Audience:** Admin
- **Links:** Admin claims review page
- **Tone:** Good (functional, admin-facing)
- **Note:** Does NOT include requester email in body (security requirement)

### 18-19. Occurrence Override Templates (Phase 4.24 - Template Only)

#### occurrenceCancelledHost.ts
- **Subject:** `Cancelled: {eventTitle} on {occurrenceDate} — The Colorado Songwriters Collective`
- **Audience:** Member (RSVPed attendee)
- **Links:** Happenings page
- **Tone:** Good (apologetic, clear that series continues)
- **Key message:** "This is for {date} only. The regular series continues."

#### occurrenceModifiedHost.ts
- **Subject:** `Update: {eventTitle} on {occurrenceDate} — The Colorado Songwriters Collective`
- **Audience:** Member (RSVPed attendee)
- **Links:** Event page, Cancel RSVP link
- **Tone:** Good (informative, preserves RSVP)
- **Key message:** "This update is for {date} only."

---

## System Architecture

```
web/src/lib/email/
├── index.ts                 # Main exports
├── mailer.ts                # SMTP transport (nodemailer)
├── render.ts                # Shared layout/styling
├── registry.ts              # Template registry with types (26 templates)
├── sendWithPreferences.ts   # Preference-aware send with audit logging
├── email.test.ts            # Template tests (61 tests)
└── templates/

web/src/lib/notifications/
├── preferences.ts           # EMAIL_CATEGORY_MAP, ESSENTIAL_EMAILS, shouldSendEmail()
└── ...

web/src/__tests__/
├── email-template-coverage.test.ts         # CI guard: every template must be categorized
├── email-preferences-master-toggle.test.ts # Master toggle, status indicator, audit logging
├── notification-preferences.test.ts        # Category map, preference logic
└── ...
    ├── verificationCode.ts  # Guest verification
    ├── claimConfirmed.ts    # Guest claim + waitlist
    ├── waitlistOffer.ts     # Guest promotion
    ├── rsvpConfirmation.ts  # Member RSVP
    ├── waitlistPromotion.ts # Member promotion
    ├── hostApproval.ts      # Host approved
    ├── hostRejection.ts     # Host rejected
    ├── contactNotification.ts # Admin contact
    ├── newsletterWelcome.ts # Subscriber welcome
    ├── suggestionResponse.ts # Community response
    ├── eventReminder.ts     # Template only
    ├── eventUpdated.ts      # Template only
    ├── eventCancelled.ts    # Template only
    ├── eventClaimSubmitted.ts    # Phase 4.24 - Claim submitted
    ├── eventClaimApproved.ts     # Phase 4.24 - Claim approved
    ├── eventClaimRejected.ts     # Phase 4.24 - Claim rejected
    ├── adminEventClaimNotification.ts # Phase 4.24 - Admin notification
    ├── occurrenceCancelledHost.ts    # Phase 4.24 - Occurrence cancelled
    └── occurrenceModifiedHost.ts     # Phase 4.24 - Occurrence modified

Legacy (for backwards compatibility):
web/src/lib/email.ts         # Re-exports from email/index.ts
web/src/lib/emailTemplates.ts # Re-exports from email/index.ts
```

---

## Inline Templates to Consolidate

### Contact Form (api/contact/route.ts)
Currently has inline `getContactEmailHtml()` and `getContactEmailText()` functions.
The `contactNotification.ts` template exists but is not used by the route.

### Newsletter Welcome (api/newsletter/route.ts)
Currently has inline `getWelcomeEmailHtml()` and `getWelcomeEmailText()` functions.
The `newsletterWelcome.ts` template exists but is not used by the route.

---

## Supabase Auth Template (Outside Registry)

Signup/confirm emails sent by Supabase Auth are not generated from `web/src/lib/email/*`.

- HTML source of record: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/supabase/templates/confirm_email.html`
- Text source of record: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/supabase/templates/confirm_email.txt`
- Recovery HTML source of record: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/supabase/templates/recovery.html`
- Recovery text source of record: `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/supabase/templates/recovery.txt`
- Header image contract: must use absolute URL `https://coloradosongwriterscollective.org/images/CSCEmailHeader1.png`
- Placeholder contract: use `{{ .Email }}` (not `{{ .email }}`) and `{{ .ConfirmationURL }}`

---

## Additional Templates (Added Post-Audit)

### Weekly Digests (GTM-2)

| # | Use Case | Trigger | Template | Category | Status |
|---|----------|---------|----------|----------|--------|
| 22 | Weekly Open Mics Digest | Cron: Sunday 3:00 UTC | `weeklyOpenMicsDigest.ts` | event_updates | Covered |
| 23 | Weekly Happenings Digest | Cron: Sunday 23:20 UTC (4:20 PM MST) | `weeklyHappeningsDigest.ts` | event_updates | Covered |

### Gallery Collaboration

| # | Use Case | Trigger | Template | Category | Status |
|---|----------|---------|----------|----------|--------|
| 24 | Collaborator Added | Album owner adds collaborator | `collaboratorAdded.ts` | event_updates | Covered |
| 25 | Collaborator Invited | Album invite sent | `collaboratorInvited.ts` | event_updates | Covered |

### Event Interaction

| # | Use Case | Trigger | Template | Category | Status |
|---|----------|---------|----------|----------|--------|
| 26 | Event Comment Notification | New comment on event | `eventCommentNotification` | event_updates | Covered |
| 27 | RSVP Host Notification | New RSVP on event | `rsvpHostNotification` | event_updates | Covered |
| 28 | Cohost Invitation | Host invites cohost | `cohostInvitation` | event_updates | Covered |
| 29 | Event Restored | Admin restores event | `eventRestored.ts` | event_updates | Template only |

### Admin (Additional)

| # | Use Case | Trigger | Template | Category | Status |
|---|----------|---------|----------|----------|--------|
| 30 | Admin Suggestion Notification | New suggestion submitted | `adminSuggestionNotification.ts` | admin_notifications | Covered |
| 31 | Feedback Notification | New feedback submitted | `feedbackNotification.ts` | admin_notifications | Covered |

---

## Missing Templates (Future)

| Use Case | Priority | Notes |
|----------|----------|-------|
| Offer Expiring Soon | Low | Requires scheduler |
| Host Message to Lineup | Low | Manual send feature |
| Post-Event Thanks | Low | After event automation |

---

## Quality Metrics

- **Forbidden Phrases Found:** 0
  - No "automated message"
  - No "do not reply"
  - No "noreply@" addresses
  - No "system notification"

- **All Templates Have:**
  - Both HTML and text versions
  - Proper name fallback
  - HTML escaping for user input
  - Subject lines with event titles (where relevant)

---

## Related Documentation

- [EMAIL_STYLE_GUIDE.md](./EMAIL_STYLE_GUIDE.md) - Voice and tone guidelines
- [web/src/lib/email/registry.ts](../../web/src/lib/email/registry.ts) - Template registry
