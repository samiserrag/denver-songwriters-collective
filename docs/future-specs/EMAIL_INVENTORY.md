# DSC Email Inventory

**Last Updated:** December 2025
**Status:** Complete audit of all email use cases

## Summary

| Metric | Count |
|--------|-------|
| **Total Use Cases** | 11 |
| **Covered (template exists + wired)** | 9 |
| **Missing (no template or not wired)** | 2 |
| **Needs Rewrite (tone/style)** | 3 |

---

## Email Use Cases

### 1. Guest Verification (Phase 4)

| Field | Value |
|-------|-------|
| **Use Case** | Guest Slot Verification Code |
| **Trigger** | `POST /api/guest/request-code` |
| **Audience** | Guest (unregistered performer) |
| **Template Location** | `web/src/lib/email/templates/verificationCode.ts` |
| **Subject** | `Your code for {eventTitle}` |
| **Required Links** | None (code entry on same page) |
| **Tone Risk** | Good |
| **Status** | Covered |

### 2. Guest Claim Confirmed

| Field | Value |
|-------|-------|
| **Use Case** | Slot Claim Confirmation (Guest) |
| **Trigger** | `POST /api/guest/verify-code` |
| **Audience** | Guest (verified) |
| **Template Location** | `web/src/lib/email/templates/claimConfirmed.ts` |
| **Subject** | `You're on the lineup for {eventTitle}` |
| **Required Links** | Cancel URL (magic link) |
| **Tone Risk** | Good |
| **Status** | Covered |

### 3. Guest Waitlist Confirmation

| Field | Value |
|-------|-------|
| **Use Case** | Waitlist Confirmation (Guest) |
| **Trigger** | `POST /api/guest/verify-code` (when slots full) |
| **Audience** | Guest (verified) |
| **Template Location** | `web/src/lib/email/templates/claimConfirmed.ts` (waitlist variant) |
| **Subject** | `You're on the waitlist for {eventTitle}` |
| **Required Links** | Remove from waitlist URL |
| **Tone Risk** | Good |
| **Status** | Covered |

### 4. Guest Waitlist Offer (Slot Opened)

| Field | Value |
|-------|-------|
| **Use Case** | Spot Opened - Guest Promotion |
| **Trigger** | `POST /api/guest/action` (on cancel) |
| **Audience** | Guest (waitlisted, now offered) |
| **Template Location** | `web/src/lib/email/templates/waitlistOffer.ts` |
| **Subject** | `A spot just opened up at {eventTitle}` |
| **Required Links** | Confirm URL, Cancel/Pass URL |
| **Tone Risk** | Good |
| **Status** | Covered |

### 5. Member RSVP Confirmation

| Field | Value |
|-------|-------|
| **Use Case** | RSVP Confirmation (Registered User) |
| **Trigger** | `POST /api/events/[id]/rsvp` |
| **Audience** | Member (authenticated) |
| **Template Location** | `web/src/lib/emailTemplates.ts` → `getRsvpConfirmationEmail` |
| **Subject** | `RSVP Confirmed: {eventTitle}` |
| **Required Links** | Event page, Cancel RSVP URL |
| **Tone Risk** | OK (slightly formal) |
| **Status** | Covered - needs tone polish |

### 6. Member Waitlist Confirmation

| Field | Value |
|-------|-------|
| **Use Case** | Waitlist Confirmation (Registered User) |
| **Trigger** | `POST /api/events/[id]/rsvp` (when at capacity) |
| **Audience** | Member (authenticated) |
| **Template Location** | `web/src/lib/emailTemplates.ts` → `getRsvpConfirmationEmail` (waitlist variant) |
| **Subject** | `Waitlisted: {eventTitle}` |
| **Required Links** | Event page, Cancel URL |
| **Tone Risk** | OK (slightly formal) |
| **Status** | Covered - needs tone polish |

### 7. Member Waitlist Offer

| Field | Value |
|-------|-------|
| **Use Case** | Spot Opened - Member Promotion |
| **Trigger** | `DELETE /api/events/[id]/rsvp` → `sendOfferNotifications()` |
| **Audience** | Member (waitlisted, now offered) |
| **Template Location** | `web/src/lib/emailTemplates.ts` → `getWaitlistPromotionEmail` |
| **Subject** | `Action Required: Spot Available for {eventTitle}` |
| **Required Links** | Confirm URL, Decline URL |
| **Tone Risk** | OK |
| **Status** | Covered |

### 8. Host Approval

| Field | Value |
|-------|-------|
| **Use Case** | Host Application Approved |
| **Trigger** | `PATCH /api/admin/host-requests/[id]` (approve) |
| **Audience** | Member (applicant) |
| **Template Location** | `web/src/lib/emailTemplates.ts` → `getHostApprovalEmail` |
| **Subject** | `You're Approved as a Host!` |
| **Required Links** | Dashboard/My Events link |
| **Tone Risk** | Good |
| **Status** | Covered |

### 9. Host Rejection

| Field | Value |
|-------|-------|
| **Use Case** | Host Application Rejected |
| **Trigger** | `PATCH /api/admin/host-requests/[id]` (reject) |
| **Audience** | Member (applicant) |
| **Template Location** | `web/src/lib/emailTemplates.ts` → `getHostRejectionEmail` |
| **Subject** | `Update on Your Host Application` |
| **Required Links** | Open Mics page |
| **Tone Risk** | Good (sensitive, handled well) |
| **Status** | Covered |

