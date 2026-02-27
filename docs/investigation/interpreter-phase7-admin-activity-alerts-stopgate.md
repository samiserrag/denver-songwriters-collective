# Stop-Gate Track: Admin Activity Alerts Hardening (ALERTS-01)

**Date:** 2026-02-26  
**Status:** APPROVED — production-verified (2026-02-27)  
**Parent tract:** `docs/investigation/interpreter-image-extraction-stopgate.md` (Phases 0-6 complete)

---

## 1) Goals and Context

You requested a trust-focused policy: admins should receive alerts when non-admin users create or edit events.  
Current behavior partially satisfies this, but not across all write paths and not with preference-aware delivery.

This is a separate concern track from interpreter extraction/venue phases.  
Track goal:

1. complete non-admin create/edit coverage,
2. keep alerts actionable (field/date context),
3. respect admin notification preferences,
4. avoid noisy or duplicate alerts.

This phase is hardening, not product redesign.

---

## 2) Current State Evidence

## 2.1 What already works

1. Non-admin **create** sends admin lifecycle email:
   - `web/src/app/api/my-events/route.ts`
2. Non-admin **series edit** sends admin lifecycle email:
   - `web/src/app/api/my-events/[id]/route.ts`
3. Admin alert email template helper exists:
   - `web/src/lib/email/adminEventAlerts.ts`

## 2.2 Gaps

1. Non-admin **occurrence override edits** do not send admin lifecycle email:
   - `web/src/app/api/my-events/[id]/overrides/route.ts` (no `sendAdminEventAlert` import/call)
2. Admin lifecycle emails are sent to one hardcoded mailbox:
   - `web/src/lib/email/mailer.ts:72` (`ADMIN_EMAIL`)
3. Lifecycle alerts bypass preference-aware send path:
   - `web/src/lib/email/adminEventAlerts.ts` used `sendEmail` directly
   - preference helper existed but was unused: `web/src/lib/email/sendWithPreferences.ts`
4. `adminEventLifecycleAlert` is not mapped in email preference category map:
   - category map location: `web/src/lib/notifications/preferences.ts`
5. Dashboard `admin_notifications` system exists, but no lifecycle event types are currently modeled in enum:
   - enum defined in `supabase/migrations/20251207000001_admin_notifications.sql:20`
   - RPC exists: `supabase/migrations/20251207000001_admin_notifications.sql:88`

---

## 3) Assumptions

1. The requirement is specifically for **non-admin activity** (admin edits do not trigger alerts).
2. Email is the primary required channel; dashboard admin notifications are a recommended secondary channel.
3. Existing event write authority remains unchanged (`/api/my-events`, `/api/my-events/[id]`, `/api/my-events/[id]/overrides`).
4. Interpreter writes are already routed through existing event APIs, so no separate interpreter write channel is needed.

---

## 4) Scope and Decisions

## 4.1 Required (7A, no migration)

1. Add missing non-admin alert coverage for occurrence overrides:
   - `POST /api/my-events/[id]/overrides` emits admin lifecycle alert for meaningful non-admin changes.
2. Make admin lifecycle alerts preference-aware:
   - use `sendAdminEmailWithPreferences(...)` path where admin user id is known.
3. Map lifecycle template to admin preference category:
   - add `adminEventLifecycleAlert: "admin_notifications"` to `EMAIL_CATEGORY_MAP`.
4. Add alert context parity:
   - include action (`create`, `edit_series`, `edit_occurrence`),
   - date key for occurrence edits,
   - changed field labels where available.

## 4.2 Recommended (7B, migration required, optional this phase)

1. Write admin dashboard notifications for lifecycle alerts via `create_admin_notification(...)`.
2. Add enum values for lifecycle activity in `notification_type`:
   - e.g. `event_created_non_admin`, `event_edited_non_admin`, `event_occurrence_edited_non_admin`.

If 7B is deferred, email-only can still ship for this alert track.

### Approved decisions (2026-02-26)

1. **7A scope:** approved and implemented.
2. **7B scope:** deferred (no migration in this execution cycle).
3. **Noise policy:** per-write alerts, no dedupe window in 7A.

---

## 5) Risks and Critique

1. **Coverage mismatch risk** (blocking, correctness)  
   If override path is not included, admins miss high-impact per-occurrence changes.

2. **Preference contract violation risk** (non-blocking, correctness)  
   Direct `sendEmail` bypass can ignore `email_admin_notifications` expectations.

3. **Alert fatigue risk** (non-blocking, product)  
   Frequent small edits could create excess alerts without dedupe/rate limiting by event/user/time window.

4. **Migration coupling risk (7B only)** (blocking, correctness)  
   Extending enum `notification_type` requires coordinated migration + type regeneration.

---

## 6) Coupling Surface

