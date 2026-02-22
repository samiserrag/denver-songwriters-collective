# Email Preferences — Developer Contract

> Last updated: 2026-02-22

## How it works

Users control which emails they receive via **Settings → Email Preferences**.
Dashboard notifications always appear regardless of email settings.

### Three layers of protection

| Layer | File | Behavior |
|-------|------|----------|
| **Essential bypass** | `preferences.ts` → `ESSENTIAL_EMAILS` | Security/auth emails always sent, ignoring all preferences |
| **Category map** | `preferences.ts` → `EMAIL_CATEGORY_MAP` | Maps every template to a user-controllable category |
| **Unmapped guard** | `sendWithPreferences.ts` → step 2b | Unmapped templates are **skipped** and logged as errors |

### User-facing categories

| Category key | UI label | What it covers |
|---|---|---|
| `email_enabled` | Stop all emails | Master kill-switch (overrides all below) |
| `email_claim_updates` | Event claim updates | Claim submissions, approvals, rejections |
| `email_event_updates` | Event updates | Reminders, cancellations, RSVPs, digests, comments |
| `email_admin_notifications` | Admin alerts | Admin-only; claims, submissions, contact/feedback |

### Essential emails (always delivered)

- `verificationCode` — Guest slot claim verification (security)

Users see: *"Security and account recovery emails are always delivered."*

---

## Adding a new email template — checklist

1. **Create the template** in `web/src/lib/email/templates/`.
2. **Register it** in `web/src/lib/email/registry.ts`:
   - Add the key to the `EmailTemplateKey` union type.
   - Add an entry to `TEMPLATE_REGISTRY`.
3. **Categorize it** in `web/src/lib/notifications/preferences.ts`:
   - Add the key to `EMAIL_CATEGORY_MAP` with the appropriate category.
   - OR add it to `ESSENTIAL_EMAILS` if it is a security/auth email.
4. **Send it** via `sendEmailWithPreferences()` (not raw `sendEmail()`).
5. **Run the coverage test**: `npx jest email-template-coverage`.
   - The test will fail if the template is missing from both maps.

### Decision tree: which category?

```
Is it a security or account-recovery email?
  → Yes → Add to ESSENTIAL_EMAILS
  → No  → Is it about a claim (submit/approve/reject)?
            → Yes → "claim_updates"
            → No  → Is it admin-facing only?
                      → Yes → "admin_notifications"
                      → No  → "event_updates"
```

---

## Runtime behavior

`sendEmailWithPreferences()` follows this flow:

1. **Missing recipient guard** — skip + log warning
2. **Create dashboard notification** — always (if requested)
3. **Essential check** — if in `ESSENTIAL_EMAILS`, send immediately, skip preference lookup
4. **Category lookup** — if not in `EMAIL_CATEGORY_MAP`, **skip + log error**
5. **Preference check** — respect `email_enabled` master toggle, then category toggle
6. **Send** — deliver via Resend

All decisions are audit-logged via `appLogger` with source `email_prefs_audit`.

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/notifications/preferences.ts` | Category map, essential set, preference queries |
| `src/lib/email/sendWithPreferences.ts` | Decision engine with audit logging |
| `src/lib/email/registry.ts` | Template registry (source of truth for keys) |
| `src/__tests__/email-template-coverage.test.ts` | CI guard: every template must be categorized |
| `src/app/(protected)/dashboard/notifications/EmailPreferencesSection.tsx` | Dashboard UI |
| `src/app/(protected)/dashboard/settings/page.tsx` | Settings page UI |

### Recent template additions

- `attendeeInvitation` is categorized as `event_updates`.
