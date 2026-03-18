# Postmortem: Auth Confirm Email Regression (2026-03-18)

## Summary

On March 18, 2026, we confirmed that email/password signups in production were being auto-confirmed without requiring confirm-email flow. This diverged from product intent: non-Google signups must confirm email before first login.

## User Impact

- Users were shown "check your email" messaging in signup UX while no confirmation email/token was generated in auto-confirm cases.
- Affected user report: Lisa Trope (created on 2026-03-16 UTC) did not receive signup confirmation email despite retries.
- Lifetime impact query identified 16 likely impacted non-social accounts auto-confirmed without confirmation tokens.

## Root Cause

Supabase auth configuration drift:

- `Authentication > Sign In / Providers > User Signups > Confirm email` was OFF in production.
- With confirm-email OFF (`mailer_autoconfirm=true` behavior), email/password users were auto-confirmed.

## Remediation

### Configuration

- Re-enabled `Confirm email` in Supabase production project `oipozdbfxyskoscsgbfq`.

### App Safeguard

- Updated signup flow to branch on Supabase response state:
  - If email confirmation is required, route to `/auth/confirm-sent`.
  - If account is already active/confirmed, route directly to onboarding.
- Files:
  - `web/src/lib/auth/signUp.ts`
  - `web/src/app/signup/page.tsx`

### Operations

- Added repeatable impact report:
  - `supabase/scripts/auth_signup_confirmation_gap_report.sql`
- Sent support follow-ups to affected users with incomplete onboarding, including direct login and onboarding links.

## Verification Checklist

1. Supabase dashboard:
   - `Allow new users to sign up` = ON
   - `Confirm email` = ON
2. Run a real `/signup` test with a new non-Google email.
3. Confirm email arrival and callback completion.
4. SQL checks for test user:

```sql
select
  email,
  created_at,
  confirmation_sent_at,
  email_confirmed_at
from auth.users
where email ilike '%<TEST_EMAIL>%'
order by created_at desc
limit 1;
```

Expected before clicking link:
- `confirmation_sent_at` is NOT NULL
- `email_confirmed_at` is NULL

Expected after clicking link:
- `email_confirmed_at` is NOT NULL

## Follow-up Actions

- Keep `Confirm email` setting in release QA checklist for auth changes.
- Re-run `auth_signup_confirmation_gap_report.sql` after any auth config updates.
- Preserve UI safeguard so users are not blocked if config drifts again.
