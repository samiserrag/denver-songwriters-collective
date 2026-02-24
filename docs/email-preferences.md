# Email Preferences — Developer Contract

> Last updated: 2026-02-24

## How it works

Users control which emails they receive via **Dashboard → Email Preferences** (sidebar link)
or **Settings → Email Preferences**. Dashboard notifications always appear regardless of email settings.

### Three layers of protection

| Layer | File | Behavior |
|-------|------|----------|
| **Essential bypass** | `preferences.ts` → `ESSENTIAL_EMAILS` | Security/auth emails always sent, ignoring all preferences |
| **Category map** | `preferences.ts` → `EMAIL_CATEGORY_MAP` | Maps every template to a user-controllable category |
| **Unmapped guard** | `sendWithPreferences.ts` → step 2b | Unmapped templates are **skipped** and logged as errors |

### User-facing categories

| Category key | UI label | What it covers | Toggle visible to |
|---|---|---|---|
| `email_claim_updates` | Event claim updates | Claim submissions, approvals, rejections | Hosts/co-hosts only |
| `email_host_activity` | Host activity | RSVPs, comments, co-host updates on events the user hosts | Hosts/co-hosts only |
| `email_attendee_activity` | Attendee updates | Reminders, cancellations, RSVP confirmations, waitlist promotions | All users |
| `email_digests` | Weekly digests | Open mic roundups, happenings digest, newsletter welcome | All users |
| `email_invitations` | Invitations | Co-host, event, and gallery collaboration invitations | All users |
| `email_admin_notifications` | Admin alerts | Admin-only; claims, submissions, contact/feedback | Admins only |
| `email_event_updates` | *(legacy)* | Retained for backward compatibility; new templates should use granular categories above | Hidden (no toggle) |
| `email_enabled` | Stop all emails | Master kill-switch (red, at bottom of UI; overrides all above) | All users |

All preferences default to `true`. The "Stop all emails" toggle is styled in red and placed at the bottom of both the Email Preferences and Settings pages.

### Toggle visibility rules

- **Hosts/co-hosts** see: Event claim updates, Host activity, Attendee updates, Weekly digests, Invitations, Stop all emails
- **Admins** see all of the above plus Admin alerts (admins are always treated as hosts)
- **Regular users** see: Attendee updates, Weekly digests, Invitations, Stop all emails
- Host status is determined by having entries in `event_hosts` or `events.host_id`
- A preference row exists for every user (seeded on signup via `handle_new_user()` trigger)
- Existing users without a row were backfilled on 2026-02-24 (34 rows total)

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
                      → No  → Does the host receive it about their event?
                                → Yes → "host_activity"
                                → No  → Is it a digest or newsletter?
                                          → Yes → "digests"
                                          → No  → Is it an invitation?
                                                    → Yes → "invitations"
                                                    → No  → "attendee_activity"
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
| `src/lib/notifications/preferences.ts` | Category map, essential set, preference queries, `EmailCategory` type |
| `src/lib/email/sendWithPreferences.ts` | Decision engine with audit logging |
| `src/lib/email/registry.ts` | Template registry (source of truth for keys) |
| `src/__tests__/email-template-coverage.test.ts` | CI guard: every template must be categorized |
| `src/app/(protected)/dashboard/notifications/EmailPreferencesSection.tsx` | Dashboard Email Preferences UI (collapsible panel, role-aware toggles) |
| `src/app/(protected)/dashboard/settings/page.tsx` | Settings page Email Preferences UI (role-aware toggles) |
| `src/components/navigation/DashboardSidebar.tsx` | Sidebar with "Email Preferences" nav link |
| `src/app/api/digest/unsubscribe/route.ts` | One-click digest unsubscribe (targets `email_digests`) |

### Migrations

| Migration | What it does |
|-----------|-------------|
| `20260224000000_split_event_updates_preferences.sql` | Adds 4 new columns (`email_host_activity`, `email_attendee_activity`, `email_digests`, `email_invitations`), migrates data, resets all users to `true`, rebuilds `upsert_notification_preferences()` RPC with 9 params |
| `20260224010000_seed_prefs_on_signup.sql` | Updates `handle_new_user()` trigger to auto-create a `notification_preferences` row on signup |