1. API routes:
   - `web/src/app/api/my-events/route.ts`
   - `web/src/app/api/my-events/[id]/route.ts`
   - `web/src/app/api/my-events/[id]/overrides/route.ts`
2. Email delivery:
   - `web/src/lib/email/adminEventAlerts.ts`
   - `web/src/lib/email/sendWithPreferences.ts`
   - `web/src/lib/notifications/preferences.ts`
3. Optional DB surface (7B):
   - `notification_type` enum + `admin_notifications` table/RPC

---

## 7) Migration and Rollback

## 7.1 7A (no migration)

- Code-only rollback:
  - revert route-level alert calls and preference mapping changes.

## 7.2 7B (if approved)

- Forward migration required (enum extension + any helper updates).
- Rollback plan must be additive-safe (avoid destructive enum operations in rollback).

---

## 8) Test and Smoke Plan

## 8.1 Unit / source tests

1. Extend `adminEventAlerts` tests:
   - occurrence edit payload support (date key + changed fields).
2. Add route tests:
   - non-admin override path triggers lifecycle alert call,
   - admin override path does not trigger lifecycle alert.
3. Extend notification preference tests:
   - `adminEventLifecycleAlert` mapped to `admin_notifications`.

## 8.2 Integration smoke (production)

1. Non-admin create event -> admin lifecycle email received.
2. Non-admin edit series -> admin lifecycle email received.
3. Non-admin edit occurrence override -> admin lifecycle email received.
4. Toggle admin `email_admin_notifications=false` -> lifecycle emails suppressed.
5. Axiom 24h checks:
   - lifecycle alert errors = 0,
   - no unexpected alert storms.

---

## 9) Deliverables

1. Complete non-admin alert coverage across create/edit/override routes.
2. Preference-aware lifecycle alert delivery.
3. Updated tests and `docs/SMOKE-PROD.md` section for Phase 7 alerts.
4. Optional: admin dashboard notification channel with migration (if 7B approved).

### 9.1 Implementation evidence (7A)

1. Preference-aware lifecycle alert sender:
   - `web/src/lib/email/adminEventAlerts.ts`
   - now resolves admin recipients from `profiles (role='admin')` via service role and sends via `sendAdminEmailWithPreferences(...)`
   - keeps fallback to `ADMIN_EMAIL` on infrastructure failure.
2. Template category mapping added:
   - `web/src/lib/notifications/preferences.ts`
   - `adminEventLifecycleAlert: "admin_notifications"`.
3. Action context added in create/edit routes:
   - `web/src/app/api/my-events/route.ts` (`actionContext: "create"`)
   - `web/src/app/api/my-events/[id]/route.ts` (`actionContext: "edit_series"`).
4. Missing override-path coverage added:
   - `web/src/app/api/my-events/[id]/overrides/route.ts`
   - non-admin occurrence edits now emit lifecycle alert with action context + occurrence date + changed field labels.
5. Tests added/updated:
   - `web/src/lib/email/__tests__/adminEventAlerts.test.ts`
   - `web/src/__tests__/phase7-admin-event-activity-alerts.test.ts` (new)
   - `web/src/__tests__/notification-preferences.test.ts`.

### 9.2 Local verification

Executed:

```bash
cd web && npx vitest run src/lib/email/__tests__/adminEventAlerts.test.ts src/__tests__/notification-preferences.test.ts src/__tests__/phase7-admin-event-activity-alerts.test.ts src/__tests__/slug-redirect-and-cancel-guardrails.test.ts src/__tests__/media-embed-page-wiring.test.ts
```

Result: pass.

```bash
cd web && npx eslint src/lib/email/adminEventAlerts.ts src/app/api/my-events/route.ts src/app/api/my-events/[id]/route.ts src/app/api/my-events/[id]/overrides/route.ts src/lib/notifications/preferences.ts src/lib/email/__tests__/adminEventAlerts.test.ts src/__tests__/notification-preferences.test.ts src/__tests__/phase7-admin-event-activity-alerts.test.ts
```

Result: clean for changed files (non-blocking baseline-browser-mapping freshness notice only).

---

## 10) Production Verification (2026-02-27)

Production smoke completed on live deployment commit `068c4558`.

| Check | Result |
|---|---|
| Non-admin create -> lifecycle alert | PASS (email received) |
| Non-admin edit_series -> lifecycle alert | PASS (email received) |
| Non-admin edit_occurrence -> lifecycle alert | PASS (email received) |
| Preference gating (`email_admin_notifications=false`) | PASS (emails suppressed for both admins) |
| Axiom 24h lifecycle alert errors | 0 |
| Axiom 24h email errors | 0 |
| Axiom 24h rate-limit fallbacks | 0 |

Cleanup confirmed:
- Admin preferences restored to `true`.
- Smoke test event `c754143c-62da-4fea-b8da-33fef166b371` removed.
- Smoke-created occurrence overrides removed.
