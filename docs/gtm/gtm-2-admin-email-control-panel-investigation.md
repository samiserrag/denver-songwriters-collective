# GTM-2: Admin Email Control Panel + Friendly Opt-Out UX — STOP-GATE Investigation

**Status:** STOP-GATE DOCUMENT — AWAITING APPROVAL
**Phase:** GTM-2 (Admin Email Control Panel + Explicit, Friendly Opt-Out UX)
**Author:** Repo Agent
**Date:** February 2026
**Depends On:** GTM-1 (Weekly Happenings Digest — Deployed), Email Safety Fixes P1 (Idempotency Guard — Deployed)
**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States), §10 (Defaults), §11 (Soft Constraints)

---

## North Star

> The weekly digest is free, useful, community-powered, and reversible.
> We optimize for growth + trust, not compliance friction.

- New users are auto opt-in.
- Opt-out must be easy, friendly, and reversible.
- Opt-back-in must be just as easy.

---

## Table of Contents

1. [Current-State Inventory](#1-current-state-inventory)
2. [Decisions Made (Section A)](#2-decisions-made--opt-in--opt-out-model)
3. [Copy Requirements (Section B)](#3-copy-requirements--draft-only)
4. [Admin Email Control Panel (Section C)](#4-admin-email-control-panel--mvp)
5. [Backend Architecture (Section D)](#5-backend-architecture--proposals)
6. [Test Plan Outline (Section E)](#6-test-plan-outline)
7. [STOP-GATE Section](#7-stop-gate-section)
8. [Appendix: File Path Reference](#8-appendix-file-path-reference)

---

## 1. Current-State Inventory

### 1.1 Email Preferences System

**Database table:** `notification_preferences` (migration `20260101400000`)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `user_id` | UUID PK | — | FK to auth.users |
| `email_claim_updates` | BOOLEAN | `true` | Gate claim-related emails |
| `email_event_updates` | BOOLEAN | `true` | Gate event/digest emails |
| `email_admin_notifications` | BOOLEAN | `true` | Gate admin alerts |

**Key behaviors:**
- Row created lazily — no auto-creation on signup (`preferences.ts` lines 42-50)
- Missing row = all defaults `true` (`getPreferences()` returns `DEFAULT_PREFERENCES`)
- Digest recipient logic defaults to `true` if no preference row: `prefMap.get(profile.id) ?? true` (`weeklyHappenings.ts` line 333)
- Both digest templates mapped to `event_updates` category (`preferences.ts` lines 123-124)

**User settings UI:** `/dashboard/settings/page.tsx`
- 3 toggle switches for the 3 email categories
- "Event updates" toggle label: "Reminders and changes for events you're attending or hosting"
- **The toggle description does NOT mention the weekly digest** — users have no way to know this toggle controls digest delivery
- Inline confirmation: "Saved. You'll still see all notifications in your dashboard."

**Critical insight:** The codebase ALREADY implements an opt-out model with auto opt-in default (`?? true`). The current behavior matches the GTM-2 North Star for new users. What's missing: clear unsubscribe UX, warmer copy, admin controls, and dashboard toggle transparency.

### 1.2 Digest Pipeline

**Cron configuration:** `web/vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/weekly-open-mics", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/weekly-happenings", "schedule": "0 3 * * 0" }
  ]
}
```

Both fire at Sunday 3:00 UTC = Saturday 8:00 PM MST / 9:00 PM MDT.

**Kill switches:** `lib/featureFlags.ts`

| Flag | Env Var | Default | Status |
|------|---------|---------|--------|
| `isWeeklyDigestEnabled()` | `ENABLE_WEEKLY_DIGEST` | `false` | Currently OFF in Vercel |
| `isWeeklyHappeningsDigestEnabled()` | `ENABLE_WEEKLY_HAPPENINGS_DIGEST` | `false` | Currently OFF in Vercel |

**Important note (line 30-31):** "Only one digest kill switch should be enabled at a time. Both crons run at the same time."

**Idempotency guard:** `lib/digest/digestSendLog.ts`
- `digest_send_log` table with unique constraint on `(digest_type, week_key)`
- `claimDigestSendLock()` returns `LockResult { acquired, reason }` (line 60-63)
- Fail-closed: unexpected DB errors block sending (line 94-99)
- Week key: ISO week in America/Denver timezone (e.g., `2026-W05`)
- `DigestType = "weekly_open_mics" | "weekly_happenings"`

**Digest pipeline flow (per cron route):**

```
Kill switch check → CRON_SECRET auth → Service role client
→ Compute week key → Fetch happenings data → Fetch recipients
→ Claim idempotency lock → (if already sent: skip)
→ Send emails with 100ms delay → Log results
```

**Email transport:** `lib/email/mailer.ts`
- Fastmail SMTP via nodemailer
- Per-template rate limiting: 1 email per recipient per template per minute (line 12)
- `ADMIN_EMAIL` = `sami@coloradosongwriterscollective.org` (line 45)
- `maxDuration = 60` on cron routes — at 100ms/email, max ~600 recipients per invocation

### 1.3 Current Unsubscribe UX

**Digest email footer** (`weeklyHappeningsDigest.ts` lines 224-227):

```html
You're receiving this because you opted in to event updates.
<a href="${SITE_URL}/dashboard/settings">Manage your email preferences</a>
```

**Problems with current unsubscribe:**
1. **Requires login** — user must be authenticated to reach `/dashboard/settings`
2. **No one-click unsubscribe** — user must navigate to settings, find the toggle, flip it
3. **Copy is wrong** — says "opted in" but users never explicitly opted in (auto-enrolled)
4. **Toggle description misleading** — "Event updates" toggle says "Reminders and changes for events you're attending or hosting" but also gates weekly digest
5. **No warmth** — cold/transactional language, no community feel

**Shared email wrapper** (`render.ts`):
- `wrapEmailHtml()` provides header image + body + footer
- Footer has Sami's signature, "You can reply directly", site URL
- **No unsubscribe link in the shared wrapper** — each template adds its own
- This is fine: digest unsubscribe UX should be specific to digest, not global

### 1.4 DB-Backed Settings Pattern

**Proven pattern:** `site_settings` table (migration `20251215000001`)

```sql
create table if not exists public.site_settings (
  id text primary key default 'global',
  theme_preset text not null default '',
  font_preset text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
```

- Singleton row with `id='global'`
- Public read, service-role write
- Already proven in production for theme/font settings
- **No DB-backed feature flags exist yet** — all current flags are env vars

### 1.5 `email_event_updates` Coupling Problem

The `email_event_updates` preference currently gates BOTH:
1. **Weekly digest emails** (weeklyOpenMicsDigest, weeklyHappeningsDigest)
2. **Transactional event emails** (eventReminder, eventUpdated, eventCancelled, rsvpConfirmation, waitlistPromotion, occurrenceCancelledHost, occurrenceModifiedHost)

**Evidence:** `preferences.ts` lines 113-124:

```typescript
eventReminder: "event_updates",
eventUpdated: "event_updates",
eventCancelled: "event_updates",
// ...
weeklyOpenMicsDigest: "event_updates",
weeklyHappeningsDigest: "event_updates",
```

**Design question:** Should we add a separate `email_weekly_digest` column, or is the coupling acceptable?

**Recommendation:** Keep coupled for GTM-2 MVP. Adding a separate column introduces migration, UI, and testing complexity. The single "event updates" toggle is simple and matches user mental model — "I don't want event-related emails" covers both. If user feedback demands separation, it's a clean additive change for GTM-3.

**If coupled, the dashboard toggle description MUST be updated** to clearly state it controls the weekly digest too. See Section 3.2.

---

## 2. Decisions Made — Opt-In / Opt-Out Model

These decisions are **authoritative** and replace all prior GTM-2 opt-in proposals.

### 2.1 New Users: Auto Opt-In (Permanent Policy)

New users receive the weekly digest by default. No onboarding checkbox needed. **This is intentional and permanent** — it is the correct default for a free community digest, not a temporary shortcut. This policy holds unless explicitly reversed by Sami.

**Current behavior already matches this.** The `?? true` default in `getDigestRecipients()` (line 333) means any user with an email address and no explicit `email_event_updates = false` preference receives digests. No code change needed for new user opt-in.

**Why auto opt-in:** The digest is free, community-supporting, and genuinely useful for discovering local music. Requiring explicit opt-in would dramatically reduce reach for a low-risk, high-value email that takes 5 seconds to unsubscribe from.

### 2.2 Existing Users: No Forced Migration

Users who already have explicit preferences keep them. Users with no preference row continue to receive digests (existing `?? true` behavior). **No backfill migration.** No forced state change.

**Why no backfill:** The v1 investigation proposed Option C (backfill + flip default). This is unnecessary because the current lazy-row + `?? true` behavior already achieves the desired outcome. Every user is already effectively opted in. Backfilling rows for ~200 users just to flip a default adds risk for zero behavioral change.

### 2.3 Opt-Out: One-Click Unsubscribe

Every digest email must include a **one-click unsubscribe link** that:

1. **Works without login** — tokenized URL with user_id encoded
2. **Takes effect immediately** — sets `email_event_updates = false` on click
3. **Shows a confirmation page** — friendly confirmation with opt-back-in link
4. **No confirmation modal** — click = done, no extra steps
5. **Logged** — unsubscribe action recorded for analytics/debugging

**Unsubscribe flow:**

```
User clicks unsubscribe link in email
  → GET /api/digest/unsubscribe?token=<jwt>
  → Validate JWT (extract user_id, check exp)
  → Upsert notification_preferences: email_event_updates = false
  → Redirect to /digest/unsubscribed (confirmation page)
```

**Confirmation page** (`/digest/unsubscribed`):

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  ✓ You've been unsubscribed                      │
│                                                   │
│  You won't receive the weekly happenings digest   │
│  anymore. You'll still see event notifications    │
│  in your dashboard.                               │
│                                                   │
│  Changed your mind?                               │
│  [Turn digest back on →]  (links to /dashboard/settings)
│                                                   │
│  You can always re-enable the digest from your    │
│  account settings.                                │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 2.4 Opt-Back-In: Must Be Obvious and Trivial

Users who unsubscribed must be able to re-enable the digest easily. This is a **hard requirement**, not a nice-to-have. Opt-back-in must be:

1. **Obvious** — The unsubscribe confirmation page prominently shows "Turn digest back on →" link
2. **Trivial** — Single toggle at `/dashboard/settings`, no waiting period, no re-verification
3. **Transparent** — The toggle description must clearly communicate:
   - What turning it off does (stops weekly digest + event emails)
   - That turning it back on is instant
   - That dashboard notifications are unaffected

### 2.5 Token-Based vs Authenticated Unsubscribe

**Recommended: JWT token-based unsubscribe**

| Approach | Pros | Cons |
|----------|------|------|
| **JWT token (recommended)** | Works without login, one-click, standard email practice | Need JWT signing, tokens have expiry |
| Authenticated route | Simpler, reuses session | Requires login, breaks one-click promise |
| Magic link (verify email) | More secure | Two-step process, not one-click |

**JWT token design:**

```typescript
// Generate unsubscribe token (at email send time)
const token = jwt.sign(
  { userId: recipient.userId, action: "unsubscribe_digest" },
  process.env.UNSUBSCRIBE_SECRET,
  { expiresIn: "90d" }
);

// Unsubscribe URL in email
const unsubscribeUrl = `${SITE_URL}/api/digest/unsubscribe?token=${token}`;
```

- **Secret:** New env var `UNSUBSCRIBE_SECRET` (separate from JWT_SECRET for defense in depth)
- **Expiry:** 90 days — long enough that old emails still work, short enough for security
- **Payload:** `{ userId, action: "unsubscribe_digest" }` — action field prevents token misuse
- **Validation:** Check `action === "unsubscribe_digest"`, verify not expired, extract userId
- **Idempotent:** Clicking multiple times is safe (upsert, not toggle)

**Alternative: HMAC-signed URL (simpler, no expiry concerns)**

```typescript
const payload = `${userId}:unsubscribe_digest`;
const signature = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("hex");
const unsubscribeUrl = `${SITE_URL}/api/digest/unsubscribe?uid=${userId}&sig=${signature}`;
```

- **Pro:** No expiry — works forever (email links should ideally never expire)
- **Pro:** Simpler — no JWT library needed
- **Con:** No built-in expiry (acceptable for unsubscribe — it's always valid)

**Recommendation:** HMAC-signed URL for simplicity and no-expiry behavior. Unsubscribe links should work forever.

### 2.6 Logged-Out Behavior

When a user clicks unsubscribe from an email:
- **Token is valid:** Preference updated immediately, redirect to confirmation page
- **Token is invalid/tampered:** Show error page with link to log in and manage settings manually
- **User already unsubscribed:** Show confirmation page (idempotent, no error)

No login required at any point in the unsubscribe flow.

---

## 3. Copy Requirements

Friendly, warm, guilt-free opt-out language is a **hard requirement**, not a suggestion. The exact wording below is draft (will be refined before implementation), but the copy principles in §3.1 are binding constraints. **Do not hardcode draft copy, but do enforce the principles.**

### 3.1 Email Footer (Near Unsubscribe Link)

**Current (to be replaced):**

```
You're receiving this because you opted in to event updates.
Manage your email preferences
```

**Draft replacement:**

```
This free digest supports Denver's songwriter community.
Something wrong? Just reply to this email and we'll fix it.

Not for you right now? Unsubscribe — you can always come back.
```

**Copy principles:**
- Warm, human, slightly playful, community-forward
- No guilt or pressure about unsubscribing
- Communicate: digest is free, supports local music, corrections welcome
- Explicitly state: unsubscribing is reversible, opting back in is easy
- Skimming/ignoring is fine — no "you're missing out" language

**Alternative draft options:**

Option A (shortest):
```
Free weekly digest for Denver songwriters. Reply if anything looks off.
Not your thing? Unsubscribe anytime — you can always re-subscribe.
```

Option B (warmest):
```
We send this every week to help you find your next stage, session, or jam.
Spot an error? Reply and we'll fix it. Want to stop? Unsubscribe — no hard feelings, and you can always come back.
```

### 3.2 Dashboard Toggle Helper Text

**Current (to be replaced):**

```
Event updates
Reminders and changes for events you're attending or hosting
```

**Draft replacement:**

```
Event updates & weekly digest
Weekly happenings digest + reminders and changes for events you're attending or hosting.
Turn this off to stop all event-related emails. You can turn it back on anytime.
```

**When toggle is OFF, show reinstatement nudge:**

```
Digest paused. You can turn it back on anytime — no waiting period.
```

### 3.3 Unsubscribe Confirmation Page

See Section 2.3 for the page layout. Copy should:
- Confirm the action clearly ("You've been unsubscribed")
- Reassure nothing else changed ("You'll still see notifications in your dashboard")
- Make opt-back-in obvious and prominent
- No guilt ("Changed your mind?" not "We'll miss you!")

---

## 4. Admin Email Control Panel — MVP

### 4.1 Route

**Proposed route:** `/dashboard/admin/email`

**Navigation entry point:** Admin Hub (`/dashboard/admin/page.tsx`) → new "Email & Digests" card in the hub grid.

### 4.2 Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ← Admin Hub                                                 │
│                                                               │
│  EMAIL & DIGEST CONTROL PANEL                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  WEEKLY HAPPENINGS DIGEST                                │ │
│  │                                                           │ │
│  │  Status: ● Enabled (Automated)  |  ○ Disabled            │ │
│  │          [DB-backed toggle — persists across deploys]     │ │
│  │                                                           │ │
│  │  Schedule: Every Sunday at 8:00 PM Denver time            │ │
│  │  Last sent: 2026-W05 (Feb 1, 2026) — 47 recipients       │ │
│  │  Next scheduled: 2026-W06 (Feb 8, 2026)                   │ │
│  │                                                           │ │
│  │  ┌───────────────────────────────────────────────────┐   │ │
│  │  │  RECIPIENTS                                        │   │ │
│  │  │  Opted-in members: 47                              │   │ │
│  │  └───────────────────────────────────────────────────┘   │ │
│  │                                                           │ │
│  │  ┌───────────────────────────────────────────────────┐   │ │
│  │  │  ACTIONS                                           │   │ │
│  │  │                                                     │   │ │
│  │  │  [Preview Email]  [Send Test to Me]  [Send Now]    │   │ │
│  │  │                                                     │   │ │
│  │  │  ⚠ "Send Now" requires confirmation dialog         │   │ │
│  │  └───────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  WEEKLY OPEN MICS DIGEST (LEGACY)                        │ │
│  │                                                           │ │
│  │  Status: ○ Disabled (superseded by Happenings Digest)     │ │
│  │  Note: Keep disabled. Happenings Digest covers all types. │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  SEND HISTORY                                             │ │
│  │                                                           │ │
│  │  Week       | Type              | Recipients | Sent At    │ │
│  │  2026-W05   | weekly_happenings | 47         | Feb 1 8PM  │ │
│  │  2026-W04   | weekly_happenings | 45         | Jan 25 8PM │ │
│  │  ...                                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 UI Controls

| Control | Type | Purpose |
|---------|------|---------|
| Automation toggle | Radio (Enabled/Disabled) | DB-backed; primary control for automated sends |
| Last sent info | Read-only text | Shows last `digest_send_log` entry |
| Next scheduled info | Computed text | Based on automation status + current date |
| Recipient count | Read-only stat | Live count from `getDigestRecipients()` |
| Preview Email button | Button | Opens email preview in new tab (HTML render) |
| Send Test to Me button | Button | Sends digest to admin's own email; **bypasses idempotency** |
| Send Now button | Button with confirm | Triggers manual send to all recipients; **respects idempotency** |
| Send History table | Read-only table | Rows from `digest_send_log` ordered by `sent_at DESC` |

### 4.4 Confirmation Dialog for "Send Now"

```
┌─────────────────────────────────────────────────┐
│  SEND WEEKLY HAPPENINGS DIGEST NOW?              │
│                                                   │
│  This will send the digest to 47 recipients.     │
│                                                   │
│  Week: 2026-W06                                  │
│  Happenings found: 23 across 12 venues            │
│                                                   │
│  ⚠ If the automated cron already sent this       │
│    week's digest, this will be blocked by         │
│    the idempotency guard (no duplicates).         │
│                                                   │
│  [Cancel]                    [Send to 47 people]  │
└─────────────────────────────────────────────────┘
```

### 4.5 "Send Test to Me" Behavior

- Sends the real digest content (this week's happenings) to the admin's own email
- **Bypasses idempotency lock** — test sends are always repeatable
- **Does NOT write to `digest_send_log`** — test sends don't count as "real" sends
- Uses `testRecipient` flag in the send function to skip lock logic
- Button label shows admin's email: "Send test to sami@..."

### 4.6 Preview Mode

**Route:** `GET /api/admin/digest/preview?type=weekly_happenings`

**Returns:**

```json
{
  "subject": "Happenings This Week in Denver",
  "html": "<html>...(full email HTML)...</html>",
  "text": "...(plain text version)...",
  "recipientCount": 47,
  "happeningCount": 23,
  "venueCount": 12,
  "weekKey": "2026-W06",
  "alreadySentThisWeek": false
}
```

**No side effects:** Does not send email, does not write to `digest_send_log`, does not modify any state.

---

## 5. Backend Architecture — Proposals

### 5.1 DB-Backed Automation Toggle

**Proposed: New `digest_settings` table**

```sql
CREATE TABLE public.digest_settings (
  digest_type TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: public read, no public write (service role or admin API only)
ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read digest settings"
  ON public.digest_settings FOR SELECT
  USING (true);

-- Seed rows
INSERT INTO public.digest_settings (digest_type, enabled) VALUES
  ('weekly_happenings', false),
  ('weekly_open_mics', false);
```

**Why new table (not extending `site_settings`):**
- Clean separation: visual settings (theme/font) vs operational settings (email)
- One row per digest type — extensible for future digest types (monthly recap, etc.)
- `updated_by` tracks which admin changed the setting

### 5.2 Precedence Rules

**Current:** Env var kill switch → if not `=== "true"`, cron returns 200 OK with "disabled" and does nothing.

**Proposed precedence (cron handler change):**

```
1. Env var emergency kill — if ENABLE_WEEKLY_HAPPENINGS_DIGEST === "false", BLOCK
   (Emergency override via Vercel dashboard. Absent/unset = defer to DB.)

2. DB setting — if digest_settings.enabled === false, SKIP
   (Primary control via admin panel.)

3. Idempotency guard — prevents duplicates regardless of source
```

**Cron handler pseudocode (updated):**

```typescript
// 1. Env var emergency kill (only explicit "false" blocks)
if (process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST === "false") {
  return { message: "Emergency kill switch active" };
}

// 2. DB setting (primary control)
const settings = await getDigestSettings(supabase, "weekly_happenings");
if (!settings.enabled) {
  return { message: "Digest disabled via admin panel" };
}

// 3. Proceed with existing pipeline (idempotency, fetch, send)
```

**Behavior matrix:**

| Env Var | DB Setting | Result |
|---------|-----------|--------|
| `"false"` | `true` | **BLOCKED** (emergency kill wins) |
| `"false"` | `false` | **BLOCKED** |
| `"true"` | `true` | **SENDS** |
| `"true"` | `false` | **SKIPPED** (DB says no) |
| absent/unset | `true` | **SENDS** (DB controls) |
| absent/unset | `false` | **SKIPPED** (DB controls) |

**Migration path:** Once the DB toggle is operational:
1. Remove `ENABLE_WEEKLY_HAPPENINGS_DIGEST=true` from Vercel env vars
2. Enable via admin panel (DB toggle = `true`)
3. Keep the env var check in code as emergency-only escape hatch
4. Same for `ENABLE_WEEKLY_DIGEST` (open mics cron)

### 5.3 Manual Send ("Send Now")

**Approach:** Extract shared send logic from cron handler.

**Current cron handler structure** (`app/api/cron/weekly-happenings/route.ts`):

```
1. Kill switch check
2. CRON_SECRET auth
3. Create service role client
4. Compute week key
5. Fetch happenings data
6. Fetch recipients
7. Claim idempotency lock
8. Send emails (loop with 100ms delay)
9. Return results
```

**Proposed refactor:** Extract steps 4-8 into a shared function:

```typescript
// lib/digest/sendWeeklyHappeningsDigest.ts (NEW)

export async function sendWeeklyHappeningsDigest(options: {
  supabase: SupabaseClient;
  dryRun?: boolean;        // Preview mode: fetch data, don't send
  testRecipient?: string;  // Send to single email only (bypass lock)
}): Promise<DigestSendResult> {
  // Steps 4-8 extracted from cron handler
  // If dryRun: return data without sending
  // If testRecipient: send to one email, skip lock
  // Otherwise: full send with lock
}
```

**New API route:** `POST /api/admin/digest/send`

```
Admin auth check →
  - body.mode === "preview": return data (no send, no lock)
  - body.mode === "test": send to admin email only (no lock)
  - body.mode === "send": full send with idempotency lock
```

**Idempotency for manual send:** Manual "Send Now" uses the same `claimDigestSendLock()`. If the automated cron already sent this week, manual send is blocked with a clear message. If manual send succeeds first, the cron is blocked. No duplicates possible.

### 5.4 "Send Test to Me" Implementation

```typescript
// In sendWeeklyHappeningsDigest:
if (options.testRecipient) {
  // Compute week key, fetch happenings, generate email
  // Send to ONLY options.testRecipient
  // Do NOT claim lock
  // Do NOT write to digest_send_log
  return { sent: 1, testMode: true };
}
```

Test sends are:
- Always repeatable (no idempotency check)
- Not logged in `digest_send_log`
- Limited to the requesting admin's email
- Using real happenings data (not dummy data)

### 5.5 Unsubscribe API Endpoint

**Route:** `GET /api/digest/unsubscribe?uid={userId}&sig={hmacSignature}`

```typescript
// 1. Validate HMAC signature
const payload = `${uid}:unsubscribe_digest`;
const expectedSig = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("hex");
if (sig !== expectedSig) {
  return redirect("/digest/unsubscribed?error=invalid");
}

// 2. Upsert notification_preferences: email_event_updates = false
const supabase = createServiceRoleClient();
await supabase.rpc("upsert_notification_preferences", {
  p_user_id: uid,
  p_email_event_updates: false,
  // Other fields: null (don't change)
});

// 3. Redirect to confirmation page
return redirect("/digest/unsubscribed?success=true");
```

**Key details:**
- Uses `GET` method (clicked from email — must be GET for email client compatibility)
- Uses service role client to bypass RLS (user is not authenticated)
- HMAC-signed URL — no expiry, works forever, idempotent
- Redirects to friendly confirmation page (not JSON response)
- The existing `upsert_notification_preferences` RPC is reused

**Unsubscribe URL generation** (at email build time in `getWeeklyHappeningsDigestEmail`):

```typescript
function generateUnsubscribeUrl(userId: string): string {
  const payload = `${userId}:unsubscribe_digest`;
  const sig = crypto.createHmac("sha256", process.env.UNSUBSCRIBE_SECRET || "").update(payload).digest("hex");
  return `${SITE_URL}/api/digest/unsubscribe?uid=${userId}&sig=${sig}`;
}
```

This means the digest email template needs `userId` added to its params interface.

### 5.6 Unsubscribe Confirmation Page

**Route:** `/digest/unsubscribed` (public page, no auth required)

- Static page with query param handling (`?success=true` or `?error=invalid`)
- Success: "You've been unsubscribed" + opt-back-in link
- Error: "Something went wrong" + link to log in and manage settings
- Uses same DSC branding/layout as other public pages

### 5.7 Email Template Changes

The `weeklyHappeningsDigest.ts` template needs these changes:

1. **Add `userId` to params** — needed to generate unsubscribe URL
2. **Replace footer copy** — warm, community-forward copy (Section 3.1 drafts)
3. **Add one-click unsubscribe link** — HMAC-signed URL, prominent placement
4. **Update plain text version** — same copy changes

**The `weeklyOpenMicsDigest.ts` template needs the same changes** (if we ever re-enable it).

### 5.8 New Env Var

| Env Var | Purpose | Required |
|---------|---------|----------|
| `UNSUBSCRIBE_SECRET` | HMAC key for signing unsubscribe URLs | Yes (new) |

If not set, unsubscribe URL generation should fail-closed (log error, omit link, do not crash email send).

---

## 6. Test Plan Outline

**Do not implement tests yet.** This section outlines what should be tested.

### 6.1 Unit Tests

| Test | Description |
|------|-------------|
| `digest_settings` table CRUD | Insert, read, update settings rows |
| `getDigestSettings()` helper | Returns settings, handles missing rows |
| Precedence: env var `"false"` kills DB-enabled | Env `"false"` overrides DB `enabled=true` |
| Precedence: DB disabled blocks send | DB `enabled=false` blocks even without env var |
| Precedence: env var absent, DB enabled | Send proceeds normally |
| Precedence: env var `"true"`, DB disabled | DB wins (disabled) |
| Preview returns data without side effects | No `digest_send_log` row created |
| Test send bypasses idempotency | Test email sent even if week already sent |
| Manual send uses idempotency | Full send blocked if already sent this week |
| HMAC unsubscribe URL generation | Correct URL format, valid signature |
| HMAC unsubscribe URL validation | Valid sig accepted, invalid rejected |
| Unsubscribe is idempotent | Double-unsubscribe doesn't error |
| Unsubscribe sets correct preference | `email_event_updates` = false after unsubscribe |
| Digest email includes unsubscribe link | Every sent email contains the tokenized URL |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| Admin page renders with correct counts | Recipient count matches `getDigestRecipients()` |
| Toggle updates DB and reflects in UI | Enable/disable persists to `digest_settings` |
| Send History table shows `digest_send_log` rows | Sorted by `sent_at DESC` |
| Preview renders email HTML | Correct subject, happenings, venue count |
| Send Test to Me delivers email | Admin receives email, no lock claimed |
| Send Now triggers full send | Lock claimed, recipients emailed |
| Send Now blocked when already sent | Shows "already sent" message |
| Cron respects DB toggle | Cron skips when `digest_settings.enabled = false` |
| Unsubscribe link in email works | Click → preference updated → confirmation shown |
| Unsubscribed user excluded from next send | After unsubscribe, user not in recipient list |

### 6.3 Manual Smoke Tests

| Test | Steps |
|------|-------|
| Admin panel loads | Navigate to `/dashboard/admin/email`, verify all sections |
| Toggle automation | Flip Happenings Digest to Enabled, verify DB row updated |
| Preview email | Click "Preview Email", verify HTML renders with unsubscribe link |
| Send test | Click "Send Test to Me", verify email arrives with unsubscribe link |
| Send now | Click "Send Now", confirm dialog, verify emails sent |
| Send now (duplicate) | Click "Send Now" again same week, verify blocked |
| Unsubscribe from email | Click unsubscribe link in test email, verify confirmation page |
| Opt back in | After unsubscribe, go to `/dashboard/settings`, toggle ON |
| Cron with DB enabled | Set DB enabled, trigger cron, verify sends |
| Emergency kill | Set env var `=false`, verify all sends blocked regardless of DB |

---

## 7. STOP-GATE Section

### 7.1 Blocking Questions

| # | Question | Recommendation | Impact |
|---|----------|----------------|--------|
| **BQ1** | Separate `email_weekly_digest` column or keep coupled with `email_event_updates`? | Keep coupled for MVP (see §1.5) | If separate: new migration + new toggle + new tests. If coupled: update toggle description only. |
| **BQ2** | HMAC-signed URL or JWT for unsubscribe tokens? | HMAC (simpler, no expiry — see §2.5) | Implementation complexity. HMAC is ~5 lines, JWT requires library + expiry logic. |

### 7.2 Non-Blocking Notes

| Note | Detail |
|------|--------|
| **NB1: Two crons at same time** | Both crons fire at `0 3 * * 0`. Admin panel should show both digests and recommend only one active. |
| **NB2: Rate limiting is fine** | `mailer.ts` has 1-min per-template rate limit. Cron has 100ms delay. Neither bottleneck until 600+ recipients. |
| **NB3: `maxDuration = 60`** | 60-second Vercel timeout. At 100ms/email, max ~600 recipients per cron invocation. Fine for GTM-2 (<100 recipients). |
| **NB4: Send History already exists** | `digest_send_log` table already tracks sends. Admin panel just queries and displays it. |
| **NB5: Template preview works locally** | `scripts/preview-all-emails.ts` generates previews. Admin preview API reuses same template functions. |
| **NB6: `upsert_notification_preferences` RPC already exists** | Used by settings page. Unsubscribe endpoint can reuse it (pass `p_email_event_updates: false`, others `null`). |
| **NB7: No newsletter subscriber changes** | Newsletter subscribers (`newsletter_subscribers` table) remain out of scope. They don't receive digests and won't be affected by any GTM-2 changes. |

### 7.3 MVP Scope

**In scope for GTM-2 MVP:**

| Feature | Priority | Rationale |
|---------|----------|-----------|
| Admin page at `/dashboard/admin/email` | P0 | Core deliverable |
| DB-backed automation toggle (`digest_settings` table) | P0 | Replace env var kill switch as primary control |
| Preview Email (HTML render in browser) | P0 | Safety — see before send |
| Send Test to Me (single email, bypass lock) | P0 | Safety — verify content |
| Send Now (manual trigger with idempotency) | P0 | Operational control |
| Send History table (read `digest_send_log`) | P0 | Visibility into past sends |
| Recipient count display | P0 | Know who you're sending to |
| One-click unsubscribe link in digest emails | P0 | Core opt-out UX |
| Unsubscribe API endpoint (HMAC-signed) | P0 | Backend for one-click unsubscribe |
| Unsubscribe confirmation page | P0 | Friendly opt-out landing |
| Dashboard toggle description update | P0 | Transparency about what the toggle controls |
| Cron handler DB-toggle integration | P0 | Cron respects admin panel |
| Warmer email footer copy | P1 | Community-forward tone (draft only) |
| Admin hub "Email & Digests" card | P1 | Discoverability |

**Deferred to GTM-3+:**

| Feature | Rationale |
|---------|-----------|
| Newsletter subscriber digest inclusion | Requires re-consent mechanism |
| Separate `email_weekly_digest` preference column | Only if user feedback demands it |
| Personalized digest (location, type filters) | Complexity for marginal gain at current scale |
| A/B testing subject lines | Requires tracking infrastructure |
| Open/click tracking | Privacy implications |
| Custom send schedule | Complexity for marginal gain |
| Per-recipient preview ("Preview as Jane Doe") | Nice-to-have |
| Onboarding opt-in checkbox | Not needed (auto opt-in model) |

### 7.4 Files to Create (Estimated)

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_digest_settings.sql` | New table + seed rows + RLS |
| `lib/digest/digestSettings.ts` | `getDigestSettings()`, `updateDigestSettings()` helpers |
| `lib/digest/sendWeeklyHappeningsDigest.ts` | Shared send function (extracted from cron handler) |
| `lib/digest/unsubscribeToken.ts` | HMAC token generation + validation helpers |
| `app/api/admin/digest/preview/route.ts` | Preview API (GET) |
| `app/api/admin/digest/send/route.ts` | Manual send API (POST) |
| `app/api/digest/unsubscribe/route.ts` | One-click unsubscribe endpoint (GET) |
| `app/digest/unsubscribed/page.tsx` | Unsubscribe confirmation page |
| `app/(protected)/dashboard/admin/email/page.tsx` | Admin control panel page |
| `__tests__/gtm-2-admin-email-control.test.ts` | Test suite |

### 7.5 Files to Modify (Estimated)

| File | Change |
|------|--------|
| `app/api/cron/weekly-happenings/route.ts` | Replace kill switch with DB toggle check + extract send logic |
| `app/api/cron/weekly-open-mics/route.ts` | Same changes (for consistency) |
| `lib/featureFlags.ts` | Add note that env vars are now emergency-only |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Add `userId` param, unsubscribe URL, warmer footer copy |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Same changes (for consistency) |
| `lib/digest/weeklyHappenings.ts` | Pass `userId` through to email template |
| `app/(protected)/dashboard/admin/page.tsx` | Add "Email & Digests" card to admin hub |
| `app/(protected)/dashboard/settings/page.tsx` | Update toggle description to mention weekly digest |

### 7.6 Migration Count

- **1 new migration** (`digest_settings` table + seed rows + RLS)
- Additive only — no ALTER/DROP on existing tables
- No preference backfill migration needed (existing `?? true` default is correct)
- Compatible with MODE A (`supabase db push`) or MODE B (direct psql)

### 7.7 New Env Vars

| Env Var | Purpose | Where to Set |
|---------|---------|--------------|
| `UNSUBSCRIBE_SECRET` | HMAC key for signing unsubscribe URLs | Vercel env vars (production + preview) |

### 7.8 Rollback Plan

| Layer | Rollback |
|-------|----------|
| DB toggle | Set `digest_settings.enabled = false` via admin panel or psql |
| Env var kill | Set `ENABLE_WEEKLY_HAPPENINGS_DIGEST=false` in Vercel (emergency) |
| Unsubscribe links | Old emails with links still work (HMAC has no expiry) |
| Code rollback | Revert cron handler to env-var-only kill switch (remove DB check) |
| Migration | `digest_settings` table can remain (unused, no harm) |
| Email template | Revert to old footer copy (no structural dependency) |

---

## 8. Appendix: File Path Reference

All paths relative to `web/src/` unless noted.

| File | Lines | Purpose |
|------|-------|---------|
| `lib/auth/adminAuth.ts` | 28-43 | `checkAdminRole()` — admin determination |
| `lib/featureFlags.ts` | 21-35 | Kill switch functions (env var based) |
| `lib/digest/digestSendLog.ts` | 33-58 | `computeWeekKey()` — ISO week in Denver tz |
| `lib/digest/digestSendLog.ts` | 60-103 | `LockResult` type + `claimDigestSendLock()` |
| `lib/digest/digestSendLog.ts` | 111-135 | `hasAlreadySentDigest()` — read-only check |
| `lib/digest/weeklyHappenings.ts` | 297-347 | `getDigestRecipients()` — `?? true` default logic (line 333) |
| `lib/email/mailer.ts` | 57-113 | `sendEmail()` with rate limiting |
| `lib/email/render.ts` | 22-24 | `SITE_URL` export |
| `lib/email/render.ts` | 81-128 | `wrapEmailHtml()` — shared email wrapper (no unsub link) |
| `lib/email/templates/weeklyHappeningsDigest.ts` | 224-227 | Current unsubscribe footer (login-required link) |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | — | Parallel digest template (same footer pattern) |
| `lib/email/registry.ts` | 108-132 | `EmailTemplateKey` union type (24 templates) |
| `lib/notifications/preferences.ts` | 23-27 | `DEFAULT_PREFERENCES` — all true |
| `lib/notifications/preferences.ts` | 103-129 | `EMAIL_CATEGORY_MAP` — both digests → `event_updates` |
| `lib/notifications/preferences.ts` | 58-76 | `upsertPreferences()` — existing RPC |
| `lib/supabase/serviceRoleClient.ts` | — | Service role client (bypasses RLS) |
| `app/api/cron/weekly-happenings/route.ts` | 34-172 | Happenings cron handler |
| `app/api/cron/weekly-open-mics/route.ts` | — | Open mics cron handler (parallel structure) |
| `app/(protected)/dashboard/settings/page.tsx` | 229-255 | Event updates toggle (missing digest mention) |
| `app/(protected)/dashboard/admin/page.tsx` | — | Admin hub (needs new Email card) |
| `supabase/migrations/20260101400000_notification_preferences.sql` | — | Preference table schema |
| `supabase/migrations/20251215000001_create_site_settings.sql` | — | Site settings singleton (pattern reference) |
| `supabase/migrations/20260203000000_digest_send_log.sql` | — | Idempotency guard table |
| `web/vercel.json` | 1-12 | Cron schedule configuration |

---

**END OF INVESTIGATION — AWAITING STOP-GATE APPROVAL**

No code changes included. Implementation proceeds only after Sami approves scope and resolves blocking questions (BQ1-BQ2).