### 10. Contact Form Submission

| Field | Value |
|-------|-------|
| **Use Case** | Contact Form → Admin Notification |
| **Trigger** | `POST /api/contact` |
| **Audience** | Admin (DSC team) |
| **Template Location** | `web/src/app/api/contact/route.ts` (inline) |
| **Subject** | `[DSC Contact] Message from {name}` |
| **Required Links** | Reply-to button with sender email |
| **Tone Risk** | OK (admin-facing, functional) |
| **Status** | Covered - inline template |

### 11. Newsletter Welcome

| Field | Value |
|-------|-------|
| **Use Case** | Newsletter Subscription Welcome |
| **Trigger** | `POST /api/newsletter` |
| **Audience** | Subscriber (public) |
| **Template Location** | `web/src/app/api/newsletter/route.ts` (inline) |
| **Subject** | `Welcome to the Denver Songwriters Collective!` |
| **Required Links** | Open Mics page, Privacy Policy |
| **Tone Risk** | OK (slightly marketing-heavy) |
| **Status** | Covered - inline template, needs consolidation |

---

## Missing/Future Templates

### High Priority (Should Add)

| Use Case | Trigger | Notes |
|----------|---------|-------|
| **Event Reminder** | Cron job or manual | "Your event is tonight/tomorrow" |
| **Offer Expiring Soon** | Cron job | "4 hours left to confirm your spot" |
| **Event Updated** | Host updates time/location | "The details for {event} have changed" |
| **Event Cancelled** | Host cancels event | "Unfortunately, {event} has been cancelled" |

### Medium Priority (Nice to Have)

| Use Case | Trigger | Notes |
|----------|---------|-------|
| **Host Message to Lineup** | Host sends manual message | Template only, no workflow yet |
| **Post-Event Thanks** | After event ends | "Thanks for playing/coming!" |
| **Correction Received** | `POST /api/change-reports` | "We got your correction, we'll review it" |
| **Profile Completion Reminder** | Cron or onboarding nudge | Low priority |

### Low Priority (Future)

| Use Case | Notes |
|----------|-------|
| Password reset | Handled by Supabase Auth |
| Magic link login | Handled by Supabase Auth |
| Weekly digest | Requires newsletter infrastructure |

---

## Template System Architecture

### Current State

```
web/src/lib/
├── email/                          # NEW Phase 4 system
│   ├── index.ts                    # Main exports
│   ├── mailer.ts                   # SMTP transport (nodemailer)
│   ├── render.ts                   # Shared layout/styling
│   └── templates/
│       ├── verificationCode.ts     # Guest verification
│       ├── claimConfirmed.ts       # Guest claim + waitlist
│       └── waitlistOffer.ts        # Guest promotion
│
├── email.ts                        # LEGACY - duplicates mailer.ts
├── emailTemplates.ts               # LEGACY - member emails
└── waitlistOffer.ts                # Uses LEGACY emailTemplates
```

### Issues to Address

1. **Duplicate mailer**: `email.ts` and `email/mailer.ts` both define `sendEmail()`
2. **Split templates**: Guest templates in new system, member templates in legacy
3. **Inline templates**: Contact and Newsletter emails are inline in route files
4. **No registry**: No single source of truth for all templates

### Recommended State

```
web/src/lib/email/
├── index.ts                        # Main exports
├── mailer.ts                       # Single SMTP transport
├── render.ts                       # Shared layout/styling
├── registry.ts                     # NEW - template registry
└── templates/
    ├── verificationCode.ts         # Guest verification
    ├── claimConfirmed.ts           # Guest claim + waitlist
    ├── waitlistOffer.ts            # Guest promotion
    ├── rsvpConfirmation.ts         # NEW - member RSVP
    ├── waitlistPromotion.ts        # NEW - member offer
    ├── hostApproval.ts             # NEW - host approved
    ├── hostRejection.ts            # NEW - host rejected
    ├── contactNotification.ts      # NEW - admin contact
    ├── newsletterWelcome.ts        # NEW - subscriber welcome
    ├── eventReminder.ts            # NEW - reminder (template only)
    ├── eventUpdated.ts             # NEW - changes (template only)
    └── eventCancelled.ts           # NEW - cancellation (template only)
```

---

## Tone Assessment

### Good (No Changes Needed)

- `verificationCode.ts` - Warm, clear, human
- `claimConfirmed.ts` - Friendly, encouraging
- `waitlistOffer.ts` - Urgent but friendly
- `hostApproval.ts` - Celebratory, welcoming
- `hostRejection.ts` - Empathetic, constructive

### Needs Polish

- `getRsvpConfirmationEmail` - Slightly formal, could be warmer
- Newsletter welcome - Marketing-heavy, could be more personal
- Contact form - Functional but could add "We'll get back to you"

### Forbidden Patterns (Not Found - Good!)

- "This is an automated message" (none)
- "Do not reply" (none)
- "System notification" (none)
- "noreply@" addresses (none - we use real reply-to)

---

## Action Items

1. [ ] Create `registry.ts` with `EmailTemplateKey` enum
2. [ ] Move legacy templates into new system
3. [ ] Consolidate inline templates (contact, newsletter)
4. [ ] Delete duplicate `email.ts` file
5. [ ] Add missing high-priority templates (reminder, cancelled, updated)
6. [ ] Polish member RSVP email tone
7. [ ] Add tests for all templates in registry
