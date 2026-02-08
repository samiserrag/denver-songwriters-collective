# DSC Email Inventory

**Last Updated:** January 2026
**Status:** Complete audit of all email use cases

## Email Audit Status

✅ **Completed December 2025** — All templates audited for tone guide alignment.
✅ **Phase 4.24 (January 2026)** — Added 6 new templates for event claims and occurrence overrides.
✅ **Phase 4.25 (January 2026)** — Added user email preferences; dashboard notifications remain canonical.

PRs: #56, #57, #58, #59, #60, #61, #65, #66, #67, #68

---

## Email Preferences

**Key Principle:** Preferences gate email delivery only. Dashboard notifications always appear (canonical).

Users can control email delivery via `/dashboard/settings`:
- **Event claim updates** — Submission confirmations, approvals, rejections
- **Event updates** — Reminders, time/location changes, cancellations
- **Admin alerts** — (Admins only) Claims, submissions, community activity

**How it works:**
1. Dashboard notification is created first (always)
2. Email is sent only if user's preference allows
3. Unsubscribing from emails never hides dashboard notifications

**Implementation:**
- `notification_preferences` table stores per-user toggles
- `sendEmailWithPreferences()` helper enforces the preference check
- Templates mapped to categories via `EMAIL_CATEGORY_MAP`

## Summary

| Metric | Count |
|--------|-------|
| **Total Use Cases** | 21 |
| **Covered (template exists + wired)** | 11 |
| **Templates Only (not wired)** | 9 |
| **Inline (needs consolidation)** | 2 |

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
├── registry.ts              # Template registry with types (19 templates)
├── email.test.ts            # Template tests (61 tests)
└── templates/
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

## Missing Templates (Future)

| Use Case | Priority | Notes |
|----------|----------|-------|
| Offer Expiring Soon | Low | Requires scheduler |
| Host Message to Lineup | Low | Manual send feature |
| Post-Event Thanks | Low | After event automation |
| Weekly Digest | Low | Newsletter infrastructure |

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
