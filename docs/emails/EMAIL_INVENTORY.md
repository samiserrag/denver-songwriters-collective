# DSC Email Inventory

**Last Updated:** December 2025
**Status:** Complete audit of all email use cases

## Summary

| Metric | Count |
|--------|-------|
| **Total Use Cases** | 15 |
| **Covered (template exists + wired)** | 11 |
| **Templates Only (not wired)** | 3 |
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

---

## Template Details

### 1. verificationCode.ts
- **Subject:** `Your code for {eventTitle}`
- **Audience:** Guest (unregistered)
- **Links:** None (code entry on same page)
- **Tone:** Good (warm, transactional)

### 2. claimConfirmed.ts
- **Subject:** `You're on the lineup for {eventTitle}` / `You're on the waitlist for {eventTitle}`
- **Audience:** Guest (verified)
- **Links:** Cancel URL (magic link)
- **Tone:** Good (celebratory/encouraging)

### 3. waitlistOffer.ts
- **Subject:** `A spot just opened up at {eventTitle}`
- **Audience:** Guest (waitlisted, now offered)
- **Links:** Confirm URL, Cancel URL
- **Tone:** Good (urgent but friendly)

### 4. rsvpConfirmation.ts
- **Subject:** `You're confirmed for {eventTitle}` / `Waitlisted for {eventTitle}`
- **Audience:** Member (authenticated)
- **Links:** Event page, Calendar links
- **Tone:** Good (warm, helpful)

### 5. waitlistPromotion.ts
- **Subject:** `A spot opened up for {eventTitle}`
- **Audience:** Member (waitlisted, now offered)
- **Links:** Confirm URL (event page with ?confirm=true)
- **Tone:** Good (exciting, clear deadline)

### 6. hostApproval.ts
- **Subject:** `You're approved as a host!`
- **Audience:** Member (applicant)
- **Links:** Dashboard link
- **Tone:** Good (celebratory)

### 7. hostRejection.ts
- **Subject:** `Update on your host application`
- **Audience:** Member (applicant)
- **Links:** Open mics page
- **Tone:** Good (empathetic, constructive)

### 8. suggestionResponse.ts
- **Subject:** Varies by status (approved/rejected/needs_info)
- **Audience:** Community submitter
- **Links:** Open mics page, Submit form
- **Tone:** Good (appreciative, encouraging)

### 9. contactNotification.ts
- **Subject:** `[DSC Contact] Message from {name}`
- **Audience:** Admin
- **Links:** Reply-to button
- **Tone:** Good (functional, admin-facing)

### 10. newsletterWelcome.ts
- **Subject:** `Welcome to the Denver Songwriters Collective!`
- **Audience:** Subscriber
- **Links:** Open mics page, Privacy
- **Tone:** Good (welcoming)

### 11-13. Event Lifecycle Templates (Template Only)
- **eventReminder.ts:** Tonight/tomorrow reminder
- **eventUpdated.ts:** Time/location changed
- **eventCancelled.ts:** Event cancelled

---

## System Architecture

```
web/src/lib/email/
├── index.ts                 # Main exports
├── mailer.ts                # SMTP transport (nodemailer)
├── render.ts                # Shared layout/styling
├── registry.ts              # Template registry with types
├── email.test.ts            # Template tests
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
    └── eventCancelled.ts    # Template only

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
