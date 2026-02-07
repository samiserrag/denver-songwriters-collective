# Denver Songwriters Collective — Repo Agent Context

> **All contributors and agents must read this file before making changes. This file supersedes README.md for operational context.**

> **For UX principles and system design rules, see [DSC_UX_PRINCIPLES.md](./docs/DSC_UX_PRINCIPLES.md)** — Reference as "Checked against DSC UX Principles §X" in STOP-GATE reports.

> **For product philosophy, UX rules, and design decisions, see [PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md)**

> **For governance workflow and stop-gate protocol, see [GOVERNANCE.md](./docs/GOVERNANCE.md)**

> **For database security invariants, see [SECURITY.md](./SECURITY.md)** — CI-enforced, non-negotiable.

This file contains **repo-specific operational knowledge** for agents working in this codebase.

---

## Security: Database Invariants (Non-Negotiable)

**All agents must comply with database security rules enforced by CI.**

Four invariants are checked on every push/PR:
1. All public tables must have RLS enabled
2. SECURITY DEFINER functions must not be callable by anon/public (unless allowlisted)
3. Postgres-owned views must use `security_invoker=true` (unless allowlisted)
4. No TRUNCATE/TRIGGER/REFERENCES privileges for anon/authenticated

**Do NOT bypass CI by adding allowlist entries.** Fix the root cause instead:
- Missing RLS → Add `ENABLE ROW LEVEL SECURITY` to migration
- SECURITY DEFINER → Change to SECURITY INVOKER or move to API route
- Postgres-owned view → Add `WITH (security_invoker = true)`
- Dangerous privileges → Use specific grants (SELECT/INSERT/UPDATE/DELETE)

Allowlisting requires documented justification and explicit approval from Sami.

See: [SECURITY.md](./SECURITY.md) and `web/scripts/security/README.md`

---

## Governance: Stop-Gate Workflow (Required)

All non-trivial changes must follow the stop-gate protocol. See [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) for full details.

### Quick Reference

1. **Step A: Investigate** — Repo agent gathers evidence (file paths, line ranges, migrations)
2. **Step B: Critique** — Repo agent documents risks, coupling, rollback plan
3. **Step C: Wait** — Repo agent STOPS. Only after Sami approves does execution begin.

### Subordinate Architect Review Mode

When Codex (senior architect) and Opus (junior architect + executor) collaborate:
- Opus must actively critique plans, not just execute
- Required outputs: pre-execution critique (assumptions, ≥3 risks, ≥2 deltas), in-flight alerts, post-execution regression review
- Dissent is required — default agreement without evidence is a governance violation
- No commits/push, no unrelated refactors, no architecture changes without approval
- See [GOVERNANCE.md §Subordinate Architect Review Mode](./docs/GOVERNANCE.md) for full protocol

### Single-Writer Collaboration Protocol

When Codex and Opus are paired on one tract:
- Opus is the sole writer (edits/stage/commit/push) during active execution cycles
- Codex is read-only (investigation, critique, approve/hold decisions)
- Each cycle is SHA-locked (report branch + HEAD SHA at start, new SHA at end)
- Do not run parallel implementation branches for the same tract
- Any unexpected branch/SHA drift requires immediate STOP + re-sync
- See [GOVERNANCE.md §Single-Writer Collaboration Protocol](./docs/GOVERNANCE.md) for canonical rules

### Definition of Done (PR Checklist)

Before any PR merges:

- [ ] Investigation document exists (for non-trivial changes)
- [ ] Stop-gate approval received from Sami
- [ ] Contract updates included (if behavior changed)
- [ ] Tests added/updated (regression coverage)
- [ ] Lint passes (0 errors, 0 warnings)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Smoke checklist updated (if new subsystem)
- [ ] CLAUDE.md "Recent Changes" updated
- [ ] No unresolved UNKNOWNs for core invariants

### Investigation-Only PRs

PRs containing only documentation (e.g., `docs/investigation/*.md`) are allowed without full execution approval, but must not include code, migration, or config changes.

### Email Systems Philosophy

Email systems in DSC prioritize community value over marketing optimization. The weekly digest is community infrastructure — it connects songwriters with stages, sessions, and each other. Dark patterns, forced retention, deceptive unsubscribe flows, or guilt-based copy are **not permitted**. See `docs/gtm/weekly-personalized-digest-north-star.md` §3.5 for the full email philosophy.

---

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

**Live Site:** https://denversongwriterscollective.org
**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), Vercel

---

## Vercel API Access (IMPORTANT)

**The repo agent has direct access to Vercel deployment logs and status via the Vercel REST API.**

### Available Capabilities

| Capability | API Endpoint | Status |
|------------|--------------|--------|
| List deployments | `GET /v6/deployments` | ✅ Working |
| Deployment status | `GET /v13/deployments/{id}` | ✅ Working |
| Build logs | `GET /v3/deployments/{id}/events` | ✅ Working |
| Project info | `GET /v9/projects` | ✅ Working |
| Runtime logs | Axiom CLI (`axiom query`) | ✅ Working (via Axiom) |

### How to Use

The agent can query Vercel directly to debug production issues:

```bash
# Get latest deployment
curl -s "https://api.vercel.com/v6/deployments?limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.deployments[0]'

# Get deployment status
curl -s "https://api.vercel.com/v13/deployments/{deployment_id}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '{readyState, url, createdAt}'

# Get build logs
curl -s "https://api.vercel.com/v3/deployments/{deployment_id}/events" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.[].text'
```

### Token Location

The Vercel API token is available in the conversation context. If the agent needs to debug production issues:
1. Query deployment status to confirm latest deploy
2. Check build logs for compilation errors
3. Test endpoints directly with `curl`
4. Query runtime logs via `axiom query` for function errors, request details, and console output

### Runtime Logs (via Axiom Drain)

Runtime logs (function invocations, errors, console output) are available via Axiom.

**Infrastructure:**
- Vercel Log Drain → Axiom dataset `vercel` (configured in Vercel Dashboard → Project Settings → Log Drains)
- Dataset receives: function invocations, edge requests, build logs, static file requests
- Retention: Axiom free tier (30 days)

**How to Query (CLI-first):**

```bash
# Authenticate (one-time, token stored in ~/.axiom/auth)
axiom auth login

# List available datasets
axiom dataset list

# Recent errors (last 1 hour)
axiom query "['vercel'] | where level == 'error' | sort by _time desc | take 50"

# Specific route errors
axiom query "['vercel'] | where path == '/api/my-events' and status >= 500 | sort by _time desc | take 20"

# Search by request ID (from Vercel dashboard or error reports)
axiom query "['vercel'] | where ['vercel.request_id'] == 'iad1::xxxxx' | sort by _time desc"

# Tail logs in real-time (streaming)
axiom query "['vercel'] | where _time > ago(5m)" --stream

# Function duration analysis
axiom query "['vercel'] | where type == 'function' | summarize avg(duration) by path | sort by avg_duration desc | take 10"
```

**APL (Axiom Processing Language) Quick Reference:**

| Operation | Syntax |
|-----------|--------|
| Filter | `where field == 'value'` |
| Time range | `where _time > ago(1h)` |
| Sort | `sort by _time desc` |
| Limit | `take 50` |
| Aggregate | `summarize count() by path` |
| String match | `where path contains '/api/'` |
| Status codes | `where status >= 400 and status < 500` |

**Security Notes:**
- The Axiom API token is stored in `~/.axiom/auth` after `axiom auth login`
- NEVER commit or display the Axiom token in logs/output
- NEVER include the Axiom ingest endpoint URL in code or docs (it's configured in Vercel Dashboard only)
- Dataset is read-only for debugging; write access is via the drain only

**When to Use:**
1. Production 500 errors — query by path + status
2. Silent failures — search for specific request IDs
3. Performance issues — aggregate duration by route
4. User-reported bugs — filter by time window + path

---

## Chrome Browser Integration (for Production Testing)

**The repo agent can control a Chrome browser to test production websites, verify deployments, and debug UI issues.**

### Prerequisites

| Requirement | Minimum Version |
|-------------|-----------------|
| Claude Code CLI | 2.0.73+ |
| Claude in Chrome extension | 1.0.36+ |
| Google Chrome | Latest |
| Claude Plan | Pro, Team, or Enterprise |

### How to Launch

```bash
# Start Claude Code with Chrome integration
claude --chrome

# Or enable within an existing session
/chrome
```

### Available Capabilities

| Capability | Description |
|------------|-------------|
| Navigate pages | Open URLs, click links, use back/forward |
| Click & type | Interact with buttons, forms, inputs |
| Read console | Access browser console logs and errors |
| Take screenshots | Capture current page state |
| Record GIFs | Create recordings of browser interactions |
| Read DOM | Extract text, check for elements, verify content |
| Multi-tab | Work across multiple browser tabs |
| Authenticated sites | Access sites you're logged into (Gmail, Notion, etc.) |

### Common Investigation Patterns

**Verify a deployment is live:**
```
Go to https://denversongwriterscollective.org/events/words-open-mic/display?tv=1
Check if the page contains "SCAN FOR HAPPENING DETAILS"
Report PASS if found, FAIL if not
```

**Test a specific user flow:**
```
1. Go to https://denversongwriterscollective.org/happenings
2. Click on the first event card
3. Find and click the "RSVP" button
4. Report any console errors
```

**Check link generation:**
```
Go to https://denversongwriterscollective.org/events/words-open-mic/lineup
Find the "Open TV Display" button
Click it and report the exact URL it navigates to
Confirm whether the URL includes tv=1 parameter
```

**Debug with console logs:**
```
Open the event detail page and check the console for any errors
Filter for warnings containing "hydration" or "undefined"
```

### When to Use Chrome Integration

| Scenario | Use Chrome? |
|----------|-------------|
| Verify client-rendered content | ✅ Yes (WebFetch only sees initial HTML) |
| Test button/link behavior | ✅ Yes |
| Check authenticated pages | ✅ Yes |
| Debug JavaScript errors | ✅ Yes |
| Verify API responses | ❌ No (use curl) |
| Check static HTML content | ❌ No (use WebFetch) |
| Read server logs | ❌ No (use Axiom) |

### Limitations

- **Chrome only** — Not supported on Brave, Arc, or other browsers
- **No headless mode** — Requires visible browser window
- **Modal blockers** — JS alerts/confirms block commands (dismiss manually)
- **WSL not supported** — Use native macOS/Windows/Linux

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Extension not detected" | Verify extension v1.0.36+, restart Chrome, run `/chrome` → "Reconnect" |
| Commands not working | Check for modal dialogs blocking the page |
| Version too old | Run `claude update` (requires 2.0.73+) |

**Documentation:** https://code.claude.com/docs/en/chrome

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Lint
cd web && npm run lint

# Test
cd web && npm run test -- --run

# Full verification (required before merge)
cd web && npm run lint && npm run test -- --run && npm run build

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy
git add . && git commit -m "your message" && git push
```

---

## Quality Gates (Non-Negotiable)

All must pass before merge:

| Check | Requirement |
|-------|-------------|
| Lint | 0 errors, 0 warnings |
| Tests | All passing |
| Build | Success |

**Current Status (GTM-3):** Lint warnings = 0. All tests passing (3650). Intentional `<img>` uses (ReactCrop, blob URLs, markdown/user uploads) have documented eslint suppressions.

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Supabase server client | `web/src/lib/supabase/server.ts` |
| Supabase browser client | `web/src/lib/supabase/client.ts` |
| Service role client | `web/src/lib/supabase/serviceRoleClient.ts` |
| Database types | `web/src/lib/supabase/database.types.ts` |
| Admin auth helper | `web/src/lib/auth/adminAuth.ts` |
| Theme presets | `web/src/app/themes/presets.css` |
| Global styles | `web/src/app/globals.css` |
| Next.js config | `next.config.ts` |

### Key Components

| Component | Path |
|-----------|------|
| HappeningCard (unified) | `web/src/components/happenings/HappeningCard.tsx` |
| DateJumpControl | `web/src/components/happenings/DateJumpControl.tsx` |
| DatePillRow | `web/src/components/happenings/DatePillRow.tsx` |
| StickyControls | `web/src/components/happenings/StickyControls.tsx` |
| DateSection | `web/src/components/happenings/DateSection.tsx` |
| BetaBanner | `web/src/components/happenings/BetaBanner.tsx` |
| BackToTop | `web/src/components/happenings/BackToTop.tsx` |
| PosterMedia | `web/src/components/media/PosterMedia.tsx` |
| Header nav | `web/src/components/navigation/header.tsx` |
| Footer | `web/src/components/navigation/footer.tsx` |
| Event form | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` |
| VenueSelector | `web/src/components/ui/VenueSelector.tsx` |
| Next occurrence logic | `web/src/lib/events/nextOccurrence.ts` |
| Recurrence contract | `web/src/lib/events/recurrenceContract.ts` |
| Recurrence canonicalization | `web/src/lib/events/recurrenceCanonicalization.ts` |
| Form date helpers | `web/src/lib/events/formDateHelpers.ts` |
| CommentThread (shared) | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |
| OccurrenceEditor (host) | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` |
| SeriesEditingNotice | `web/src/components/events/SeriesEditingNotice.tsx` |

### Key Pages

| Route | Path |
|-------|------|
| Happenings | `web/src/app/happenings/page.tsx` |
| Open mic detail | `web/src/app/open-mics/[slug]/page.tsx` |
| Event detail | `web/src/app/events/[id]/page.tsx` |
| Dashboard | `web/src/app/(protected)/dashboard/` |
| Admin | `web/src/app/(protected)/dashboard/admin/` |
| Songwriter profile | `web/src/app/songwriters/[id]/page.tsx` |
| Studio profile | `web/src/app/studios/[id]/page.tsx` |
| Host occurrence editor | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/page.tsx` |
| Per-date edit | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` |

### Cron Jobs

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/weekly-open-mics` | `0 3 * * 0` (Sunday 3:00 UTC) | Weekly Open Mics Digest email |
| `/api/cron/weekly-happenings` | `0 3 * * 0` (Sunday 3:00 UTC) | Weekly Happenings Digest email (ALL event types) |

**Cron Configuration:** `web/vercel.json`

**Control Hierarchy (GTM-2):**
1. **Env var kill switch** (emergency only): `ENABLE_WEEKLY_DIGEST=false` / `ENABLE_WEEKLY_HAPPENINGS_DIGEST=false` — blocks sending regardless of DB toggle
2. **DB toggle** (primary): `digest_settings` table — admin-controlled via `/dashboard/admin/email`
3. **Idempotency guard** (automatic): `digest_send_log` unique constraint prevents duplicate sends

**Key Files:**

| File | Purpose |
|------|---------|
| `lib/digest/weeklyOpenMics.ts` | Business logic for fetching open mics and building digest data |
| `lib/digest/weeklyHappenings.ts` | Business logic for fetching ALL happenings and building digest data |
| `lib/digest/digestSendLog.ts` | Idempotency guard: `computeWeekKey()`, `claimDigestSendLock()` |
| `lib/digest/digestSettings.ts` | DB toggle helpers: `isDigestEnabled()`, `getDigestSettings()`, `updateDigestSettings()` |
| `lib/digest/sendDigest.ts` | Shared send function with 3 modes: full, test, dryRun |
| `lib/digest/unsubscribeToken.ts` | HMAC-signed unsubscribe URL generation/validation |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Email template for weekly open mics digest |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Email template for weekly happenings digest (ALL types) |
| `app/api/cron/weekly-open-mics/route.ts` | Cron endpoint handler for open mics digest |
| `app/api/cron/weekly-happenings/route.ts` | Cron endpoint handler for happenings digest |
| `app/api/digest/unsubscribe/route.ts` | One-click HMAC-signed unsubscribe endpoint |
| `app/api/admin/digest/settings/route.ts` | Admin digest toggle API |
| `app/api/admin/digest/send/route.ts` | Admin send (test/full) API |
| `app/api/admin/digest/preview/route.ts` | Admin preview API (dryRun) |
| `app/api/admin/digest/history/route.ts` | Admin send history API |
| `app/(protected)/dashboard/admin/email/page.tsx` | Admin Email Control Panel UI |
| `app/digest/unsubscribed/page.tsx` | Public unsubscribe confirmation page |
| `lib/digest/digestEditorial.ts` | Editorial CRUD helpers: `getEditorial()`, `upsertEditorial()`, `deleteEditorial()`, `resolveEditorial()` |
| `app/api/admin/digest/editorial/route.ts` | Admin editorial API (GET/PUT/DELETE) |
| `app/api/admin/digest/editorial/search-happenings/route.ts` | Search happenings for editorial featured events |
| `app/api/newsletter/route.ts` | Newsletter subscriber signup endpoint |
| `app/api/newsletter/unsubscribe/route.ts` | One-click newsletter unsubscribe (HMAC, no login) |
| `app/newsletter/unsubscribed/page.tsx` | Newsletter unsubscribe confirmation page |
| `lib/featureFlags.ts` | Env var kill switches (emergency only): `isWeeklyDigestEnabled()`, `isWeeklyHappeningsDigestEnabled()` |

**Cron Authentication:**
- Vercel Cron jobs include `authorization: Bearer ${CRON_SECRET}` header automatically
- Cron routes validate this header before processing

**Timezone Notes:**
- Cron schedule `0 3 * * 0` = Sunday 3:00 UTC
- MST (winter): 8:00 PM Saturday Denver time
- MDT (summer): 9:00 PM Saturday Denver time
- Digest covers Sunday through Saturday (7-day window)

---

## Routing Rules

### Canonical Listing Routes (Use These)

- `/happenings`
- `/happenings?type=open_mic`
- `/happenings?type=dsc`

### Forbidden in UI (Redirects Exist)

- `/open-mics` (listing) — **never link to this**
- `/events` (listing) — **never link to this**

### Valid Detail Routes

- `/events/[id]` — Canonical event detail page (supports both UUID and slug)
- `/open-mics/[slug]` — Legacy entrypoint, redirects to `/events/[id]`

---

## Recurrence Invariants (Phase 4.83)

### Required Field Combinations

Ordinal monthly events (`recurrence_rule` IN `1st`, `2nd`, `3rd`, `4th`, `5th`, `last`, `1st/3rd`, `2nd/4th`, etc.) **MUST** have `day_of_week` set. Otherwise `interpretRecurrence()` returns `isConfident=false` and the event is hidden from happenings.

| recurrence_rule | day_of_week Required | Example |
|-----------------|---------------------|---------|
| `weekly`, `biweekly` | Yes | `day_of_week='Monday'` |
| `1st`, `2nd`, `3rd`, `4th`, `5th`, `last` | Yes | `day_of_week='Saturday'` |
| `1st/3rd`, `2nd/4th`, `1st and 3rd`, etc. | Yes | `day_of_week='Thursday'` |
| `monthly` | Yes | `day_of_week='Tuesday'` |
| `custom` | No | Uses `custom_dates` array |
| `NULL` (one-time) | No | Uses `event_date` only |

### Canonicalization Behavior

Server-side canonicalization (`recurrenceCanonicalization.ts`) runs on POST and PATCH:
- If `recurrence_rule` is ordinal monthly AND `day_of_week` is NULL
- Derive `day_of_week` from `event_date` (e.g., `2026-01-24` → `Saturday`)
- This prevents invalid rows from being saved

Defensive fallback (`recurrenceContract.ts` line 426):
- If `day_of_week` is still NULL at render time, derive from `event_date`
- Safety net for legacy data or edge cases

### Data Integrity Audit Query

Run after bulk imports or to verify no invalid rows:

```sql
-- Should return 0 rows (ordinal monthly with missing day_of_week)
SELECT id, title, recurrence_rule, day_of_week, event_date
FROM events
WHERE recurrence_rule IN (
  '1st', '2nd', '3rd', '4th', '5th', 'last',
  '1st/3rd', '2nd/4th', '2nd/3rd',
  '1st and 3rd', '2nd and 4th', '1st and Last',
  'monthly'
)
AND day_of_week IS NULL;
```

### Axiom Production Monitoring

Check for fallback derivation warnings (should be rare/zero after Phase 4.83):

```bash
# Query for recurrence fallback warnings in last 24h
axiom query "['vercel'] | where message contains 'derived day_of_week' or message contains 'fallback' | where _time > ago(24h) | sort by _time desc | take 50"

# Check specific event IDs with recurrence issues
axiom query "['vercel'] | where path contains '/api/my-events' and status >= 400 | where _time > ago(24h) | sort by _time desc | take 20"
```

---

## Confirmation (Verified) Invariants (Phase 4.89)

### Core Rule

An event is **confirmed** if and only if `last_verified_at IS NOT NULL`.

| State | Condition | Display |
|-------|-----------|---------|
| Confirmed | `last_verified_at IS NOT NULL` | Green "Confirmed" badge + "Confirmed: MMM D, YYYY" |
| Unconfirmed | `last_verified_at IS NULL` | Amber "Unconfirmed" badge (no date shown) |
| Cancelled | `status = 'cancelled'` | Red "Cancelled" badge |

### What Confirmation Affects

- **Trust display only** — Shows users the event has been verified
- The "Confirmed" badge and "Confirmed: " date display are both derived from `last_verified_at`

### What Confirmation Does NOT Affect

**INVARIANT: Visibility must NEVER depend on `last_verified_at`**

- `is_published` controls public visibility
- `status` controls lifecycle (active/cancelled)
- Unconfirmed events are still visible on `/happenings` if published

### Auto-Confirmation Paths

| Path | Sets `last_verified_at`? | `verified_by` |
|------|-------------------------|---------------|
| Community create + publish | ✅ YES | NULL (auto) |
| Draft create | ❌ NO | — |
| First publish (PATCH) | ✅ YES | NULL (auto) |
| Republish (PATCH) | ✅ YES | NULL (auto) |
| PublishButton | ✅ YES | NULL (auto) |
| Admin bulk verify | ✅ YES | Admin user ID |
| Admin inline verify | ✅ YES | Admin user ID |
| Import/seed paths | ❌ NO | — |
| Ops Console CSV import | ❌ NO | — |

**Design intent:** Imported/seeded events start unconfirmed by design. They require explicit admin verification.

### Helper Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getPublicVerificationState()` | `lib/events/verification.ts` | Returns `confirmed` / `unconfirmed` / `cancelled` |
| `formatVerifiedDate()` | `lib/events/verification.ts` | Returns "MMM D, YYYY" in America/Denver timezone |
| `shouldShowUnconfirmedBadge()` | `lib/events/verification.ts` | Suppresses badge for DSC TEST events |

---

## Deploy Rules

### Supabase Migrations BEFORE Push

**Project Reality:** This project's remote Supabase database contains many historical migrations applied directly via SQL before the migration history table (`supabase_migrations.schema_migrations`) was consistently used. As a result, `npx supabase db push` may attempt to re-apply already-applied migrations. This is a known, pre-existing state.

**You MUST choose the correct migration mode before applying any migration:**

#### MODE A — `supabase db push` (Only if history is clean)

Use this mode ONLY if `npx supabase migration list` shows that `db push` would apply ONLY the new migration(s) you intend.

```bash
# 1. Check what db push would apply
npx supabase migration list

# 2. If ONLY your new migration is pending:
npx supabase db push

# 3. Verify schema change
cd web && source .env.local && psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

#### MODE B — Direct `psql` (Required when history is not clean)

Use this mode if `supabase migration list` shows many unexpected pending migrations (the common case for this repo).

```bash
# 1. Apply migration directly
cd web && source .env.local
psql "$DATABASE_URL" -f ../supabase/migrations/<YYYYMMDDHHMMSS>_migration_name.sql

# 2. Record in migration history
psql "$DATABASE_URL" -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('<YYYYMMDDHHMMSS>', '<filename>.sql', ARRAY['<summary>']) ON CONFLICT DO NOTHING;"

# 3. Verify schema change
psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

**Rules:**
- If MODE B is used, do NOT run `npx supabase db push`
- If MODE A would apply unexpected migrations, STOP and switch to MODE B
- Always verify the schema change after applying
- Always record applied migrations in `supabase_migrations.schema_migrations`
- Do NOT push to `main` until the migration is confirmed applied on remote

#### Stop-Gate Protocol for Migrations

Before applying any migration:
1. Report: current branch, HEAD commit, new migration filenames, test/build status
2. **WAIT for Sami approval** before executing

After applying:
1. Report: which mode was used, exact migrations applied, verification query results
2. Confirm schema integrity

---

## Build Notes

- Protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"`
- Vercel auto-deploys from `main` branch
- All CSS colors should use theme tokens (no hardcoded hex in components)

---

## Agent Behavior Rules

1. **Follow prompts exactly** — no improvisation unless asked
2. **Report and stop** when instructions complete or blocked
3. **Reality beats reasoning** — verify in browser, not just code
4. **One change = one contract** — no mixed refactors
5. **Update this file** after every push to main
6. **Production debugging** — when investigating production errors, query Axiom runtime logs (`axiom query`) before speculating about root causes

---

## Locked Layout Rules (v2.0)

These layout decisions are **locked** and must not be changed without explicit approval:

### HappeningCard Layout

| Element | Locked Value |
|---------|--------------|
| Card structure | Vertical poster card (not horizontal row) |
| Poster aspect | 3:2 (`aspect-[3/2]`) |
| Surface class | `card-spotlight` |
| Grid layout | 1 col mobile, 2 col md, 3 col lg |
| Poster hover | `scale-[1.02]` zoom |
| Past event opacity | `opacity-70` |
| Font minimum | 14px in discovery views |

### Chip Styling

| Element | Locked Value |
|---------|--------------|
| Base classes | `px-2 py-0.5 text-sm font-medium rounded-full border` |
| Missing details | Warning badge (amber), not underlined link |

### Forbidden Changes

- Do NOT revert to horizontal/list layouts
- Do NOT use `text-xs` for chips (14px minimum)
- Do NOT add social proof ("X going", popularity counts)
- Do NOT use hardcoded colors (must use theme tokens)

---

## Documentation Hierarchy & Reading Order

**Required reading order for agents:**
1. `CLAUDE.md` (this file) — Repo operations
2. `docs/PRODUCT_NORTH_STAR.md` — Philosophy & UX laws
3. `docs/CONTRACTS.md` — Enforceable UI/data contracts
4. `docs/theme-system.md` — Tokens & visual system

| Document | Purpose | Authority |
|----------|---------|-----------|
| `docs/PRODUCT_NORTH_STAR.md` | Philosophy & UX laws | Wins on philosophy |
| `docs/CONTRACTS.md` | Enforceable UI behavior | Wins on testable rules |
| `docs/theme-system.md` | Tokens & surfaces | Wins on styling |
| `CLAUDE.md` | Repo operations | Wins on workflow |

If something conflicts, resolve explicitly—silent drift is not allowed.

---

## Recent Changes

---

### Docs Alignment: Canonical Backlog Reconciliation (February 2026)

**Summary:** Reconciled backlog/plan docs so `docs/BACKLOG.md` remains the single source of truth and the post-GTM active backlog is now a curated index only.

**Delivered:**
- Canonicalized active tract tracking in `docs/BACKLOG.md` with stable IDs and explicit links:
  - `GROWTH-01` (Invite/Referral tract status reality)
  - `UX-06` (P0 side tract: homepage/detail confirmed mismatch)
  - `UX-07`, `UX-08`, `UX-09` (Phase 6 consistency items, now explicitly tracked as DONE)
  - `EMBED-01` (external media embeds as separate tract)
- Rewrote `docs/backlog/post-gtm-3-1-active-backlog.md` as a canonical-reference view (no duplicate source-of-truth statuses).
- Added `docs/backlog/DOCS_ALIGNMENT_RULES.md` to lock canonicalization rules.
- Updated historical Early Contributors notes in `docs/BACKLOG.md` to reflect Phase 7B.1b retirement/redirect behavior.

### Phase 7B.1b: Invite UX Copy + Homepage Link Simplification (February 2026)

**Summary:** Refined invite messaging for clarity and conversion, simplified share URLs to homepage-only, and retired Early Contributors as a user-facing destination.

**Delivered:**
- Invite links now share clean homepage URL (`/`) rather than signup + tracking params.
- Invite email template copy updated to first-person recommendation with salutation and signer.
- Invite page copy rewritten to explain homepage-first journey and join value.
- Removed sitewide Early Contributors mentions and replaced homepage/footer CTAs.
- `/early-contributors` and `/early-contributors/thanks` now redirect to `/`.

### Phase 7B.1: Community Invite / Referral Growth Loop (February 2026)

**Summary:** Implemented share-first member invites with end-to-end referral attribution capture (no platform-sent invite emails).

**Delivered:**
- New logged-in invite hub: `/dashboard/invite` (copy link, mailto, native share).
- Referral contract utilities (`ref`, `via`, `src`) with validation and safe persistence.
- Signup/auth callback/onboarding pipeline now preserves referral params and stores attribution on profile.
- Approved CTA surfaces updated:
  - Header (logged-in)
  - Mobile nav (logged-in)
  - Homepage community sections
  - `/happenings` community CTA block
  - Weekly digest templates (happenings + open mics)
- Contracts and backlog updated for 7B.1 scope and 7B.2 deferral.

**Schema Additions:**
- `profiles.referred_by_profile_id`
- `profiles.referral_via`
- `profiles.referral_source`
- `profiles.referral_captured_at`

### Phase 7A-R: Legacy Media Reconciliation (February 2026)

**Summary:** Completed one-time guarded reconciliation for legacy seeded event cover URLs to align historical rows with canonical `event-images` + `event_images` structure.

**Status:** Complete. No source-code edits required.

**What was executed:**
- Migrated only rows still using seeded signed `open-mic-images/Open Mic Image.jpg` URLs.
- Wrote canonical storage paths: `event-images/{eventId}/legacy-open-mic-seed.jpg`.
- Inserted active `event_images` rows and updated `events.cover_image_url` to canonical public `event-images` URLs.
- Preserved manual replacements by requiring write-time URL match before update.

**Execution metrics:**
- Target rows: `37`
- `db_inserted`: `37`
- `events_updated`: `37`
- Errors: `0`

**Post-verification:**
- `missing_active_links`: `0`
- `missing_seed_signed_open_mic`: `0`
- `covers_using_event_images_public`: `85`

**Docs updated:**
- `docs/investigation/phase7a-legacy-media-reconciliation-stopgate.md` (status + execution addendum)

### Phase 6: Cross-Surface Event Consistency & Mobile UX Cohesion (February 2026)

**Summary:** Resolved all three backlog items from post-GTM-3.1: homepage vs happenings "Tonight" list consistency, mobile event card truncation and metadata loss, and missing cross-surface consistency contracts.

**Status:** Complete. PR #118 merged to main. All quality gates pass (lint 0, tests 3775, build success).

**Problem:** Homepage "Tonight's Happenings" and `/happenings` used divergent pipelines — different status filters, venue joins, override handling, and expansion windows. Mobile cards truncated metadata (venue, cost, time) with `truncate` CSS. No enforceable contracts existed for cross-surface consistency.

**Three Work Packages:**

| WP | Description |
|----|-------------|
| WP1: Pipeline Alignment | Shared constants (`DISCOVERY_STATUS_FILTER`, `DISCOVERY_VENUE_SELECT`), override pipeline with `applyReschedulesToTimeline()`, range-based override fetch, 90-day expansion window |
| WP2: Mobile Card UX | Replaced `truncate` with `flex-wrap`/`break-words` on HappeningCard meta line and SeriesCard venue line; `NA` normalization for missing time/venue/cost |
| WP3: Governance Lock | Cross-surface consistency section in `docs/CONTRACTS.md`; Single-Writer Collaboration Protocol in `docs/GOVERNANCE.md` v1.3 |

**Key Fix (Reschedule Parity):** Homepage previously used `.eq("date_key", today)` for override fetch and `startKey: today, endKey: today` for expansion. This missed occurrences rescheduled TO today from future dates. Changed to range-based `.gte/.lte` with 90-day forward window matching `/happenings` parity, enabling `applyReschedulesToTimeline()` to relocate rescheduled occurrences correctly.

**Files Added (2):**

| File | Purpose |
|------|---------|
| `lib/happenings/tonightContract.ts` | Shared constants: `DISCOVERY_STATUS_FILTER`, `DISCOVERY_VENUE_SELECT`, `DISCOVERY_VENUE_SELECT_WITH_COORDS` |
| `__tests__/phase6-cross-surface-consistency.test.ts` | 50 tests across 11 sections (A-K) |

**Files Modified (8):**

| File | Change |
|------|--------|
| `app/page.tsx` | Shared constants, `applyReschedulesToTimeline()`, range-based override fetch, 90-day expansion window |
| `app/happenings/page.tsx` | Shared constants from `tonightContract.ts` (replacing inline values) |
| `components/happenings/HappeningCard.tsx` | `flex-wrap`/`break-words` on meta line, `NA` normalization for missing fields |
| `components/happenings/SeriesCard.tsx` | `break-words` on venue line |
| `lib/happenings/index.ts` | Barrel export for tonightContract |
| `docs/CONTRACTS.md` | Cross-surface consistency section (§ Cross-Surface) |
| `docs/GOVERNANCE.md` | v1.3 with Single-Writer Collaboration Protocol |
| `CLAUDE.md` | Single-Writer quick reference, Phase 6 entry |

**Test Coverage:** 50 new tests (3775 total) covering:
- Shared constants parity between homepage and happenings (Section A)
- Override pipeline with `applyReschedulesToTimeline` (Section B)
- Status filter alignment (Section C)
- Venue join parity (Section D)
- Mobile meta line wrapping (Section E)
- `NA` normalization for missing Decision Facts (Section F)
- SeriesCard venue wrapping (Section G)
- Behavioral `applyReschedulesToTimeline` tests (Section H)
- Range-based override fetch and forward expansion window (Section I)
- CONTRACTS.md governance (Section J)
- Reschedule-from-future-to-today behavioral proof (Section K)

**Push:** `main` merged via PR #118 (`5faa664`).

### Post-GTM-3.1 Active Backlog Documentation (February 2026)

**Summary:** Created new backlog document to capture high-priority product and UX items discussed but not yet documented. Covers non-email, non-GTM-3.1 items only.

**New file:** `docs/backlog/post-gtm-3-1-active-backlog.md`

**Backlog items documented:**
1. Homepage vs Happenings "Tonight" list consistency
2. Mobile event card truncation and metadata loss
3. Cross-surface consistency rules (missing explicit contracts)

**Purpose:** Establish durable, non-conflicting record of next priorities without reopening closed GTM-3.1 tracts.

### GTM-3.1 Documentation Closeout (February 2026)

**Summary:** Closed out all GTM-3.1 documentation tract. Updated status headers in 5 STOP-GATE docs to CLOSED/COMPLETED. Verified Known UX Follow-ups (A, B, C) were already resolved in code. Updated Deferred Backlog to reflect accurate P0/P1/P2 items.

**Documentation updated:**
- `docs/investigation/phase5-18-gtm-3-1-email-featured-section-and-formatting-stopgate.md` → CLOSED
- `docs/investigation/phase5-17-gtm-3-1-editorial-url-only-stopgate.md` → CLOSED
- `docs/investigation/phase5-16-gtm-3-1-editorial-refs-stopgate.md` → CLOSED (Superseded)
- `docs/gtm/gtm-3-implementation-plan.md` → COMPLETED
- `docs/gtm/gtm-3-editorial-and-newsletter-unsubscribe-investigation.md` → COMPLETED with full Closeout section

**Backlog updates:**
- P0: None currently identified
- P1: Removed resolved "`as any` casts" item; kept API rate limiting and empty alt text (9 occurrences)
- Known UX Follow-ups A/B/C: All resolved and marked with strikethrough

### Weekly Digest Listing Details (February 2026)

**Summary:** Event listings now show city + zip, signup time when present, and venue links to DSC venue pages.

**Changes:**
- Added `signup_time` and venue `slug`/`zip` to weekly digest data fetch.
- Listing meta line now includes city/zip and signup time, and links venue names to `/venues/...`.
- Text version includes venue URL and signup time.
- Updated digest tests to cover venue link, city/zip, and signup time.

**Push:** `main` pushed to origin (`0ff4bea`).
**Quality gates:**
- `npm --prefix web run lint` passed.
- `npm --prefix web test -- --run` passed (`3725/3725`).
- `npm --prefix web run build` timed out in this environment (stuck at `Creating an optimized production build ...`).

### Phase5-18 Closeout Doc Update (February 2026)

**Summary:** Documented closeout for the GTM-3.1 weekly digest featured-section tract.

**Changes:**
- Added closeout section to the Phase5-18 stop-gate doc with delivered fixes, commits, and gate results.

**Push:** `main` pushed to origin (`6e1b337`).

### GTM-3.1 Blog Card Rendering (February 2026)

**Summary:** Featured blog now renders as a baseball card even without a cover image, using blog cover data when present.

**Changes:**
- Blog resolver now selects `cover_image_url` and exposes it as `coverUrl`.
- Blog featured card passes `coverUrl`/`coverAlt` into `renderEmailBaseballCard`.
- Added regression test to ensure blog renders with baseball-card wrapper even when cover is missing.
- Appended stop-gate addendum documenting blog card investigation.

**Push:** `main` pushed to origin (`578bc71`).
**Quality gates:**
- `npm --prefix web run lint` passed.
- `npm --prefix web test -- --run` passed (`3724/3724`).
- `npm --prefix web run build` timed out in this environment (stuck at `Creating an optimized production build ...`).

### GTM-3.1 Gallery Resolver Column Fix (February 2026)

**Summary:** Fixed false gallery unresolved diagnostics caused by querying a non-existent gallery column.

**Changes:**
- `resolveEditorial*` gallery lookups now select `gallery_albums.name` (not `title`) and map card title from `name`.
- Added regression coverage to ensure gallery URL refs resolve against published albums using the `name` field.

**Push:** `main` pushed to origin (`15658c1`).
**Quality gates:**
- `npm --prefix web run lint` passed.
- `npm --prefix web test -- --run src/__tests__/editorial-url-resolver.test.ts` passed.

### GTM-3.1 Weekly Digest Featured Ordering + Intro Formatting (February 2026)

**Summary:** Weekly happenings email now renders a top featured block in deterministic order, preserves intro note formatting, and keeps preview/test-send output aligned.

**Changes:**
- Weekly digest template now renders featured cards at the top in order: member, first featured event, blog, gallery.
- Remaining featured events render in a separate featured-happenings block; member/blog/gallery are no longer duplicated later.
- Intro note HTML now preserves paragraphs and line breaks safely (escape first, then paragraph + `<br>` formatting).
- Added bold linked happenings prompt above and below the event list; text version mirrors the same guidance.
- Preview and test send now inject a safe gallery placeholder (`Gallery unavailable (unpublished)`) when an admin-authored gallery ref is unresolved due to publish constraints.
- Updated regression tests for featured ordering, no-duplication behavior, intro formatting, and template contract checks.

**Push:** `main` pushed to origin (`975bc10`).
**Quality gates:**
- `npm --prefix web run lint` passed.
- `npm --prefix web test -- --run` passed (`3722/3722`).
- `npm --prefix web run build` does not complete in this environment (hangs at `Creating an optimized production build ...` with no further output).

### Admin Test Send Editorial WeekKey Fix (February 2026)

**Summary:** Test sends now use the UI-selected weekKey for weekly_happenings, and editorial saves overwrite cleared fields.

**Changes:**
- Admin send payload now includes `weekKey` for weekly_happenings; send route prefers provided weekKey and logs it.
- Send route returns `previewHtml`/`previewSubject` in test mode for regression checks.
- Editorial save now posts all fields every time; server normalizes blank strings/empty arrays to `NULL` to clear old values.
- Added regression test for `/api/admin/digest/send` to assert intro note + spotlight link render for provided weekKey.

**Push:** `main` pushed to origin (`68d7e2f`).
**Build:** `npm --prefix web run build` started; no completion output yet in this environment.

### GTM-3.1 Editorial URL-Only Execution (February 2026)

**Summary:** Editorial inputs now accept URLs only (no slugs/UUIDs), with strict normalization/validation, URL-first resolver, and preview diagnostics for unresolved refs.

**Changes:**
- Admin email UI now uses URL-only inputs and sends only `*_ref`/`featured_happenings_refs` payload keys.
- API validation rejects any legacy `*_id`/slug keys with 400 + field guidance.
- Resolver parses canonical URLs, resolves by slug, and returns unresolved diagnostics without crashing preview/send.
- Added URL normalization + resolver tests and updated GTM editorial contract tests.

**Push:** `main` pushed to origin (`b9a3367`, plus doc update `cf4fbc3`).
**Build:** Local `npm --prefix web run build` started; no completion output yet in this environment.

### Admin Email Editorial Payload Keys Test (February 2026)

**Summary:** Added a regression test to ensure admin editorial saves only send `*_ref` keys (no legacy `*_id`/`*_slug` payload fields).

**Push:** `main` pushed to origin (`a067fb9`).
**Build:** `npm --prefix web run build` still running without completion output in this environment.

### Host Requests Admin Visibility Fix (February 2026)

**Summary:** Admin host requests no longer silently show 0 when data exists.

**Changes:**
- Added FK `host_requests.user_id → profiles.id` to support PostgREST embed for admin host requests.
- Admin host-requests page and API route now surface query errors instead of returning empty data.
- Documented that RLS admin checks use `auth.jwt().app_metadata.role` (not `profiles.role`).

### GTM-3.1 Editorial Ref Inputs Fix (February 2026)

**Summary:** Prevent 500s when admins paste slugs/URLs into editorial fields by adding ref columns, validation, and resolver updates.

**Changes:**
- Added migration `20260205181500_digest_editorial_ref_columns.sql` with text ref columns for slugs/URLs.
- Added `buildEditorialUpsertData` validator to return 400 with field+guidance for invalid UUID/ref inputs.
- Resolver now prefers ref columns (slug/URL) with UUID fallback; featured happenings accept slug refs and include venue URLs.
- Featured happenings + spotlights render via baseball cards; venue spotlight title links DSC, CTA links external when available; featured venue name links external (fallback DSC).
- Added payload validation tests and updated editorial contract tests.

### GTM-3: Editorial Layer + Newsletter Unsubscribe (February 2026) — RESOLVED

**Goal:** Add an editorial layer to the weekly happenings digest (admin-curated content: featured events, member spotlights, venue spotlights, blog features, gallery features, intro notes, subject overrides) and implement a one-click newsletter unsubscribe flow for non-member subscribers.

**Status:** Deployed to main. All quality gates pass (lint 0 errors, tests 3698, build success). Migration applied (MODE B). Email automation toggles remain disabled; kill switches OFF.

**Phase:** GTM-3 (includes GTM-3.1 polish)

**Two Parts:**

| Part | Description |
|------|-------------|
| A: Newsletter Unsubscribe | HMAC-signed one-click unsubscribe for newsletter subscribers (non-members) |
| B: Editorial Layer | Admin-curated content sections in weekly happenings digest |

**Delta 1 (Critical Design Decision):** Editorial resolution happens AFTER lock acquisition in both cron and admin full-send paths. This prevents wasted DB queries for editorial references on retries where the lock was already claimed.

**Database Migration:**

| Migration | Purpose | Status |
|-----------|---------|--------|
| `20260205000000_digest_editorial.sql` | Create `digest_editorial` table with RLS, unique constraint on `(week_key, digest_type)`, auto-updated_at trigger | Applied (MODE B) |

**Schema (`digest_editorial`):**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `week_key` | TEXT | ISO week (e.g., `2026-W06`) |
| `digest_type` | TEXT | `'weekly_happenings'` |
| `subject_override` | TEXT | Custom email subject line |
| `intro_note` | TEXT | Custom opening paragraph |
| `featured_happening_ids` | UUID[] | Featured event IDs |
| `member_spotlight_id` | UUID | Featured member profile |
| `venue_spotlight_id` | UUID | Featured venue |
| `blog_feature_slug` | TEXT | Featured blog post slug |
| `gallery_feature_slug` | TEXT | Featured gallery album slug |
| `created_at` | TIMESTAMPTZ | Row creation |
| `updated_at` | TIMESTAMPTZ | Last edit |

RLS enabled with no policies = service role only access.

**Part A: Newsletter Unsubscribe**

| Step | Implementation |
|------|----------------|
| A1 | Extended `unsubscribeToken.ts` with `generateNewsletterUnsubscribeToken()` and `validateNewsletterUnsubscribeToken()` |
| A2 | Created `app/api/newsletter/unsubscribe/route.ts` with HMAC validation, sets `is_active=false` |
| A3 | Created `app/newsletter/unsubscribed/page.tsx` with warm community copy + re-subscribe CTA |

**Newsletter Token Security:**
- Uses separate HMAC message family (`${email}:unsubscribe_newsletter`) to prevent cross-family token attacks
- Digest tokens use `${userId}:unsubscribe_digest` (different family)
- Constant-time comparison via `timingSafeEqual`
- No expiry (permanent unsubscribe links)
- No login required

**Part B: Editorial Layer**

| Step | Implementation |
|------|----------------|
| B1 | Migration: `digest_editorial` table with unique `(week_key, digest_type)` |
| B2 | CRUD helpers in `digestEditorial.ts`: get, upsert, delete, resolveEditorial |
| B3 | Admin API routes: GET/PUT/DELETE editorial, search happenings endpoint |
| B4 | Email template extended with 7 editorial sections (all nullable/graceful) |
| B5 | Cron handler resolves editorial AFTER lock (Delta 1) |
| B6 | Preview API includes editorial for specified week_key |
| B7 | Send API includes editorial (test: immediate resolve, full: after lock) |
| B8 | Admin UI editorial editor with week navigation, save/clear, live search |

**Editorial Sections in Email Template:**

| Section | Renders When |
|---------|-------------|
| Subject override | `subject_override` is set |
| Intro note | `intro_note` is set |
| Featured happenings | `featured_happening_ids` resolves to valid events |
| Member spotlight | `member_spotlight_id` resolves to valid profile |
| Venue spotlight | `venue_spotlight_id` resolves to valid venue |
| Blog feature | `blog_feature_slug` resolves to valid published post |
| Gallery feature | `gallery_feature_slug` resolves to valid published album |

**`resolveEditorial()` Function:**
- Takes raw editorial row + Supabase client
- Resolves all reference IDs/slugs to full data objects
- Returns `ResolvedEditorial` with resolved data ready for template
- Invalid references silently excluded (no error, just omitted)

**Files Added (8):**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260205000000_digest_editorial.sql` | Migration: digest_editorial table with RLS |
| `lib/digest/digestEditorial.ts` | CRUD helpers + `resolveEditorial()` reference resolver |
| `app/api/admin/digest/editorial/route.ts` | Admin editorial API (GET/PUT/DELETE) |
| `app/api/admin/digest/editorial/search-happenings/route.ts` | Search published events by title for editorial picker |
| `app/api/newsletter/unsubscribe/route.ts` | One-click newsletter unsubscribe endpoint |
| `app/newsletter/unsubscribed/page.tsx` | Newsletter unsubscribe confirmation page |
| `app/api/newsletter/route.ts` | Newsletter subscriber signup endpoint |
| `__tests__/gtm-3-editorial-and-newsletter-unsubscribe.test.ts` | 130 tests for GTM-3 |

**Files Modified (6):**

| File | Change |
|------|--------|
| `lib/digest/unsubscribeToken.ts` | Added newsletter token functions (separate HMAC family) |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Added 7 editorial sections with graceful rendering |
| `app/api/cron/weekly-happenings/route.ts` | Editorial resolution AFTER lock (Delta 1) |
| `app/api/admin/digest/preview/route.ts` | Resolves editorial for preview week_key |
| `app/api/admin/digest/send/route.ts` | Resolves editorial for test (immediate) and full (after lock) sends |
| `app/(protected)/dashboard/admin/email/page.tsx` | Editorial editor UI with week nav, save/clear, search happenings |

**Admin Editorial Editor UI (`/dashboard/admin/email`):**

| Feature | Behavior |
|---------|----------|
| Week navigation | Previous/next week buttons with current week key display |
| Subject override | Text input for custom email subject |
| Intro note | Textarea for custom opening paragraph |
| Featured happenings | Search-and-select with live autocomplete |
| Member spotlight | Profile ID input |
| Venue spotlight | Venue ID input |
| Blog feature | Blog post slug input |
| Gallery feature | Gallery album slug input |
| Save | Upserts editorial for current week |
| Clear | Deletes editorial for current week |

**Cron Handler Flow (Updated for GTM-3):**
```
Kill switch check -> Auth check -> DB toggle check -> Create client -> Compute week key ->
Fetch happenings/recipients -> Claim lock -> (if locked: skip) ->
Resolve editorial (Delta 1) -> Send emails with editorial
```

**Non-Changes (Intentional):**
- No changes to weekly_open_mics digest (editorial is happenings-only)
- No changes to idempotency guard
- Editorial failure is non-fatal (digest sends without editorial on error)
- No UI changes to existing admin send/preview/toggle controls

**Rollback Plan:**
- Editorial is entirely optional; digest renders normally without it
- Delete editorial row to clear for a given week
- Migration is additive-only (no ALTER/DROP)
- Newsletter unsubscribe can be disabled by removing the route

**Test Coverage:** 178 tests (3698 total) covering:
- Newsletter HMAC token generation/validation
- Cross-family token prevention
- Email normalization
- Editorial CRUD contracts
- `resolveEditorial` reference resolution
- Email template editorial rendering (all 7 sections)
- API contracts (search, editorial, unsubscribe)
- Newsletter unsubscribe confirmation page
- Cron/preview/send editorial integration ordering (Delta 1)
- GTM-3.1: Cron schedule, baseball card renderer, slug normalization, resolver UUID/slug support

**GTM-3.1 Additions (February 2026):**

| Enhancement | Implementation |
|-------------|----------------|
| Cron schedule update | Changed from `0 3 * * 0` (Sunday 3:00 UTC) to `0 23 * * 0` (Sunday 23:00 UTC = 4 PM MST / 5 PM MDT) |
| Baseball card renderer | `renderEmailBaseballCard()` in `lib/email/render.ts` - table-based, inline-styled, email-safe card component |
| Slug/URL normalization | `normalizeEditorialSlug()` extracts slugs from full URLs (e.g., `https://example.org/songwriters/sami-serrag` → `sami-serrag`) |
| UUID/slug resolution | `resolveEditorial()` now supports both UUID and slug lookups for member/venue spotlights |
| Admin UI accepts URLs | Editorial form inputs normalize URLs to slugs automatically via API |

**GTM-3.1 URL Pattern Support:**
- `/songwriters/{slug}` → extracts slug
- `/venues/{slug}` → extracts slug
- `/events/{slug}` → extracts slug
- `/blog/{slug}` → extracts slug
- `/gallery/{slug}` → extracts slug
- Full URLs with domain → extracts slug
- Bare slugs/UUIDs → passed through unchanged

**GTM-3.1 Files Modified:**

| File | Change |
|------|--------|
| `vercel.json` | Updated cron schedule to `0 23 * * 0` |
| `app/api/cron/weekly-happenings/route.ts` | Updated DST documentation in header comment |
| `lib/email/render.ts` | Added `renderEmailBaseballCard()` helper |
| `lib/digest/digestEditorial.ts` | Added `isUUID()`, `normalizeEditorialSlug()`, UUID/slug resolution |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Uses baseball card renderer for all editorial sections |
| `app/api/admin/digest/editorial/route.ts` | Normalizes slug inputs before upsert |
| `__tests__/gtm-3-editorial-and-newsletter-unsubscribe.test.ts` | 48 new tests for GTM-3.1 |

---

### GTM-2: Admin Email Control Panel + Friendly Opt-Out (February 2026) — RESOLVED

**Goal:** Give admins full control over weekly digest automation and provide recipients with a one-click, no-login, HMAC-signed unsubscribe flow with warm community-forward copy.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3520, build success). Migration applied. `UNSUBSCRIBE_SECRET` set in Vercel.

**Phase:** GTM-2

**6 Guiding Principles (Non-Negotiable):**
1. Auto opt-in is permanent policy (correct default for free community digest)
2. One-click, no-login opt-out required in every digest email
3. Easy opt-back-in (link to settings in unsubscribe confirmation)
4. Warm, human, community-forward tone
5. Encourage reconsideration, never block or shame
6. Idempotency must remain intact

**Control Hierarchy (Precedence):**
1. Env var kill switch OFF → blocks everything (emergency only)
2. DB `digest_settings` toggle → primary admin control
3. Idempotency guard → automatic duplicate prevention

**Database Migration:**

| Migration | Purpose | Status |
|-----------|---------|--------|
| `20260204000000_digest_settings.sql` | Create `digest_settings` table for admin automation toggles | Applied (MODE B) |

**Schema (`digest_settings`):**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `digest_type` | TEXT UNIQUE | `'weekly_open_mics'` or `'weekly_happenings'` |
| `is_enabled` | BOOLEAN | Admin toggle (default false, seeds both as disabled) |
| `updated_at` | TIMESTAMPTZ | Last toggle change |
| `updated_by` | UUID | Admin who toggled |

RLS enabled with no policies = service role only access.

**New Env Var Required:**

| Variable | Purpose |
|----------|---------|
| `UNSUBSCRIBE_SECRET` | HMAC-SHA256 key for signing unsubscribe URLs (no expiry, no auth needed) |

**Files Added (11):**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260204000000_digest_settings.sql` | Migration: digest_settings table with RLS, seeds both types as disabled |
| `lib/digest/digestSettings.ts` | CRUD helpers: `getDigestSettings()`, `getAllDigestSettings()`, `updateDigestSettings()`, `isDigestEnabled()` |
| `lib/digest/unsubscribeToken.ts` | HMAC-SHA256 token generation/validation: `generateUnsubscribeToken()`, `validateUnsubscribeToken()`, `buildUnsubscribeUrl()` |
| `lib/digest/sendDigest.ts` | Shared send function with 3 modes: `full` (all recipients, 100ms delay), `test` (single recipient, bypasses lock, [TEST] prefix), `dryRun` (returns HTML, no send) |
| `app/api/digest/unsubscribe/route.ts` | One-click unsubscribe GET endpoint: validates HMAC, sets `email_event_updates=false`, redirects to confirmation |
| `app/digest/unsubscribed/page.tsx` | Public confirmation page with warm copy + re-subscribe CTA to `/dashboard/settings` |
| `app/api/admin/digest/settings/route.ts` | GET/PATCH digest settings (admin-only) |
| `app/api/admin/digest/preview/route.ts` | GET `?type=` preview via dryRun mode (admin-only) |
| `app/api/admin/digest/send/route.ts` | POST `{ digestType, mode }` for test/full sends (admin-only) |
| `app/api/admin/digest/history/route.ts` | GET send history from `digest_send_log` (admin-only) |
| `app/(protected)/dashboard/admin/email/page.tsx` | Admin Email Control Panel: toggles, send buttons, preview, history table |

**Files Modified (10):**

| File | Change |
|------|--------|
| `lib/email/templates/weeklyHappeningsDigest.ts` | Added `userId` param, HMAC unsubscribe URL, warm community footer |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Same changes as happenings template |
| `app/api/cron/weekly-happenings/route.ts` | Added DB toggle check via `isDigestEnabled()`, replaced inline loop with `sendDigestEmails()`, passes `userId` to template |
| `app/api/cron/weekly-open-mics/route.ts` | Same structural changes as happenings route |
| `app/(protected)/dashboard/admin/page.tsx` | Added "Email & Digests" link in admin hub Operations section |
| `app/(protected)/dashboard/settings/page.tsx` | Updated `email_event_updates` toggle description to mention weekly digest |
| `lib/featureFlags.ts` | Updated comments: env vars are emergency-only (DB toggle is primary) |
| `__tests__/digest-send-log.test.ts` | Updated 2 tests to search for `sendDigestEmails(` (replaced inline loop) |
| `__tests__/weekly-happenings-digest.test.ts` | Updated unsubscribe assertion to match warm community copy |
| `__tests__/weekly-open-mics-digest.test.ts` | Same assertion update as happenings test |

**Admin Email Control Panel (`/dashboard/admin/email`):**

| Feature | Behavior |
|---------|----------|
| Automation toggle | DB-backed on/off per digest type (primary control) |
| Send weekly happenings now | Full send to all opted-in recipients (respects idempotency) |
| Send test to me | Sends to admin only with [TEST] prefix (bypasses idempotency) |
| Preview | Renders HTML without sending (dryRun mode) |
| Last sent status | Shows most recent send timestamp and recipient count |
| Send history | Table of recent sends from `digest_send_log` |

**Unsubscribe Flow:**

| Step | Implementation |
|------|----------------|
| 1. Email footer link | HMAC-signed URL: `/api/digest/unsubscribe?uid={userId}&sig={hmac}` |
| 2. One-click action | GET request validates HMAC, sets `email_event_updates=false` via service role |
| 3. Confirmation page | Warm copy: "We'll miss you..." + re-subscribe CTA to `/dashboard/settings` |
| 4. Idempotent | Multiple clicks = same result, no errors |

**Unsubscribe URL Security:**
- HMAC-SHA256 signature = `HMAC(UNSUBSCRIBE_SECRET, "${userId}:unsubscribe_digest")`
- No expiry (permanent unsubscribe links)
- No login required (works in any browser)
- Constant-time comparison via `timingSafeEqual` (prevents timing attacks)

**Cron Handler Changes:**
```
Kill switch check → Auth check → DB toggle check → Create client → Compute week key → Fetch data → Fetch recipients → Claim lock → (if locked) skip → sendDigestEmails()
```

**Non-Changes (Intentional):**
- No newsletter subscriber changes
- No separate digest preference column (`email_event_updates` gates both digest AND transactional)
- No personalization (deferred to GTM-3)
- No analytics/tracking/A/B tests
- Idempotency guard unchanged
- Auto opt-in model unchanged (`?? true` default)

**Rollback Plan:**
- Set env var kill switch (`ENABLE_WEEKLY_HAPPENINGS_DIGEST=false`) for immediate emergency disable
- Set DB toggle to disabled for normal disable
- Migration is additive-only (no ALTER/DROP) — table can remain if unused
- Remove HMAC footer from templates to revert to old unsubscribe copy

**Manual Test Checklist (Post-Deploy):**
- [ ] Admin panel loads at `/dashboard/admin/email`
- [ ] Toggle enables/disables each digest type
- [ ] "Send test to me" sends email with `[TEST]` prefix
- [ ] "Send to all" respects idempotency (second click = skipped)
- [ ] Preview renders HTML without sending
- [ ] Send history table populates after send
- [ ] Unsubscribe link in email works (one-click, no login)
- [ ] Confirmation page shows warm copy + re-subscribe CTA
- [ ] Cron respects DB toggle OFF (does not send)
- [ ] Cron respects env var kill switch OFF (does not send)

---

### Digest Email Idempotency Guard (February 2026) — RESOLVED

**Goal:** Prevent duplicate weekly digest emails caused by Vercel cron retries or concurrent invocations.

**Status:** Complete. All quality gates pass.

**Problem:** Users received up to 4 copies of the weekly digest email on Sunday mornings. Root cause: both `ENABLE_WEEKLY_DIGEST` and `ENABLE_WEEKLY_HAPPENINGS_DIGEST` kill switches were enabled simultaneously (2 different digests × same recipients = 2x), combined with potential Vercel cron retries on 5xx errors (up to 2x multiplier), and no idempotency mechanism to prevent re-sends.

**Solution:** Database-backed idempotency guard using a unique constraint as an atomic lock.

**How It Works:**
1. Cron handler computes a deterministic `week_key` (e.g., `2026-W05`) using ISO week in America/Denver timezone
2. Before sending, attempts INSERT into `digest_send_log` with `(digest_type, week_key)`
3. If INSERT succeeds → first run, proceed with sending
4. If INSERT fails (unique constraint violation, code `23505`) → already sent this week, return `{ skipped: true }`
5. Fails closed: unexpected DB errors block sending and return 500 (prevents duplicates under transient failures)

**Week Key Definition:**
- Format: `YYYY-Www` (e.g., `2026-W05`)
- Timezone: America/Denver (handles MST/MDT automatically)
- Deterministic: same cron invocation always produces same key regardless of retries
- Sunday 3:00 UTC = Saturday 8-9 PM Denver → both map to same ISO week

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260203000000_digest_send_log.sql` | Create `digest_send_log` table with unique constraint on `(digest_type, week_key)` |

**Schema:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `digest_type` | TEXT | `'weekly_open_mics'` or `'weekly_happenings'` |
| `week_key` | TEXT | ISO week in Denver timezone (e.g., `2026-W05`) |
| `sent_at` | TIMESTAMPTZ | When the digest was sent |
| `recipient_count` | INTEGER | Number of recipients at time of send |

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260203000000_digest_send_log.sql` | Migration with table, unique constraint, RLS enabled |
| `lib/digest/digestSendLog.ts` | `computeWeekKey()`, `claimDigestSendLock()`, `hasAlreadySentDigest()` |
| `__tests__/digest-send-log.test.ts` | Tests for idempotency behavior |

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/cron/weekly-open-mics/route.ts` | Added idempotency guard after auth check, before email loop |
| `app/api/cron/weekly-happenings/route.ts` | Added idempotency guard after auth check, before email loop |

**Guard Placement (both routes):**
```
Kill switch check → Auth check → Create supabase client → Compute week key → Fetch data → Fetch recipients → Claim lock → (if locked) skip → Send emails
```

**Non-Changes (Intentional):**
- No UX changes
- No opt-in/opt-out behavior changes
- No cron consolidation
- No vercel.json changes
- Additive-only migration (no ALTER/DROP)

**Rollback Plan:**
- Remove idempotency guard imports and logic from both cron routes
- Table can remain (no harm, just unused)

---

### Migration CI Replay Fixes (February 2026) — RESOLVED

**Goal:** Fix all migration failures when CI runs `supabase start` (fresh database replay).

**Status:** Complete. PR #117 merged to main. All CI workflows passing.

**Problem:** The Supabase RLS Tripwire CI workflow runs `supabase start` which applies all migrations from scratch on a fresh database. Multiple migrations were failing due to missing columns, NOT NULL constraint violations, syntax errors, enum transaction issues, and schema mismatches between production (where migrations were manually applied) and fresh databases.

**Errors Fixed:**

| Error | Root Cause | Fix |
|-------|------------|-----|
| Syntax error at "$" (SQLSTATE 42601) | Dollar quoting used backtick instead of `$` | Fixed to proper `$` characters |
| Unsafe use of new enum value (SQLSTATE 55P04) | PostgreSQL cannot use a newly added enum value in same transaction | Split into two migrations |
| Relation does not exist (SQLSTATE 42P01) | `DROP POLICY IF EXISTS` fails if table doesn't exist | Moved policy cleanup after CREATE TABLE |
| FK constraint violation (SQLSTATE 23503) | Backfill INSERT referenced hardcoded UUID that only exists in production | Added EXISTS subquery to only insert if profile exists |
| Function does not exist (SQLSTATE 42883) | REVOKE/GRANT referenced functions that don't exist in fresh databases | Wrapped in conditional DO blocks that check pg_proc first |
| SECURITY DEFINER functions still executable | `notify_new_user()` and `rpc_book_studio_service()` not in revoke list | Added both functions to REVOKE section |

**New Migrations Created (6):**

| File | Purpose |
|------|---------|
| `20251211999999_make_events_event_date_nullable.sql` | Makes events.event_date nullable |
| `20251212999997_make_events_end_time_nullable.sql` | Makes events.end_time nullable |
| `20251212999998_add_events_frequency_column.sql` | Adds missing events.frequency column |
| `20251212999999_add_venues_name_unique.sql` | Adds unique constraint on venues.name |
| `20251215999999_add_change_reports_reporter_id.sql` | Adds change_reports.reporter_id column |
| `20251221162418_add_member_enum_value.sql` | Adds 'member' enum value in separate transaction |

**Existing Migrations Modified (6):**

| File | Fix Applied |
|------|-------------|
| `20251220020000_default_is_fan_for_new_users.sql` | Fixed dollar quoting syntax |
| `20251221162419_normalize_role_to_member.sql` | Removed enum addition (moved to separate migration) |
| `20260101300000_event_claims.sql` | Moved DROP POLICY after CREATE TABLE |
| `20260107000004_event_watchers.sql` | Made backfill conditional on profile existence |
| `20260202000004_reduce_security_definer_execute_surface.sql` | Wrapped REVOKE/GRANT in conditionals, added notify_new_user() and rpc_book_studio_service() |

**Key Lessons:**

1. **PostgreSQL enum limitation:** Cannot use a newly added enum value in the same transaction (SQLSTATE 55P04). Split ADD VALUE into a separate migration.
2. **DROP POLICY IF EXISTS:** Fails if the table doesn't exist, even with IF EXISTS. Always create the table first.
3. **Hardcoded UUIDs:** Backfill migrations referencing production-only data should use conditional EXISTS checks.
4. **REVOKE/GRANT idempotency:** Wrap in DO blocks that check `pg_proc` before executing to handle functions that may not exist.

---

### Supabase RLS Security Hardening + CI Regression Tripwire (February 2026) — RESOLVED

**Goal:** Harden Supabase permissions and add CI regression tripwire to prevent security drift.

**Status:** Complete.

**Summary:** Hardened Supabase permissions + added CI regression tripwire (RLS, secdef, views, privileges).

**Work Completed:**

| Item | Description |
|------|-------------|
| RLS enabled check | CI fails if any public table has RLS disabled |
| SECURITY DEFINER audit | CI fails if anon/public can EXECUTE non-allowlisted functions |
| View ownership check | CI fails if postgres-owned views lack `security_invoker=true` (unless allowlisted) |
| Privilege drift check | CI fails if anon/authenticated have TRUNCATE/TRIGGER/REFERENCES on any table |
| Migration applied | Revoked dangerous privileges from all existing tables + set ALTER DEFAULT PRIVILEGES |
| Governance doc | Added allowlist justification requirements to prevent "just add it" culture |
| Posture script | Human-readable security summary for local verification |

**Files Added:**

| File | Purpose |
|------|---------|
| `web/scripts/security/supabase-rls-tripwire.mjs` | CI tripwire script with 4 security checks |
| `web/scripts/security/security-posture.mjs` | Human-readable security posture summary |
| `web/scripts/security/README.md` | Allowlist governance documentation |
| `.github/workflows/supabase-rls-tripwire.yml` | GitHub Actions workflow with job summary |
| `supabase/migrations/20260202000005_revoke_dangerous_table_privs.sql` | Revoke dangerous privileges |

**Current Allowlist (with justification):**

| Entry | Justification |
|-------|---------------|
| `public.handle_new_user()` | Auth trigger — must run during signup before user has session |
| `public.upsert_notification_preferences(...)` | User preferences — called during onboarding flow |
| `public.event_venue_match` (view) | Read-only view joining events and venues for public display |

**Tripwire Checks:**

1. **RLS Status** — All public tables must have RLS enabled
2. **SECURITY DEFINER Functions** — No anon/public EXECUTE unless allowlisted
3. **View Ownership** — postgres-owned views must have `security_invoker=true` or be allowlisted
4. **Dangerous Privileges** — No TRUNCATE/TRIGGER/REFERENCES for anon/authenticated

**Running Locally:**

```bash
# Quick posture check
cd web && source .env.local && node scripts/security/security-posture.mjs

# Full tripwire (with allowlists)
TRIPWIRE_ALLOW_ANON_FUNCTIONS="..." \
TRIPWIRE_ALLOW_PUBLIC_FUNCTIONS="..." \
TRIPWIRE_ALLOW_POSTGRES_OWNED_VIEWS="..." \
TRIPWIRE_FAIL_ON_DANGEROUS_TABLE_PRIVS="1" \
node scripts/security/supabase-rls-tripwire.mjs
```

---

### Homepage DSC Events Past Date Filter Fix (February 2026) — RESOLVED

**Goal:** Fix homepage DSC Happenings section showing past one-time events with incorrect badges.

**Status:** Complete.

**Problem:** The Sloan Lake Song Circle / Jam event (Feb 1, 2026 - past one-time event) was still appearing on the homepage DSC section on Feb 2, 2026 with incorrect badges: "UNCONFIRMED", "SCHEDULE UNKNOWN", "Schedule TBD", "Missing details". The event detail page correctly showed it as "Confirmed" with proper schedule.

**Root Cause:** The DSC events query in `page.tsx` had NO date filter - it fetched all DSC events regardless of whether they were past. Past one-time events got included, and occurrence expansion returned empty for them (since they're in the past), causing them to display incorrectly.

**Fix:** Added date filter to DSC events query:
- One-time events: `event_date >= today` (filter out past)
- Recurring events: allowed via `recurrence_rule.not.is.null` (they may have future occurrences)
- Also changed ordering from `created_at DESC` to `event_date ASC` for more logical display

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Added `.or(\`event_date.gte.${today},recurrence_rule.not.is.null\`)` to DSC events query |

**Key Invariant:** Homepage event sections must filter out past one-time events to prevent them from displaying with incorrect "Schedule Unknown" badges.

---

### Homepage DSC Events Recurrence Fields Fix (February 2026) — RESOLVED

**Goal:** Fix homepage DSC Happenings cards showing "SCHEDULE UNKNOWN" for recurring events that have valid schedules.

**Status:** Complete.

**Problem:** TEST DSC events on the homepage showed "SCHEDULE UNKNOWN" badge, while the same events on `/happenings?dsc=1` correctly displayed their schedules ("Every Thursday", "Every Sunday"). The event data was being queried but schedule computation was failing.

**Root Cause:** The `mapDBEventToEvent()` function in `page.tsx` was NOT mapping several critical fields from the database response:
- `day_of_week` — Required for recurrence pattern computation
- `recurrence_rule` — Required for occurrence expansion
- `event_date` — Needed separately from the legacy `date` field
- `slug` — For URL generation

When `HappeningCard` called `computeNextOccurrence()`, these undefined fields caused `isConfident: false`, resulting in "SCHEDULE UNKNOWN" display.

**Fix:** Added the missing fields to `mapDBEventToEvent()`:

```typescript
return {
  id: dbEvent.id,
  slug: dbEvent.slug,
  title: dbEvent.title,
  // ...
  event_date: dbEvent.event_date,  // Added
  day_of_week: dbEvent.day_of_week,  // Added - critical for schedule
  recurrence_rule: dbEvent.recurrence_rule,  // Added - critical for schedule
  // ...
};
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Added `slug`, `event_date`, `day_of_week`, `recurrence_rule` to `mapDBEventToEvent()` function |

**Key Invariant:** Any event mapper function MUST include `day_of_week` and `recurrence_rule` fields for `HappeningCard` to compute schedules correctly.

---

### Advanced Options Expanded by Default (February 2026) — RESOLVED

**Goal:** Make the Advanced Options section expanded by default on event creation and edit forms.

**Status:** Complete.

**Change:** Changed `showAdvanced` initial state from `false` to `true` in EventForm.tsx.

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Changed `useState(false)` to `useState(true)` for showAdvanced state |

**Behavior:**
- Advanced Options section now visible by default when creating or editing events
- Users can still collapse the section by clicking "Advanced Options" header

---

### Event Restore Feature (Phase 5.15, February 2026) — RESOLVED

**Goal:** Allow hosts/admins to restore cancelled events and notify affected users.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3499, build success).

**Features:**

| Feature | Implementation |
|---------|----------------|
| Restore API | PATCH `/api/my-events/[id]` with `{ restore: true }` sets status back to "active" |
| Restore Button | PublishButton shows "Restore Event" for cancelled events |
| Notifications | Emails sent to all users who had cancelled RSVPs or timeslot claims |
| Guest Support | Guests receive direct emails; members receive preference-gated emails |
| Dashboard Notifications | Members get dashboard notification in addition to email |

**Key Behavior:**
- RSVPs and timeslot claims are NOT restored — users must re-RSVP or re-claim
- Email informs users the event is back on and provides a link to RSVP/claim again
- Different messaging for RSVP users vs timeslot claimants

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/email/templates/eventRestored.ts` | Email template for event restored notification |
| `lib/notifications/eventRestored.ts` | Helper to query cancelled signups and send notifications |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/registry.ts` | Registered `eventRestored` template (24 total templates) |
| `lib/notifications/preferences.ts` | Added `eventRestored` to `event_updates` category |
| `app/api/my-events/[id]/route.ts` | Added restore action handling with notification sending |
| `dashboard/my-events/[id]/_components/PublishButton.tsx` | Added Restore Event button for cancelled events |
| `lib/email/email.test.ts` | Updated template count from 23 to 24 |

---

### Search Result Ordering Fix (February 2026) — RESOLVED

**Goal:** Fix search results returning events before venues/members when searching for venue or member names.

**Status:** Complete. Deployed and verified in production.

**Problem:** Searching for "brewery" returned events (like "Brewery Rickoli Open Mic") before the actual venue ("Brewery Rickoli"). Similarly, searching "sami" returned events before the member profile.

**Root Cause:** Search results were not sorted by relevance. Results were added to the array in query order (events before venues/members).

**Solution:** Added sorting logic with three-tier priority:
1. **Exact match** - Title exactly matches query (highest priority)
2. **Starts with** - Title starts with query
3. **Type order** - venues (1) > members (2) > open_mics (3) > events (4) > blogs (5)

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/search/route.ts` | Added result sorting with `typeOrder` priority map and multi-tier comparison |

**Key Code Pattern:**
```typescript
const typeOrder: Record<SearchResult["type"], number> = {
  venue: 1,
  member: 2,
  open_mic: 3,
  event: 4,
  blog: 5,
};

const sortedResults = results.sort((a, b) => {
  // Exact match priority
  // Starts with priority
  // Then type order
  return typeOrder[a.type] - typeOrder[b.type];
});
```

**Verified Results:**
- `q=brewery` → Returns "Brewery Rickoli" venue first
- `q=sami` → Returns "Sami Serrag" member first

---

### My Happenings 3-Tab Dashboard + RSVP Reactivation + Tab UX (Phase 5.14b, February 2026) — RESOLVED

**Goal:** Add third "Cancelled" tab to My Happenings dashboard, fix RSVP reactivation for cancelled RSVPs, and enhance event management tab UX.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3485, build success).

**Problem 1: My Happenings Dashboard Missing Cancelled Tab**

The My Happenings dashboard had 2 tabs (Live, Drafts) plus a collapsed disclosure section for cancelled events. Users expected 3 proper tabs.

**Problem 2: RSVP Reactivation Constraint Violation**

When a user cancelled their RSVP and tried to RSVP again, they got a constraint violation error: "duplicate key value violates unique constraint 'event_rsvps_event_user_date_key'". This affected both member and guest RSVPs.

**Problem 3: Event Management Tabs Not Prominent Enough**

The event management tabs were too small and the Settings tab label was unclear.

**Solutions:**

| Fix | Implementation |
|-----|----------------|
| 3-tab layout | Changed from 2 tabs + collapsed disclosure to 3 proper tabs: Live, Drafts, Cancelled |
| RSVP reactivation | Check for cancelled RSVPs and UPDATE instead of INSERT |
| Larger tabs | Increased padding (`px-6 py-4`), font size (`text-base`), and icon size (`text-xl`) |
| Settings rename | Changed "Settings" to "Host & Co-Host Settings" |

**My Happenings Tab Details:**

| Tab | Badge Color | Filter Logic |
|-----|-------------|--------------|
| Live | Emerald | `status === "active" && is_published === true` |
| Drafts | Amber | `!is_published && status !== "cancelled"` |
| Cancelled | Red | `status === "cancelled"` |

**Cancelled Event Styling:**
- Muted date box (grey instead of accent color)
- Strikethrough title with red decoration
- Reduced opacity (70% → 90% on hover)

**RSVP Reactivation Pattern:**
```typescript
// Check for existing RSVP including cancelled
const { data: existing } = await supabase
  .from("event_rsvps")
  .select("id, status")
  .eq("event_id", eventId)
  .eq("date_key", effectiveDateKey)
  .eq("user_id", session.user.id)
  .maybeSingle();

if (existing?.status === "cancelled") {
  // Reactivate instead of insert
  await supabase.from("event_rsvps").update({...}).eq("id", existing.id);
} else {
  // Insert new RSVP
  await supabase.from("event_rsvps").insert({...});
}
```

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/MyEventsFilteredList.tsx` | 3-tab layout with Live, Drafts, Cancelled tabs |
| `api/events/[id]/rsvp/route.ts` | RSVP reactivation for members |
| `api/guest/rsvp/verify-code/route.ts` | RSVP reactivation for guests |
| `dashboard/my-events/[id]/_components/EventManagementTabs.tsx` | Larger tabs, renamed Settings tab |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-14b-dashboard-and-rsvp-fixes.test.ts` | 47 tests for 3-tab layout, RSVP reactivation, tab UX |

**Test Coverage:** 47 new tests (3485 total).

---

### Search Input Text Erasure Fix (Phase 5.14b Continuation, January 2026) — RESOLVED

**Goal:** Fix search input on /happenings page erasing user's text while typing.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3499, build success).

**Problem:** When typing in the search input on /happenings, text would erase itself. Users had to type fast to "beat" the bug. The same issue affected city and ZIP inputs.

**Root Cause:** A sync loop between local state and URL parameters:
1. User types "br" in input
2. After 300ms debounce, URL updates to `?q=br`
3. useEffect watching URL param runs and resets input to "br"
4. But user has typed "brew" by now → "ew" gets erased

**Solution:** Track when we initiate URL changes using refs, skip sync in those cases:

```typescript
// Track if we're the source of the URL change
const isLocalSearchUpdate = React.useRef(false);

// In handleSearchChange debounce:
isLocalSearchUpdate.current = true;  // Mark as local change
updateFilter("q", value || null);

// In useEffect:
if (isLocalSearchUpdate.current) {
  isLocalSearchUpdate.current = false;  // Reset flag
  return;  // Skip sync - we initiated this change
}
setSearchInput(q);  // Only sync for external changes (browser back/forward)
```

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Added `isLocalSearchUpdate`, `isLocalCityUpdate`, `isLocalZipUpdate` refs; skip sync when local change initiated URL update |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/happenings-search-input-fix.test.ts` | 14 tests for sync loop prevention pattern |

**Key Invariants (Tested):**
1. Local URL changes skip sync (prevents text erasure)
2. External URL changes (browser back/forward) still sync correctly
3. Search debounces at 300ms, city/zip at 400ms
4. Rapid typing preserves all characters
5. Clear search action works correctly

**Test Coverage:** 14 new tests (3499 total).

---

### Tabbed Event Management Layout (Phase 5.14, January 2026) — RESOLVED

**Goal:** Reorganize the event management dashboard with a tabbed layout separating Details, Attendees, Lineup, and Settings into distinct tabs for improved UX.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3438, build success).

**Problem:** The event management page was a long scrolling form mixing event details with RSVP management, performer lineup, and settings. Hosts had difficulty finding specific management features.

**Solution:** Implemented a tabbed layout that separates concerns:

| Tab | Purpose |
|-----|---------|
| Details | Event form editing (title, schedule, location, etc.) |
| Attendees | RSVPs with profile cards and per-occurrence filtering |
| Lineup | Performer signups with per-occurrence filtering (only when `has_timeslots=true`) |
| Settings | Co-hosts, invites, danger zone actions |

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Tab visibility | Lineup tab only shows when `has_timeslots=true` |
| Badge counts | Attendees and Lineup tabs show count badges |
| Date selector | For recurring events, syncs selected date across tabs |
| Per-occurrence filtering | RSVPs and claims filter by `date_key` for recurring events |
| Guest display | Guest RSVPs/claims show `guest_name` with "(guest)" label |

**Files Added:**

| File | Purpose |
|------|---------|
| `dashboard/my-events/[id]/_components/EventManagementTabs.tsx` | Tab navigation with conditional Lineup visibility |
| `dashboard/my-events/[id]/_components/EventManagementClient.tsx` | Client-side tab state management |
| `dashboard/my-events/[id]/_components/AttendeesTab.tsx` | RSVPs with date selector + guest display |
| `dashboard/my-events/[id]/_components/LineupTab.tsx` | Performer claims with date selector |
| `dashboard/my-events/[id]/_components/SettingsTab.tsx` | Co-hosts, invites, danger zone |
| `__tests__/event-management-tabs.test.ts` | 30 tests for tab behavior |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/page.tsx` | Integrated tabbed layout, passes props to tabs |

**Invariants (Tested):**
1. Tab navigation preserves the selected date for recurring events
2. Attendees and Lineup tabs filter by `date_key` for recurring events
3. Lineup tab only shows when `has_timeslots=true`
4. Guest RSVPs display `guest_name` and `guest_email` (not "Anonymous")
5. Date selector syncs across tabs for recurring events

---

### Email Cancel Link Per-Occurrence Fix (Phase ABC6 Continuation, January 2026) — RESOLVED

**Goal:** Fix RSVP cancel links in emails missing the `date_key` parameter for per-occurrence scoping, and fix the CancelRSVPModal causing a loop when cancel succeeded.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3438, build success).

**Problem 1: Cancel URLs Missing date_key**

Cancel links in email templates were not including the `date_key` parameter. When users clicked cancel links for recurring event RSVPs, the cancel action could fail or target the wrong occurrence.

**Problem 2: Cancel Modal Loop Bug**

After successfully cancelling an RSVP, the CancelRSVPModal did not clear the `?cancel=true` URL parameter. On page refresh, the modal would try to reopen, causing a "No RSVP found" error loop.

**Problem 3: Guest Timeslot Cancel URL Wrong Format**

Guest timeslot claim cancel URLs were using raw verification IDs instead of proper action tokens, which could fail validation.

**Solutions:**

| Fix | Implementation |
|-----|----------------|
| Email cancel URLs | Added `dateKey?: string` param to templates, generates `?date={dateKey}&cancel=true` format |
| URL cleanup | CancelRSVPModal now uses `window.history.replaceState()` to remove `?cancel=true` after success |
| Guest cancel URLs | Changed to use `createActionToken()` for proper JWT-based action tokens |
| RSVPSection | Now passes `dateKey` prop to CancelRSVPModal |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/templates/eventUpdated.ts` | Added `dateKey` param, generates cancel URL with date |
| `lib/email/templates/eventReminder.ts` | Added `dateKey` param, generates cancel URL with date |
| `lib/email/templates/occurrenceModifiedHost.ts` | Added `dateKey` param, generates cancel URL with date |
| `components/events/CancelRSVPModal.tsx` | Added `dateKey` prop, URL cleanup after success |
| `components/events/RSVPSection.tsx` | Passes `dateKey` to CancelRSVPModal |
| `api/guest/timeslot-claim/verify-code/route.ts` | Fixed cancel URL to use `createActionToken()` |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/email-cancel-links.test.ts` | 15 tests for email cancel URL invariants |

**Cancel URL Format Invariants (Tested):**
1. Cancel URLs MUST include `date_key` when provided for per-occurrence scoping
2. Cancel URLs MUST use the pattern: `?date={dateKey}&cancel=true` (date before cancel)
3. Guest cancel URLs MUST use action tokens (not raw verification IDs)
4. CancelRSVPModal MUST clear `?cancel=true` from URL after successful cancel

**Test Coverage:** 45 new tests total (15 email + 30 tabs).

---

### Guest RSVPs Display Fix (January 2026) — RESOLVED

**Goal:** Fix guest RSVPs showing as "Anonymous" with "?" avatar in the dashboard Attendees panel.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3393, build success).

**Problem:** Guest RSVPs (non-member users who RSVP'd via email verification) were displaying as "Anonymous" in the host dashboard's RSVPList component, even though the database had their `guest_name` and `guest_email` stored.

**Root Cause:** The `RSVPUser` interface in `RSVPList.tsx` didn't include `guest_name` and `guest_email` fields, and the rendering logic only checked `rsvp.user?.full_name` which is null for guest RSVPs.

**Solution:**

| Fix | Implementation |
|-----|----------------|
| Interface update | Added `guest_name` and `guest_email` fields to `RSVPUser` interface |
| Display logic | Use `rsvp.user?.full_name || rsvp.guest_name || "Anonymous"` for name display |
| Guest indicator | Added "(guest)" label next to guest names |
| Initial display | Show first letter of guest name instead of "?" |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/RSVPList.tsx` | Added guest fields to interface, updated rendering for confirmed and waitlist sections |

---

### Manage Signups UX Improvements (Phase 5.12, January 2026) — RESOLVED

**Goal:** Fix "Manage Signups" link that just reloaded the same page, and make signup management more discoverable for hosts.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3393, build success).

**Problem:** When hosts tried to switch an event back to timeslots after it was reverted to RSVP-only, they couldn't because active signups existed. The "Manage Signups" link in the error message just reloaded the same page without navigating to the claims management section.

**Solution:**

| Fix | Implementation |
|-----|----------------|
| Deep-link anchor | Added `id="performer-signups"` to TimeslotClaimsTable section |
| API actionUrl | Changed from `/dashboard/my-events/${eventId}` to `/dashboard/my-events/${eventId}#performer-signups` |
| Claims visibility | TimeslotClaimsTable now shows when `hasTimeslots OR hasActiveClaims` |
| Proactive link | Added "Manage Signups →" banner in SlotConfigSection when editing with active claims |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/page.tsx` | Added activeClaimCount query, anchor ID, visibility condition change |
| `app/api/my-events/[id]/route.ts` | Updated actionUrl with `#performer-signups` anchor |
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Added eventId/hasActiveClaims props, "Manage Signups" banner |
| `dashboard/my-events/_components/EventForm.tsx` | Added hasActiveClaims prop pass-through |

**Key Behavior:**

- TimeslotClaimsTable shows even if `has_timeslots=false` but claims exist (e.g., after failed slot config change)
- Error messages link directly to `#performer-signups` section
- SlotConfigSection shows amber banner: "Active signups exist. You may need to remove signups before changing slot settings." with "Manage Signups →" link

---

### Timeslots Per-Occurrence Fix (January 2026) — RESOLVED

**Goal:** Fix two critical timeslot bugs: (A) timeslots status reverting to RSVP on edit, and (B) timeslots only created for first occurrence when enabling on a recurring series.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3381, build success).

**Bug A: Timeslots Status Reverting to RSVP**

**Problem:** User enables timeslots on an event, saves, but later when editing the event (without touching timeslots section), timeslots would revert to RSVP-only mode.

**Root Cause:** `EventForm` component's `slotConfig` state was initialized with hardcoded defaults (`has_timeslots: false`) instead of reading from the `event` prop. When user saved the form (even without changing timeslots), it sent `has_timeslots: false` to the API.

**Solution:**
1. Added `has_timeslots`, `total_slots`, `slot_duration_minutes`, `allow_guests` fields to the `EventFormProps.event` interface
2. Changed `slotConfig` initialization to read from `event` prop in edit mode

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Added slot fields to interface, initialize `slotConfig` from `event` prop |

**Bug B: Timeslots Only Created for First Occurrence**

**Problem:** When enabling timeslots on a recurring series (e.g., weekly event), timeslot rows were only created for the first occurrence, not for each future occurrence.

**Root Cause:** The POST handler for event creation used a legacy database function `generate_event_timeslots` that:
- Did NOT set `date_key` on timeslot rows
- Only created one set of timeslots (not per-occurrence)

**Solution:** Replaced the legacy database function call with proper occurrence expansion logic (mirroring the PATCH handler):
1. Added import for `expandOccurrencesForEvent` and `getTodayDenver`
2. Expand all future occurrences using `expandOccurrencesForEvent()`
3. Create timeslot rows for EACH occurrence date with proper `date_key` scoping

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/my-events/route.ts` | Added imports, replaced legacy `generate_event_timeslots` RPC with occurrence expansion + per-date slot creation |

**Key Code Pattern (POST handler):**
```typescript
// Expand occurrences for this event to get all future dates
const occurrences = expandOccurrencesForEvent({
  event_date: event.event_date,
  day_of_week: event.day_of_week,
  recurrence_rule: event.recurrence_rule,
  // ...
});

// Generate slots for EACH occurrence date
for (const dateKey of futureDates) {
  const slots = [];
  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    slots.push({
      event_id: event.id,
      slot_index: slotIdx,
      date_key: dateKey,  // Key fix: scope each slot to its occurrence date
      // ...
    });
  }
  await supabase.from("event_timeslots").insert(slots);
}
```

---

### RSVP Per-Occurrence Display Fix (January 2026) — RESOLVED

**Goal:** Fix RSVP confirmation ("You're going!") incorrectly showing on ALL occurrences of a recurring event instead of only the specific date the user RSVP'd to.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3381, build success).

**Problem:** User RSVP'd to Feb 1st occurrence but the green "You're going!" confirmation was showing on all occurrences (Feb 1, Feb 8, Feb 15, etc.).

**Root Cause:** React preserves client-side component state when navigating between occurrences. When navigating from `?date=2026-02-01` to `?date=2026-02-08`:
- Component re-renders with new `dateKey` prop
- But the `rsvp` state keeps its old "confirmed" value
- The stale state shows before the useEffect can re-fetch for the new date

**Solution:** Added useEffect hooks to immediately clear RSVP state when `dateKey` changes, before the API re-fetch completes.

**Files Modified:**

| File | Change |
|------|--------|
| `components/events/RSVPButton.tsx` | Added useEffect to clear `rsvp` state when `dateKey` changes |
| `components/events/RSVPSection.tsx` | Added useEffect to clear `hasRsvp` and `hasOffer` state when `dateKey` changes |

**Key Code Pattern:**
```typescript
// Phase ABC6 Fix: Clear RSVP state immediately when dateKey changes
// This prevents stale state when navigating between occurrences
useEffect(() => {
  setRsvp(null);  // or setHasRsvp(false); setHasOffer(false);
}, [dateKey]);
```

**Why This Works:**
- The useEffect with `[dateKey]` dependency fires immediately when the prop changes
- This clears the stale state before the next render cycle
- The separate data-fetching useEffect then populates the correct state for the new date
- Order of operations: prop change → clear state → re-render (shows null/loading) → fetch completes → re-render (shows correct state)

---

### Email Header Image Update (January 2026) — RESOLVED

**Goal:** Update the email header image to the new DSC branding.

**Status:** Complete. All quality gates pass (lint 0 errors, build success).

**Change:** Updated the email header image URL in the shared email layout wrapper.

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/render.ts` | Updated header image URL from `logo-email.png` to `DSC%20Email%20Header1.png` |

**Image URLs:**
- **Old:** `https://oipozdbfxyskoscsgbfq.supabase.co/storage/v1/object/public/email-images/logo-email.png`
- **New:** `https://oipozdbfxyskoscsgbfq.supabase.co/storage/v1/object/public/email-images/DSC%20Email%20Header1.png`

**Scope:** All transactional emails (RSVP confirmations, event updates, verification codes, weekly digests, host notifications, etc.) now use the new header image.

---

### Email Date Format Change to MM-DD-YYYY (January 2026) — RESOLVED

**Goal:** Change email date display from YYYY-MM-DD to MM-DD-YYYY format for better readability.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3381, build success).

**Problem:** Email notifications were showing dates in ISO format (e.g., "2026-02-01") which is less familiar to US users.

**Solution:** Added `formatDateKeyForEmail()` helper function that formats dates as MM-DD-YYYY (e.g., "02-01-2026").

**Files Modified:**

| File | Change |
|------|--------|
| `lib/events/dateKeyContract.ts` | Added `formatDateKeyForEmail()` helper function |
| `app/api/events/[id]/rsvp/route.ts` | Use `formatDateKeyForEmail()` for RSVP confirmation emails |
| `app/api/guest/rsvp/verify-code/route.ts` | Use `formatDateKeyForEmail()` for guest RSVP emails |
| `app/api/guest/timeslot-claim/verify-code/route.ts` | Use `formatDateKeyForEmail()` for timeslot claim emails |
| `app/api/my-events/[id]/route.ts` | Use `formatDateKeyForEmail()` for event update notifications |
| `lib/waitlistOffer.ts` | Use `formatDateKeyForEmail()` for waitlist promotion emails |

**Helper Function:**
```typescript
export function formatDateKeyForEmail(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}-${day}-${year}`;
}
```

---

### Email URL Fix — SITE_URL Centralization (January 2026) — RESOLVED

**Goal:** Fix broken email links caused by `undefined` in notification URLs.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3381, build success).

**Problem:** Email notification links (e.g., "View Attendees" button in RSVP host notifications) were generating malformed URLs like `undefined/events/...` instead of valid URLs.

**Root Cause:** `process.env.NEXT_PUBLIC_SITE_URL` evaluates to `undefined` in server-side API routes. The `NEXT_PUBLIC_` prefix makes the variable available client-side, but without special handling it's not available server-side.

**Solution:** Replace all instances of `process.env.NEXT_PUBLIC_SITE_URL` with the centralized `SITE_URL` constant from `lib/email/render.ts`, which has the proper fallback chain:
```typescript
const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/events/[id]/rsvp/route.ts` | Use SITE_URL for eventUrl in host notifications |
| `app/api/events/[id]/comments/route.ts` | Use SITE_URL for comment notification URLs |
| `app/api/guest/event-comment/verify-code/route.ts` | Use SITE_URL for eventUrl |
| `app/api/guest/profile-comment/verify-code/route.ts` | Use SITE_URL for contentUrl (2 occurrences) |
| `app/api/guest/timeslot-claim/verify-code/route.ts` | Use SITE_URL for cancelUrl and eventUrl (3 occurrences) |
| `app/api/guest/gallery-photo-comment/verify-code/route.ts` | Use SITE_URL for photoUrl (2 occurrences) |
| `app/api/guest/gallery-album-comment/verify-code/route.ts` | Use SITE_URL for albumUrl (2 occurrences) |
| `app/api/guest/blog-comment/verify-code/route.ts` | Use SITE_URL for postUrl (2 occurrences) |
| `app/api/guest/rsvp/verify-code/route.ts` | Use SITE_URL for eventUrl in host notifications |

**Pattern to Follow:**
When constructing URLs for email notifications in API routes, always use:
```typescript
import { SITE_URL } from "@/lib/email/render";
// ...
const fullUrl = `${SITE_URL}${relativePath}`;
```

Never use `process.env.NEXT_PUBLIC_SITE_URL` directly in server-side code.

---

### QR Share Block Simplification (January 2026) — RESOLVED

**Goal:** Remove cropped cover image from QR Share Block, showing only QR code + URL.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3381, build success).

**Problem:** The QrShareBlock component displayed a cover image alongside the QR code, but:
1. Cover images were heavily cropped (fixed `w-48 h-32` container)
2. QR code and URL were getting cut off on some viewports
3. The cover image didn't add value — it was already shown elsewhere on the page

**Solution:** Removed cover image feature entirely. Component now shows only:
- Title (e.g., "SHARE THIS HAPPENING")
- Centered QR code
- URL text below QR

**Files Modified:**

| File | Change |
|------|--------|
| `components/shared/QrShareBlock.tsx` | Removed `imageSrc` and `imageAlt` props, simplified layout |
| `app/events/[id]/page.tsx` | Removed `imageSrc` and `imageAlt` props from usage |
| `app/songwriters/[id]/page.tsx` | Removed `imageSrc` and `imageAlt` props from usage |
| `app/venues/[id]/page.tsx` | Removed `imageSrc` and `imageAlt` props from usage |
| `__tests__/phase4-101-qr-share-block.test.tsx` | Removed cover image tests, updated layout test |

---

### Publish/Draft Flow Re-implementation (January 2026) — RESOLVED

**Goal:** Re-implement publish/draft flow for events as a stop-gate between creation and public visibility.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3391, build success).

**Problem:** Events were auto-published on creation with no draft state. Hosts needed a way to:
- Create events without immediately making them public
- Review and edit before publishing
- Easily unpublish/revert to draft state

**Solution:**

| Feature | Implementation |
|---------|----------------|
| Default draft state | Events start with `is_published: false` by default |
| PublishButton in header | Prominent publish/unpublish toggle in edit page header |
| Status badges | Draft (amber), Live (emerald), Cancelled (red) badges |
| Conditional View link | "View Public Page" only shows when published |
| Auto-verification | `last_verified_at` set when transitioning to published |
| CreatedSuccessBanner | Draft-specific messaging with publish instructions |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Default `is_published: false` |
| `app/api/my-events/route.ts` | Respect `body.is_published`, conditional `published_at` |
| `app/api/my-events/[id]/route.ts` | Detect publish transitions, auto-verify on publish |
| `dashboard/my-events/[id]/page.tsx` | PublishButton, status badges, conditional View link |
| `dashboard/my-events/[id]/_components/CreatedSuccessBanner.tsx` | Draft/published conditional messaging |

**Auto-Verification Invariant:**
- `last_verified_at` is set when `is_published` transitions from `false` to `true`
- Both first publish and republish trigger auto-verification
- Explicit `verify_action` in body takes precedence (admin intent preserved)
- PublishButton already had correct `last_verified_at` logic

---

### Weekly Happenings Digest Email (GTM-1, January 2026) — DEPLOYED

**Goal:** Expand Weekly Open Mics Digest into Weekly Happenings Digest covering ALL 9 event types.

**Status:** Deployed to main. Ready to enable via `ENABLE_WEEKLY_HAPPENINGS_DIGEST=true`.

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Features Implemented:**

| Feature | Implementation |
|---------|----------------|
| Query filters | ALL event types, `is_published=true`, `status="active"` |
| Event types (9) | song_circle, workshop, meetup, showcase, open_mic, gig, kindred_group, jam_session, other |
| Date window | 7-day window (Sunday through Saturday) |
| Timezone handling | Denver timezone for all date calculations |
| Occurrence expansion | Recurring events expanded, cancelled occurrences excluded |
| Recipient filtering | Users with `email IS NOT NULL` and `email_event_updates` preference enabled |
| Kill switch | `ENABLE_WEEKLY_HAPPENINGS_DIGEST=true` env var required (default false) |
| Cron schedule | `0 3 * * 0` (Sunday 3:00 UTC = Saturday 8/9 PM Denver) |

**Email Template Structure:**
- Personalized greeting (first name or "there")
- Intro: "Here's what's happening in the Denver songwriter community this week."
- Summary line: "That's X happenings across Y venues this week."
- Day-grouped event listings with emoji by event type, time, venue, cost
- Browse All CTA linking to `/happenings`
- Aspirational copy: "Want to see more or tailor this to you? Browse all happenings with your filters applied!"
- Unsubscribe link to `/dashboard/settings`

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/digest/weeklyHappenings.ts` | Business logic: `getUpcomingHappenings()`, `getDigestRecipients()` |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Email template with day-grouped layout + event type emojis |
| `app/api/cron/weekly-happenings/route.ts` | Cron handler with auth, kill switch, batched sending |
| `__tests__/weekly-happenings-digest.test.ts` | ~45 tests for all components |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/registry.ts` | Registered `weeklyHappeningsDigest` template |
| `lib/notifications/preferences.ts` | Added `weeklyHappeningsDigest` to `EMAIL_CATEGORY_MAP` under `event_updates` |
| `lib/featureFlags.ts` | Added `isWeeklyHappeningsDigestEnabled()` kill switch |
| `vercel.json` | Added `/api/cron/weekly-happenings` cron entry |

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| Separate kill switch | Independent from Open Mics digest for rollback safety |
| Parallel file strategy | New files alongside existing ones, no modification to weeklyOpenMics |
| No schema changes | Uses existing `email_event_updates` preference |
| No UI changes | Email-only feature |
| Event type emojis | Uses `EVENT_TYPE_CONFIG` for consistent iconography |

**Rollback Plan:**
- Set `ENABLE_WEEKLY_HAPPENINGS_DIGEST=false` (or remove env var)
- No code rollback needed - kill switch disables feature completely

**Test Coverage:** ~45 tests covering:
- Date helper functions
- All 9 event types coverage
- Email template copy assertions
- Kill switch behavior
- Registry integration
- Edge cases (empty happenings, unknown event types)

---

### Recurrence Invariant False Positive Fix (Phase 1.5.1, January 2026) — RESOLVED

**Goal:** Fix false positive `[RECURRENCE INVARIANT VIOLATION]` warnings in Vercel logs for weekly digest 7-day windows.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3345, build success).

**Problem:** Weekly digest (7-day window) was logging warnings like:
```
[RECURRENCE INVARIANT VIOLATION] Event unknown is recurring (weekly) but only produced 1 occurrence.
```

This was a false positive because:
1. For weekly events in a 7-day window, 0-2 occurrences is mathematically valid
2. The `eventId` was never passed, resulting in "Event unknown"
3. The `windowDays` was never passed, so the minimum window check was bypassed

**Fix:**

| Change | Implementation |
|--------|----------------|
| Pass event identifier | Added `id`, `title`, `slug` to `EventForOccurrence` interface |
| Pass window size | Calculate `windowDays` from startKey/endKey and pass to invariant |
| Correct minimum windows | Weekly: 14 days, Biweekly: 28 days, Monthly: 56 days |
| Improved log format | `Event {id} "{title}" ({freq}) produced N occurrence in M-day window [start→end]. Expected ≥2.` |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/events/nextOccurrence.ts` | Added `id`/`title`/`slug` to interface, calculate windowDays, pass to invariant |
| `lib/events/recurrenceContract.ts` | Updated `assertRecurrenceInvariant` with correct minWindow values, improved log format |
| `lib/digest/weeklyOpenMics.ts` | Pass event `id`/`title`/`slug` to expansion function |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/recurrence-invariant-window.test.ts` | 19 tests for invariant behavior |

**Test Coverage:** 19 new tests covering:
- Weekly in 7-day window → 1 occurrence → NO warning
- Weekly in 14-day window → 1 occurrence → WARNING
- Biweekly/monthly small window handling
- Log message format includes event ID, title, window bounds

---

### Open Mic Spotlight + EventForm Simplifications (January 2026) — RESOLVED

**Goal:** Add featured Open Mic Spotlight section on homepage and simplify event creation flow.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3326, build success).

**Homepage Open Mic Spotlight:**

| Feature | Implementation |
|---------|----------------|
| Spotlight section | Displays admin-selected open mics using `is_spotlight` flag |
| Position | Below blog section, above footer |
| Branding | 🎤 Open Mic Spotlight header with "See all open mics" link |
| Layout | 3-column grid with HappeningCard components |
| Limit | Up to 6 spotlighted open mics |

**EventForm Simplifications:**

| Change | Before | After |
|--------|--------|-------|
| `isAdmin` prop | Required for inline verification | Removed |
| Publish confirmation | Checkbox required before publish | Removed |
| Default `is_published` | `false` (drafts) | `true` (publish by default) |
| Section 8 (Publish) | Large publish toggle section | Removed |
| `verify_action` | Sent in PATCH body | Removed from form |

**Design Rationale:**
- Events now publish directly without extra confirmation friction
- Verification handled separately by admins via existing admin tools
- Simplifies user flow for community event creation

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Added Open Mic Spotlight section |
| `EventForm.tsx` | Removed isAdmin prop, publish confirmation, verification logic, Section 8 |
| `api/my-events/route.ts` | Simplified event creation |
| `api/my-events/[id]/route.ts` | Simplified event update |
| `my-events/[id]/page.tsx` | Removed isAdmin prop pass-through |
| `CreatedSuccessBanner.tsx` | Simplified success messaging |

---

### Weekly Open Mics Digest Email (Phase 1.5, January 2026) — RESOLVED

**Goal:** Send personalized weekly email to members listing upcoming open mics in the Denver area.

**Status:** Complete. All quality gates pass (lint 0 errors, tests passing, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Features Implemented:**

| Feature | Implementation |
|---------|----------------|
| Query filters | `event_type="open_mic"`, `is_published=true`, `status="active"` |
| Date window | 7-day window (Sunday through Saturday) |
| Timezone handling | Denver timezone for all date calculations |
| Occurrence expansion | Recurring events expanded, cancelled occurrences excluded |
| Recipient filtering | Users with `email IS NOT NULL` and `email_event_updates` preference enabled |
| Kill switch | `ENABLE_WEEKLY_DIGEST=true` env var required |
| Cron schedule | `0 3 * * 0` (Sunday 3:00 UTC = Saturday 8/9 PM Denver) |

**Email Template Structure:**
- Personalized greeting (first name or "there")
- Summary line: "X open mics across Y venues this week"
- Day-grouped event listings with time, venue, cost
- Browse All CTA linking to `/happenings?type=open_mic`
- Unsubscribe link to `/dashboard/settings`

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/digest/weeklyOpenMics.ts` | Business logic: `getUpcomingOpenMics()`, `getDigestRecipients()` |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Email template with day-grouped layout |
| `app/api/cron/weekly-open-mics/route.ts` | Cron handler with auth, kill switch, batched sending |
| `vercel.json` | Vercel Cron configuration |
| `__tests__/weekly-open-mics-digest.test.ts` | 30+ tests for all components |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/registry.ts` | Registered `weeklyOpenMicsDigest` template |
| `lib/notifications/preferences.ts` | Added to `EMAIL_CATEGORY_MAP` under `event_updates` |

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| Kill switch required | Prevents accidental sends during development/testing |
| 100ms delay between emails | Rate limiting for email provider |
| Service role client | Bypasses RLS for cron jobs |
| Preference gating | Respects user's `email_event_updates` setting |

**Test Coverage:** 30+ tests covering date helpers, email template, registry, feature flags, edge cases.

---

### TV Mode HUGE Now Playing + Balanced Header (Phase 4.113, January 2026) — RESOLVED

**Goal:** Make the Now Playing section dramatically larger and more impactful for TV display, with balanced header layout.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3292, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Requirements Implemented:**

| Requirement | Implementation |
|-------------|----------------|
| NOW PLAYING header | `text-2xl` bold in accent color, uppercase with tracking |
| Avatar size | Increased from 100px to 180px |
| Performer name | Increased from `text-4xl` to `text-5xl` bold |
| QR code size | Increased from 64px to 100px |
| CTA text | "SCAN TO FOLLOW + TIP" in `text-xl` accent color |
| Balanced header | Centered title/venue/time with date on left, QRs on right |

**Header Layout Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Date Box]     [Centered: Title, Venue • Time, CTA]  [QRs] │
└─────────────────────────────────────────────────────────────┘
```

**Now Playing Layout:**
```
┌─────────────────────────────────────┐
│         NOW PLAYING                 │  ← text-2xl bold accent
│                                     │
│        ┌──────────┐                 │
│        │  Avatar  │                 │  ← 180px
│        │  (180px) │                 │
│        └──────────┘                 │
│                                     │
│      Performer Name                 │  ← text-5xl bold
│                                     │
│   ┌────────┐                        │
│   │  QR    │  SCAN TO FOLLOW + TIP  │  ← 100px QR + text-xl
│   │ (100px)│                        │
│   └────────┘                        │
└─────────────────────────────────────┘
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/display/page.tsx` | HUGE Now Playing section, balanced header layout |

**Test Coverage:** 3292 tests passing.

---

### Profile Photo Auto-Avatar UX (Phase 4.112, January 2026) — RESOLVED

**Goal:** When a user uploads their FIRST profile photo and has no avatar, automatically set that photo as their profile picture. Also add a banner prompting users to choose a profile picture if they have photos but no avatar.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3292, build success).

**Checked against DSC UX Principles:** §7 (UX Friction), §10 (Defaults)

**Features Implemented:**

| Feature | Implementation |
|---------|----------------|
| Auto-set avatar on first upload | If `images.length === 0` AND `!currentAvatarUrl`, auto-set uploaded photo as avatar |
| Combined success toast | "Photo uploaded and set as your profile picture!" for auto-set |
| Choose profile photo banner | Amber banner appears when `activeImages.length > 0 && !currentAvatarUrl` |
| Banner instruction | "👆 Choose your profile picture! Hover over a photo and click the ✓ button to set it as your profile picture." |

**Auto-Avatar Logic:**
```typescript
const isFirstPhoto = images.length === 0;
const hasNoAvatar = !currentAvatarUrl;
if (isFirstPhoto && hasNoAvatar) {
  // Auto-set this as the profile photo
  await supabase.from("profiles").update({ avatar_url: urlWithTimestamp }).eq("id", userId);
  onAvatarChange(urlWithTimestamp);
  toast.success("Photo uploaded and set as your profile picture!");
}
```

**Banner Visibility Logic:**
- Show when: `activeImages.length > 0 && !currentAvatarUrl`
- Purpose: Prompt users who uploaded photos but haven't chosen a profile pic

**Files Modified:**

| File | Change |
|------|--------|
| `components/profile/ProfilePhotosSection.tsx` | Auto-avatar on first upload, amber banner prompt |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-112-profile-photo-auto-avatar.test.ts` | 12 tests for auto-avatar logic, banner visibility, toast messages |

**Test Coverage:** 12 new tests (3292 total).

---

### Verification Status Fix + Slug Fixes (Phase 4.111, January 2026) — RESOLVED

**Goal:** Fix verification status badge not appearing on happenings cards and fix slug generation for single-occurrence events.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3261, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §5 (Previews Match Reality)

**Issues Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Verification badge missing on cards | `shouldShowUnconfirmedBadge()` called but badge JSX not rendered | Added badge rendering in HappeningCard chips row |
| Single-occurrence slugs collide | Events on same date got same slug (e.g., "open-mic-2026-01-18") | Added date suffix for single-occurrence events |

**Verification Badge Display:**
- Green "Confirmed" badge with checkmark for verified events
- Amber "Unconfirmed" badge for unverified events
- Badge appears in chips row on HappeningCard

**Slug Generation for Single-Occurrence Events:**
- Format: `{title-slug}-{YYYY-MM-DD}` (e.g., "words-open-mic-2026-01-18")
- Prevents collisions when multiple single events occur on same date
- Recurring events continue to use title-only slugs

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningCard.tsx` | Added verification badge rendering in chips row |
| `lib/events/slugGeneration.ts` | Date suffix for single-occurrence event slugs |

**Test Coverage:** 3261 tests passing.

---

### TV Mode 20-Slot Fit (Phase 4.110, January 2026) — RESOLVED

**Goal:** Fit up to 20 performer slots on TV display without scrolling by implementing 3-tier adaptive sizing.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3255, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**3-Tier Adaptive Sizing:**

| Slot Count | Tier | Avatar | Name Font | QR Size | Row Padding |
|------------|------|--------|-----------|---------|-------------|
| 1-6 | large | 48px | text-lg | 44px | py-2.5 |
| 7-12 | medium | 40px | text-base | 36px | py-2 |
| 13-20 | compact | 32px | text-sm | 28px | py-1.5 |

**Key Implementation:**
```typescript
// Tier selection based on total slot count
const densityTier = totalSlots <= 6 ? "large" : totalSlots <= 12 ? "medium" : "compact";

// Consistent sizing per tier
const avatarSize = { large: 48, medium: 40, compact: 32 }[densityTier];
const qrSize = { large: 44, medium: 36, compact: 28 }[densityTier];
```

**Layout Changes:**
- Up Next section uses CSS Grid with 2 columns when >10 slots
- Tier computed from **total timeslots** (stable) not remaining slots (avoids reflow on Go Live)
- All 20 slots visible without scrolling on 1080p TV

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/display/page.tsx` | 3-tier adaptive sizing, 2-column layout for >10 slots |

**Test Coverage:** 3255 tests passing.

---

### TV Poster Mode Final Polish (Phase 4.109, January 2026) — RESOLVED

**Goal:** Final 10% polish for TV Poster Mode to make it production-ready for live events with 10-20 performers.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3224, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Requirements Implemented:**

| Requirement | Implementation |
|-------------|----------------|
| Up Next 2-column layout | When >10 slots, uses `grid grid-cols-2 gap-2` to fit up to 20 |
| Adaptive slot sizing | `slotSize = count <= 10 ? "large" : "small"` |
| Now Playing smaller | Avatar reduced from 140px to 100px |
| Now Playing name bigger | Font increased from `text-3xl` to `text-4xl` |
| Performer QR black/white | Changed from gold `#d4a853` to `#000000` on `#ffffff` |
| CTA text in header | "Scan the QR codes to Follow and Support the Artists and our Collective" |
| DSC QR label | Changed from "Join DSC" to "OUR COLLECTIVE" |
| Event QR label | Changed from "This Event" to "EVENT PAGE" |
| QR sizing equalized | Both top-right QRs now 80px (was 70px/90px) |

**Layout Behavior by Slot Count:**

| Slots | Layout | Slot Size | QR Size |
|-------|--------|-----------|---------|
| 1-10 | 1 column, flex | large (py-2.5) | 44px |
| 11-20 | 2 columns, grid | small (py-1.5) | 32px |

**Key Code Patterns:**

```typescript
// 2-column detection
const use2Columns = upNextSlots.length > 10;
const slotDisplayCount = Math.min(allUpNextSlots.length, 20);
const slotSize = slotDisplayCount <= 10 ? "large" : "small";

// Performer QR generation (black on white)
const qrDataUrl = await QRCode.toDataURL(profileUrl, {
  width: 100,
  margin: 1,
  color: { dark: "#000000", light: "#ffffff" },
});
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/display/page.tsx` | 2-column layout, adaptive sizing, QR colors, CTA text, label changes |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-109-tv-poster-mode.test.ts` | 31 tests for Phase 4.109 contracts |

**Files Deleted:**

| File | Reason |
|------|--------|
| `__tests__/phase4-108-tv-poster-mode.test.ts` | Superseded by Phase 4.109 tests |

**Test Coverage:** 31 tests (3224 total).

**Manual Smoke Tests:**
1. Load TV mode with 8 slots → 1-column layout, large slots, 44px QRs
2. Load TV mode with 15 slots → 2-column layout, small slots, 32px QRs
3. Verify performer QRs scan correctly (black on white)
4. Verify CTA text visible in header
5. Verify DSC QR label says "OUR COLLECTIVE"
6. Verify Event QR label says "EVENT PAGE"
7. Verify both top-right QRs are same size (80px)

**Investigation Doc:** `docs/investigation/phase4-109-tv-poster-mode-final-10.md`

---

### TV Poster Mode Completion (Phase 4.108, January 2026) — RESOLVED

**Goal:** Complete TV Poster Mode to be pixel-max, stable, and complete for live events. Fixes 8 issues from Phase 4.104.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3223, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Issues Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Layout instability on Go Live | `densityTier` computed from `upNextSlots.length` (variable) | Compute from `timeslots.length` (stable total) |
| Up Next list clipping | Flex layout couldn't fill remaining space | CSS Grid with `grid-rows-[auto_auto_minmax(0,1fr)]` |
| QR only for first performer | Gate: `index === 0 && densityTier === "large"` | QR for ALL performers with adaptive sizing |
| HOST label not prominent | Small text below avatar | Badge above name with accent background |
| Cover art cropped | `object-cover` crops to fill | `object-contain` with dark letterbox background |
| Slot times in Now Playing | Individual times displayed | Removed; event time window shown in header instead |
| Missing DSC Join QR | Not implemented | Added 80px QR to homepage in header |
| Wasted space | Large padding/margins/gaps | Reduced: `p-6`, `gap-4`, `mb-4` |

**Density Tier Contract (STABLE):**

| Total Slots | Tier | QR Size | Row Height |
|-------------|------|---------|------------|
| 1-6 | large | 48px | 64px |
| 7-12 | medium | 40px | 52px |
| 13+ | compact | 32px | 44px |

Tier computed from **total timeslots** (stable), not remaining slots (changes on Go Live).

**New Helper Functions:**

| Function | Purpose |
|----------|---------|
| `formatEventTimeWindow(startTime, endTime)` | Returns "6:00 PM – 9:00 PM" or "Starts 6:00 PM" |

**Layout Structure (CSS Grid):**
```
grid-rows-[auto_auto_minmax(0,1fr)]
├── Row 1 (auto): Header with date, title, venue, time window, DSC Join QR
├── Row 2 (auto): Host badges row
└── Row 3 (1fr): Main content (Flyer | Now Playing | Up Next)
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/display/page.tsx` | All 8 fixes, `end_time` query, `formatEventTimeWindow`, DSC Join QR |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-108-tv-poster-mode.test.ts` | 30 tests for density tier, time formatting, QR sizing, layout contracts |

**Test Coverage:** 30 new tests (3223 total).

**Manual Smoke Tests:**
1. Load TV mode with 10 slots → all visible, QRs for all
2. Load TV mode with 20 slots → compact tier, all visible
3. Click "Go Live" → no layout reflow
4. Upload tall/wide flyer → fully visible (letterboxed)
5. View from 8-12 feet → HOST label clearly readable
6. Scan DSC QR → goes to homepage
7. Scan performer QR → goes to profile

**Investigation Doc:** `docs/investigation/phase4-108-tv-poster-mode-completion-stopgate.md`

---

### TV Poster Mode (Phase 4.104, January 2026) — RESOLVED

**Goal:** Transform `/events/[id]/display?tv=1` into a full-screen concert poster aesthetic with blurred cover art background, host/cohost badges with QR codes, and past demo support.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3191, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**TV Mode Trigger:** `?tv=1` query parameter activates full-screen poster mode.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Full-screen overlay | `fixed inset-0 z-[9999]` covers header/footer without route restructure |
| Cover art background | Blurred cover image with dark gradient overlay for text readability |
| Scroll lock | `document.documentElement.style.overflow = "hidden"` when TV mode active |
| Host badges row | Primary host + all accepted cohosts with avatars and QR codes on white tiles |
| Event QR | 120px QR code on white tile labeled "EVENT" |
| Past demo support | In TV mode only, accepts any valid `YYYY-MM-DD` date (outside 90-day window) |
| Lineup display | Now Playing / Up Next sections preserved in overlay |
| Empty state | Friendly message for past dates with no roster data |

**Cover Image Precedence:**
1. `override_patch.cover_image_url` (per-occurrence override)
2. `override_cover_image_url` (legacy override column)
3. `event.cover_image_url` (base event)

**QR Code Sizes:**

| Element | QR Size | Avatar Size |
|---------|---------|-------------|
| Event | 120px | — |
| Host | 80px | 120px |
| Cohost | 60px | 80px |

**Host Fetching:**
- Queries `event_hosts` table for all accepted hosts (`invitation_status = 'accepted'`)
- Joins with `profiles` for avatar_url, full_name, slug
- Primary host (`role = 'host'`) sorted first, then cohosts

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/display/page.tsx` | TV mode overlay, scroll lock, host badges, cover background, past demo support |

**URL Examples:**
- TV Mode: `/events/words-open-mic/display?tv=1&date=2026-01-18`
- Normal Mode: `/events/words-open-mic/display?date=2026-01-18`

**Key Implementation Details:**

```typescript
// TV mode detection
const tvMode = searchParams.get("tv") === "1";

// Past date acceptance (TV mode only)
const isValidDateFormat = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate);
if (tvMode && isValidDateFormat) {
  dateKey = urlDate; // Bypass 90-day window check
}

// Scroll lock effect
React.useEffect(() => {
  if (tvMode) {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  return () => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  };
}, [tvMode]);
```

**No Migrations Required:** UI-only change.

---

### Lineup/Display Slug Fix + TV QR Strip (Phase 4.100.2 + 4.102, January 2026) — RESOLVED

**Goal:** Fix 400 Bad Request errors on lineup and display pages when accessed via slug URLs, and add TV-optimized QR codes for Event/Venue/Host.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3191, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §4 (Centralize Logic)

**Phase 4.100.2: Slug/UUID Bugfix**

**Problem:** Lineup and display pages threw 400 Bad Request errors when accessed via slug URLs (e.g., `/events/words-open-mic/lineup`) because queries used `.eq("id", slugString)` which fails PostgreSQL UUID type comparison.

**Solution:**
- Added `isUUID()` helper function to detect UUID vs slug format
- Renamed `eventId` to `routeParam` for clarity
- Added `eventUuid` state to store the resolved UUID after initial fetch
- Modified `fetchData` to conditionally query by `id` OR `slug`
- Updated all downstream queries (timeslots, lineup state, claims, upserts) to use `eventUuid`

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/lineup/page.tsx` | isUUID helper, conditional query, eventUuid state, 7 query locations fixed |
| `app/events/[id]/display/page.tsx` | isUUID helper, conditional query, eventUuid state, 3 query locations fixed |

**Phase 4.102: TV Display QR Strip**

**New Component:**

| Component | Path | Purpose |
|-----------|------|---------|
| TvQrStrip | `components/events/TvQrStrip.tsx` | TV-optimized QR codes: Event (240px), Venue (200px), Host (200px) |

**Display Page Enhancements:**
- Split static vs dynamic data fetching (venue/host fetched once, timeslots/lineup polled every 5s)
- Added `VenueInfo` and `HostInfo` interfaces and state
- Created `fetchStaticData` callback for one-time venue/host lookup
- Increased typography for TV distance readability:
  - Titles: `text-5xl` (was `text-4xl`)
  - Headers: `text-2xl` (was `text-lg`)
  - Date box: `w-28 h-28` (was `w-24 h-24`)
  - LIVE badge: `text-lg`
  - Performer names: `text-2xl` for next up, `text-xl` for others
  - Completed performers: Larger pills with `text-base`
- Replaced footer with `TvQrStrip` component showing Event/Venue/Host QR codes

**TvQrStrip Props:**

| Prop | Type | Description |
|------|------|-------------|
| `eventSlugOrId` | string | Event slug or UUID for QR URL |
| `venueSlugOrId` | string \| null | Venue slug or UUID (optional) |
| `venueName` | string \| null | Venue name for label |
| `hostSlugOrId` | string \| null | Host slug or UUID (optional) |
| `hostName` | string \| null | Host name for label |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/events/TvQrStrip.tsx` | TV-optimized QR strip component |
| `__tests__/phase4-100-2-slug-uuid-fix.test.ts` | 29 tests for isUUID helper and query patterns |

**Test Coverage:** 29 new tests (3191 total).

**Key Pattern (isUUID helper):**
```typescript
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Conditional query pattern
const { data } = isUUID(routeParam)
  ? await query.eq("id", routeParam).single()
  : await query.eq("slug", routeParam).single();
```

---

### Venue Integrity Audit + Location Filter Empty States (Phase 1.42, January 2026) — RESOLVED

**Goal:** Audit venue data integrity and improve empty state messaging for location filters.

**Venue Integrity Audit (January 2026):**
- All 66 published+active events verified to have valid `venue_id`
- Zero events with `location_mode IN ('venue','hybrid')` AND `venue_id IS NULL`
- No remediation required
- CSV import now enforces venue presence (Phase 1.41)

**Location Filter Empty States:**
- Added `getEmptyStateMessage()` helper for location-aware messaging
- ZIP: `No venues found for ZIP ${zipParam}` + "Try a nearby ZIP or a larger radius." (dynamic, uses user's input)
- City: `No venues found in ${cityParam}` + "Try increasing the radius or clearing the location filter." (dynamic, uses user's input)

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Location-aware empty state helper function + updated both empty state locations |

---

### City/ZIP Nearby Filter for Happenings (Phase 1.4, January 2026) — RESOLVED

**Goal:** Add city/ZIP-based filtering with radius-based "nearby" expansion to the /happenings page.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3115, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §4 (Centralize Logic)

**Work Done:**
- Created `locationFilter.ts` helper module with Haversine distance calculation
- Wired location filter into happenings page pipeline (Timeline, Series, Map views)
- Added UI controls (city input, ZIP input, radius dropdown) to HappeningsFilters
- Filter respects `override_patch.venue_id` for per-occurrence venue changes

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/happenings/locationFilter.ts` | Core filter logic: normalization, Haversine, bounding box, venue filtering |
| `lib/happenings/index.ts` | Barrel export for happenings module |
| `__tests__/phase1-4-location-filter.test.ts` | 36 tests covering helper functions and contracts |

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Added city/zip/radius params, location filtering for all views, filter summary |
| `components/happenings/HappeningsFilters.tsx` | Added Location section with city/ZIP inputs and radius dropdown |

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| ZIP wins over city | When both provided, ZIP is used for filtering |
| Valid radii | 5, 10, 25, 50 miles (default 10) |
| Haversine distance | Calculates great-circle distance without PostGIS |
| Bounding box pre-filter | Performance optimization before Haversine computation |
| Centroid calculation | Average lat/lng of exact-match venues with coordinates |
| Override venue support | Uses `override_patch.venue_id` when present |

**URL Parameters:**

| Param | Description |
|-------|-------------|
| `city` | City name for nearby filter (e.g., "Denver") |
| `zip` | ZIP code for nearby filter (e.g., "80202") |
| `radius` | Radius in miles (5, 10, 25, or 50; default 10) |

**View Parity:**
- Timeline view: Filters occurrences by effective venue_id
- Series view: Filters series entries by venue_id
- Map view: Filters pins by venue_id

**Filter Summary Display:**
- Shows location context in results summary (e.g., "ZIP 80202 (3 + 5 nearby, 10mi)")
- Active filter pill with MapPin icon for easy removal

**Test Coverage:** 36 new tests (3115 total).

---

### Location Filter Visibility Fix (Phase 1.41, January 2026) — RESOLVED

**Goal:** Make Location filters (City/ZIP/Radius) visible by default on /happenings without requiring users to expand the Filters disclosure.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3115, build success).

**Checked against DSC UX Principles:** §2 (Visibility)

**Problem:** Phase 1.4 added Location filters but placed them inside a collapsed `<details>` element (Phase 4.55 progressive disclosure). Users had to expand "Filters" to see City/ZIP/Radius controls.

**Solution:** Moved Location block outside the `<details>` element while keeping other advanced filters (Days, When, Type, Cost) inside for progressive disclosure.

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Moved Location section outside `<details>`, updated grid to responsive `grid-cols-1 sm:grid-cols-3` |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase1-41-location-visible.test.tsx` | Visibility contract tests for Location controls |

**Key Changes:**

| Change | Implementation |
|--------|----------------|
| Location visibility | Always visible below Search, above collapsed Filters |
| Responsive layout | `grid-cols-1` on mobile, `sm:grid-cols-3` on desktop |
| Progressive disclosure preserved | Days, When, Type, Cost remain in collapsed `<details>` |
| Badge logic unchanged | Location filter still counted in `advancedFilterCount` |

**Smoke Checklist:**
1. `/happenings` — City/ZIP/Radius visible without expanding Filters
2. Mobile viewport — inputs stack 1-per-row; desktop: 3 columns
3. Set city/zip/radius, collapse Filters — active filter badge/summary still reflects location filter

---

### Mobile Bottom Sheet for Map Pins (Phase 1.3, January 2026) — RESOLVED

**Goal:** Add responsive detail panel for map pins - mobile bottom sheet (≤768px) while preserving desktop Leaflet popup behavior.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3079, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction)

**Work Done:**
- Created `useIsMobile` hook using `useSyncExternalStore` for SSR-safe mobile detection
- Created `MapVenueSheet` bottom sheet component with accessibility features
- Modified `MapView` to conditionally render popup (desktop) vs sheet (mobile)
- Added slide-up animation for sheet appearance

**Files Added:**

| File | Purpose |
|------|---------|
| `hooks/useIsMobile.ts` | SSR-safe hook returning true when viewport < 768px |
| `components/happenings/MapVenueSheet.tsx` | Mobile bottom sheet with focus trap, escape key, backdrop |
| `__tests__/phase1-3-map-mobile-sheet.test.tsx` | 17 tests covering hook and sheet contracts |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/MapView.tsx` | Added isMobile detection, selectedPin state, conditional popup/sheet rendering |
| `app/globals.css` | Added `@keyframes slide-up` and `.animate-slide-up` class |

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| SSR-safe | `useSyncExternalStore` with server snapshot returning false |
| Breakpoint | 768px (matches Tailwind `md:` prefix) |
| Focus trap | Tab wrapping within sheet |
| Body scroll lock | Prevents background scrolling when sheet open |
| Escape key | Closes sheet |
| Backdrop click | Closes sheet |
| Accessibility | `role="dialog"`, `aria-modal`, `aria-label` |

**Desktop vs Mobile Behavior:**

| Viewport | Pin Click | Detail Display |
|----------|-----------|----------------|
| ≥768px | Opens Leaflet popup | Inline popup over map |
| <768px | Opens bottom sheet | Slides up from bottom |

**Test Coverage:** 17 new tests (3079 total).

---

### Map Popup Pure Component Extraction (Phase 1.2b, January 2026) — RESOLVED

**Goal:** Extract MapPinPopup from MapView.tsx to a pure component for testability without Leaflet DOM.

**Status:** Complete. All quality gates pass (lint 0 errors, tests 3062, build success).

**Checked against DSC UX Principles:** §4 (Centralize Logic), §12 (Test the Contract)

**Work Done:**
- Extracted `MapPinPopup` function from `MapView.tsx` to standalone `MapPinPopup.tsx`
- Pure component (no Leaflet imports) enables React Testing Library tests
- No functional changes — exact same markup preserved

**Files Added:**

| File | Purpose |
|------|---------|
| `components/happenings/MapPinPopup.tsx` | Pure presentational component for popup content |
| `__tests__/map-pin-popup.test.tsx` | 17 tests covering all popup contracts |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/MapView.tsx` | Removed inline MapPinPopup function, imports from new component |

**Contracts Tested (17 tests):**

| Contract | Tests |
|----------|-------|
| Venue link when slug exists | 2 tests — link to `/venues/{slug}`, correct classes |
| Venue text when slug is null | 1 test — renders as plain span |
| Event links with date params | 2 tests — hrefs correct, link classes |
| 5-event limit with overflow | 3 tests — all visible ≤5, "+X more" format, plural handling |
| Scroll container styling | 1 test — `space-y-2 max-h-[200px] overflow-y-auto` classes |
| Happening count display | 2 tests — singular/plural handling |
| Status indicators | 3 tests — CANCELLED, RESCHEDULED, precedence |
| Event details | 3 tests — date, time, time-hidden when null |

**Test Coverage:** 17 new tests (3062 total).

---

### Restore Pre-Phase-1.0 Default Window (Phase 1.01, January 2026) — RESOLVED

**Goal:** Revert Phase 1.0's "default today/tonight filter" behavior back to the pre-Phase-1.0 rolling ~3 month window.

**Status:** Complete. All quality gates pass (lint 0, tests 3045, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §3 (Rolling Windows Must Be Explained)

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Default shows only today's events | Phase 1.0 added `dateFilter` logic that defaulted to today when no date params | Removed `date` and `all` params, removed dateFilter logic |
| Map view defaulted to today-only | Map view inherited the Phase 1.0 today-default behavior | Map now uses same rolling ~3 month window as Timeline/Series |
| Favorites 406 spam in console | `.single()` returns 406 when 0 rows match | Changed to `.maybeSingle()` which returns null for 0 rows |

**What Was Removed:**

| Removed | Rationale |
|---------|-----------|
| `date` search param | Phase 1.0 addition for single-date filtering |
| `all` search param | Phase 1.0 addition to show all upcoming (workaround for today-default) |
| `hasDateParams` variable | Used to detect if date-affecting params were present |
| `dateFilter` variable | Used to apply single-date filtering |
| Single-date filter application | Logic that filtered to a specific date |
| "See all upcoming →" link | No longer needed since default is already all upcoming |

**Default Window Behavior (Restored):**

| View | Default Window |
|------|---------------|
| Timeline | Rolling ~3 months (today → today+90) |
| Series | Rolling ~3 months (today → today+90) |
| Map | Rolling ~3 months (today → today+90) |

**Results Summary (Restored):**
- Default view shows humanized summary: "X tonight · Y this weekend · Z this week · Total in the next 3 months"
- Filtered views show: "X happenings across Y dates (context)"

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Removed `date`/`all` params, dateFilter logic, restored rolling window default |
| `components/happenings/HappeningCard.tsx` | Fixed `.single()` → `.maybeSingle()` for favorites check |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase1-01-default-window-revert.test.ts` | 12 tests for Phase 1.01 contracts |

**Test Coverage:** 12 new tests (3045 total).

**Smoke Checklist:**
1. `/happenings` — Shows rolling ~3 month window by default (not just today)
2. `/happenings?view=map` — Shows all venues with events in ~3 month window
3. `/happenings?view=series` — Shows series with occurrences in ~3 month window
4. No 406 errors in console when viewing happenings cards

---

### Map View Discovery (Phase 1.0, January 2026) — RESOLVED

**Goal:** Add a map view mode to `/happenings` that displays events as clustered pins on an interactive map, grouped by venue.

**Status:** Complete. All quality gates pass (lint 0, tests 3033, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §4 (Centralize Logic)

**Features:**
- New `?view=map` toggle on `/happenings` page (timeline is default)
- Interactive Leaflet + OpenStreetMap map (zero-cost provider)
- Clustered pins via `react-leaflet-cluster` (pins group when zoomed out)
- One pin per venue with multiple events grouped
- Center on Denver (39.7392, -104.9903), zoom level 11
- Max 500 pins before showing fallback message
- Lazy-loaded map component (client-side only, not in initial bundle)
- Filter parity with Timeline/Series views
- Hover tooltips showing venue name and event count

**Non-Goals (Intentional):**
- No new routes, API endpoints, or database queries
- No geo-radius filtering (use existing filters)
- No custom pin styling (uses Leaflet defaults)

**View Mode URL Handling:**
- `?view=timeline` or no param → Timeline view (default)
- `?view=series` → Series view
- `?view=map` → Map view

**Coordinate Resolution Priority:**
1. `override_patch.venue_id` → lookup override venue coords
2. `event.venue_id` → lookup event venue coords
3. `event.custom_latitude/custom_longitude` → use custom location coords
4. No coordinates → excluded from map (logged as warning)

**Online-Only Exclusion:**
- Events with `location_mode='online'` are excluded from map view
- Stats bar shows count of excluded online-only events

**CSP + Icon Fixes (January 2026):**
- Added OSM tile domains to CSP img-src (`https://tile.openstreetmap.org https://*.tile.openstreetmap.org`)
- Marker icons hosted locally in `/public/leaflet/` (avoids CDN CSP issues)
- Stats wording changed from "X venues · Y happenings" to "X venues with Y happenings"
- Exclusion label changed from "missing coords" to "no venue assigned"
- Server-side warning specifies "location_mode='venue' but venue_id is NULL" for data quality issues

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/map/mapPinAdapter.ts` | Transforms occurrences to map pins, groups by venue |
| `lib/map/index.ts` | Map module exports |
| `components/happenings/MapView.tsx` | Client-side Leaflet map component with tooltips |
| `public/leaflet/*.png` | Local Leaflet marker icons (marker-icon, marker-icon-2x, marker-shadow) |
| `__tests__/phase1-0-map-view.test.ts` | 26 tests for map pin adapter and view modes |

**Files Modified:**

| File | Change |
|------|--------|
| `next.config.ts` | Added OSM tile domains to CSP img-src |
| `components/happenings/ViewModeSelector.tsx` | Added "map" to HappeningsViewMode, added MapIcon, 3-column grid |
| `app/happenings/page.tsx` | Map view mode handling, venue lat/lng queries, MapView rendering |

**Key Interfaces:**

```typescript
interface MapPinData {
  venueId: string;
  latitude: number;
  longitude: number;
  venueName: string;
  venueSlug: string | null;
  events: MapPinEvent[];
}

interface MapPinResult {
  pins: MapPinData[];
  excludedMissingCoords: number;
  excludedOnlineOnly: number;
  limitExceeded: boolean;
  totalProcessed: number;
}
```

**MAP_DEFAULTS:**
```typescript
{
  CENTER: { lat: 39.7392, lng: -104.9903 },  // Denver
  ZOOM: 11,
  MAX_PINS: 500
}
```

**Test Coverage:** 26 new tests (3020 total).

**Dependencies Added:**
- `react-leaflet` ^5.0.0
- `leaflet` ^1.9.4
- `react-leaflet-cluster` ^2.1.0
- `@types/leaflet` ^1.9.18

---

### Venue Editing by Event Hosts — Trust-First Model (Phase 0.6, January 2026) — RESOLVED

**Goal:** Allow event hosts and cohosts to edit venues associated with their events, with automatic geocoding when address fields change.

**Status:** Complete. All quality gates pass (lint 0, tests 2994, build success).

**Trust-First Model:**
- Hosts and cohosts can FULLY edit venues tied to their events
- No field-level restrictions — ALL 16 venue fields editable
- No approval queues or permission tables
- Server-side enforcement via relationship check (event.venue_id === venue.id)

**Geocoding Behavior:**
- If lat/lng explicitly provided → use them, set `geocode_source: 'manual'`
- Else if address fields changed → auto-geocode via Google API
- Geocoding failure never blocks save (silent fallback)
- Colorado boundary check prevents out-of-area coordinates

**Authorization Flow:**
1. Check if user is venue manager (existing `venue_managers` table)
2. Check if user is admin
3. **NEW:** Check if user is event host/cohost at this venue (`isEventHostAtVenue()`)

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/venue/geocoding.ts` | Geocoding service module with Google API integration |
| `__tests__/phase0-6-venue-host-editing.test.ts` | 34 tests for geocoding and authorization contracts |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/venue/managerAuth.ts` | Added `isEventHostAtVenue()`, expanded `canEditVenue()`, added lat/lng to MANAGER_EDITABLE_VENUE_FIELDS (now 16 fields) |
| `lib/audit/venueAudit.ts` | Added `"host"` to `actorRole` type |
| `api/venues/[id]/route.ts` | Geocoding integration, host authorization |
| `api/admin/venues/[id]/route.ts` | Geocoding integration |
| `dashboard/my-events/[id]/page.tsx` | Added "Edit Venue" link for hosts/cohosts |
| `dashboard/my-venues/[id]/page.tsx` | Added "Event Host" badge when accessing via hosting relationship |
| `__tests__/phase-abc9-venue-manager-controls.test.ts` | Updated field count from 14 to 16, added coordinate field tests |
| `__tests__/phase-abc10a-venue-audit.test.ts` | Updated for 16 fields, numeric coordinate handling |

**MANAGER_EDITABLE_VENUE_FIELDS (16 total):**
```
name, address, city, state, zip, phone, website_url, google_maps_url,
map_link, contact_link, neighborhood, accessibility_notes, parking_notes,
cover_image_url, latitude, longitude
```

**Test Coverage:** 34 new tests (2994 total).

**Investigation Doc:** `docs/investigation/phase0-6-venue-geocoding-automation-stopgate.md`

---

### Signup Time Field Visibility Fix (Phase 5.11, January 2026) — RESOLVED

**Goal:** Make the `signup_time` field visible in the event create/edit forms instead of hiding it in collapsed Advanced Options.

**Status:** Complete. All quality gates pass (lint 0, tests 2959, build success).

**Problem:** The `signup_time` field was buried inside the "Advanced Options" collapsed section, making it effectively invisible to users. Users had to expand the Advanced Options to find and set the signup time.

**Solution:** Moved the `signup_time` field from Advanced Options (Section 7) to the Schedule section, placing it directly after the End Time field where users would naturally expect to find time-related settings.

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Moved `signup_time` dropdown to Schedule section after End Time; removed duplicate from Advanced Options |

**Visibility Change:**

| Before | After |
|--------|-------|
| Hidden in collapsed Advanced Options | Prominently displayed in Schedule section |
| Required expanding Advanced Options to access | Visible by default alongside Start Time / End Time |

**No database or API changes required** — this was a UI-only fix to improve field discoverability.

---

### Signup Time Per-Occurrence Overrides (Phase 5.10, January 2026) — RESOLVED

**Goal:** Enable `signup_time` to be overridden per-occurrence, completing the signup configuration override system.

**Status:** Complete. All quality gates pass (lint 0, tests 2959, build success).

**Checked against DSC UX Principles:** §4 (Centralize Logic), §5 (Previews Match Reality)

**Problem:** While `signup_time` existed at the series level and all create/edit forms already supported it, the field was blocked from per-occurrence overrides by `ALLOWED_OVERRIDE_FIELDS`, and display surfaces didn't merge override values.

**Solution:**
1. Add `signup_time` to `ALLOWED_OVERRIDE_FIELDS` in both locations
2. Merge `override_patch.signup_time` in HappeningCard and event detail page
3. Also fix event detail to respect `override_patch.has_timeslots` (was only reading series value)

**Precedence Rules (unchanged from Phase 5.08):**
1. `has_timeslots` (override → series) === true → "Online signup"
2. Else `signup_time` (override → series) present → "Signups at {time}"
3. Else → show nothing

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/my-events/[id]/overrides/route.ts` | Added `signup_time` to ALLOWED_OVERRIDE_FIELDS |
| `lib/events/nextOccurrence.ts` | Added `signup_time` to ALLOWED_OVERRIDE_FIELDS (keep in sync) |
| `components/happenings/HappeningCard.tsx` | Added `effectiveSignupTime` merge from override_patch |
| `app/events/[id]/page.tsx` | Added `effectiveHasTimeslots` and `effectiveSignupTime` merge from override_patch |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-10-signup-time-override.test.ts` | 17 tests for allowlist, precedence, merge logic |
| `docs/investigation/phase5-10-signup-time-editing-stopgate.md` | STOP-GATE investigation document |

**Key Implementation Details:**
- Uses nullish coalescing (`??`) for string overrides (signup_time)
- Uses `!== undefined` check for boolean overrides (has_timeslots) to allow explicit `false`
- Both HappeningCard and event detail now respect per-occurrence signup configuration

**Test Coverage:** 17 new tests (2959 total).

---

### Signup Time + Online Signup Meta (Phase 5.08, January 2026) — RESOLVED

**Goal:** Add consistent signup meta display across all event surfaces with timeslots-over-signup-time precedence rule.

**Status:** Complete. All quality gates pass (lint 0, tests 2942, build success).

**Checked against DSC UX Principles:** §4 (Centralize Logic), §5 (Previews Match Reality), §12 (Test the Contract)

**Precedence Rule:**
1. `has_timeslots === true` → Display **"Online signup"** (type: `online`)
2. Else if `signup_time` present → Display **"Signups at {time}"** (type: `in_person`)
3. Else → Display nothing (`show: false`)

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/events/signupMeta.ts` | `getSignupMeta()` helper with precedence logic |
| `__tests__/phase5-08-signup-meta.test.ts` | 21 tests for helper function |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningCard.tsx` | Uses `getSignupMeta()` for chip display |
| `components/happenings/SeriesCard.tsx` | Added signupMeta chip display |
| `app/events/[id]/page.tsx` | Added `signup_time` to query, signupMeta display with emoji |
| `components/__tests__/card-variants.test.tsx` | Updated test expectations for new label format |

**Display Locations:**

| Surface | Display |
|---------|---------|
| HappeningCard | Chip: "Online signup" or "Signups at 6:30 PM" |
| SeriesCard | Chip: same format |
| Event detail | Row with emoji: 🎫 Online signup or 📝 Signups at X PM |

**Test Coverage:** 21 new tests (2942 total).

---

### Event Detail Map Actions Polish (Phase 5.07, January 2026) — RESOLVED

**Goal:** Move map action buttons (Get Directions + Venue Page) to sit directly under the venue block, and rename "View on Maps" to "Venue Page".

**Status:** Complete. All quality gates pass (lint 0, tests 2921, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §14 (Confusing = Wrong)

**Changes:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Moved map buttons from CTA row to under venue block; renamed "View on Maps" to "Venue Page" |

**Button Placement:**
- Buttons now appear after venue address/location notes, before cost info
- Container uses `data-testid="venue-map-buttons"` for DOM verification
- Smaller button size (`text-sm`, `px-3 py-1.5`) to fit under venue block

**Button Visibility:**

| Scenario | Get Directions | Venue Page |
|----------|----------------|------------|
| Venue + curated URL | ✅ Shows | ✅ Shows |
| Venue + no curated URL | ✅ Shows | ❌ Hidden |
| Online-only / custom location | ❌ Hidden (unless coords) | ❌ Hidden |
| Override venue | ✅ Uses override venue | ✅ Uses override venue |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-07-venue-map-buttons.test.ts` | 13 tests for button visibility and placement |

**Test Coverage:** 13 new tests (2921 total).

---

### UX Polish — City/State, Monthly Edit, Event Detail (Phase 5.06, January 2026) — RESOLVED

**Goal:** Fix three UX issues: A) City/state not showing on happenings cards, B) Monthly series edit missing day-of-week change, C) Event detail "Get Directions" using wrong URL format.

**Status:** Complete. All quality gates pass (lint 0, tests 2908, build success).

**Checked against DSC UX Principles:** §2 (Visibility), §7 (UX Friction), §8 (Dead States), §14 (Confusing = Wrong)

**Goal A: City/State Visibility**

**Root Cause:** PostgREST query returned venue data at `event.venues` (plural) but components expected `event.venue` (singular).

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Changed `venues!left(...)` to `venue:venues!left(...)` PostgREST alias |
| `components/happenings/HappeningsCard.tsx` | Added `city` and `state` to `overrideVenueData` type |

**Decision:** Kept `as any[]` casts with explanatory comments. Removing them would require cascading type definitions.

**Goal B: Monthly Edit Day-of-Week**

**Root Cause:** Edit mode for monthly series had no way to change the anchor date and derive a new `day_of_week`.

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Added "Anchor Date (First Event)" field to edit mode monthly section |

**Features:**
- Date picker initialized with `event.event_date`
- Shows derived weekday via `DateDayIndicator`
- Persistent amber warning when `day_of_week` changes: "This series will move to {day}s"
- Warning explains impact on future occurrences

**Goal C: Directions URL**

**Root Cause:** Event detail page used `getGoogleMapsUrl()` (search/place format) instead of `getVenueDirectionsUrl()` (directions format).

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Import `getVenueDirectionsUrl`, track `venueCity`/`venueState`, separate `directionsUrl` and `viewOnMapsUrl` |

**Changes:**
- "Get Directions" uses `getVenueDirectionsUrl()` — opens in directions mode
- "View on Maps" uses `google_maps_url` when available — opens place page
- Removed unused `getGoogleMapsUrl` function

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-06-ux-polish.test.ts` | 26 tests covering all goals |

**Test Coverage:** 26 new tests (2908 total).

**Smoke Checklist:**
1. `/happenings` — Verify city/state shows after venue name on cards
2. `/dashboard/my-events/[monthly-id]` — Change anchor date, verify warning banner
3. `/events/[id]` — Click "Get Directions", verify opens in directions mode (not search)

**Investigation Doc:** `docs/investigation/phase5-06-ux-polish-stopgate.md`

---

### Event Clarity & Host Confidence (Phase 5.04, January 2026) — RESOLVED

**Goal:** Improve event clarity with city visibility on cards and restore signup_time field for hosts.

**Status:** Complete. All quality gates pass (lint 0, tests 2863, build success).

**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States)

**Work Items Completed:**

| Part | Description |
|------|-------------|
| C | Per-occurrence venue/maps verified as already implemented (no changes needed) |
| B | Restored `signup_time` field to EventForm interface, state, UI, and API routes |
| A | Added city/state visibility to HappeningCard and SeriesCard meta lines |

**Part B: signup_time Field**

| Location | Change |
|----------|--------|
| EventForm interface | Added `signup_time?: string \| null` |
| EventForm state | Initialized with `event?.signup_time \|\| ""` |
| EventForm UI | TIME_OPTIONS dropdown in Signup section |
| EventForm payload | Added to create body |
| POST /api/my-events | Added to `buildEventInsert()` |
| PATCH /api/my-events/[id] | Added to `allowedFields` array |

**Part A: City Visibility**

| Component | Change |
|-----------|--------|
| HappeningCard | Added `getVenueCityState()` helper, updated meta line format |
| SeriesCard | Added city/state to venue interface, display in venue line |
| happenings/page.tsx | Extended overrideVenueMap to include city/state |

**Meta Line Format:** `{Time} · {Venue}, {City}, {ST} · {Cost}`

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | signup_time interface, state, field UI, payload |
| `app/api/my-events/route.ts` | signup_time in buildEventInsert |
| `app/api/my-events/[id]/route.ts` | signup_time in allowedFields |
| `components/happenings/HappeningCard.tsx` | getVenueCityState helper, meta line update, overrideVenueData interface |
| `components/happenings/SeriesCard.tsx` | city/state in venue interface, getVenueCityState helper, venue display |
| `app/happenings/page.tsx` | overrideVenueMap city/state |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-04-event-clarity.test.ts` | 19 tests covering signup_time and city formatting |

**Test Coverage:** 19 new tests (2863 total).

**Investigation Doc:** `docs/investigation/phase5-04-event-clarity-stopgate.md`

---

### Occurrence Cancellation UX (Phase 5.03, January 2026) — RESOLVED

**Goal:** Fix occurrence cancellation UX where cancelled dates disappeared from the UI, with no way to undo cancellations, and no immediate visual feedback.

**Status:** Complete. All quality gates pass (lint 0, tests 2863, build success).

**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States), §10 (Defaults)

**Bugs Fixed:**

| Bug | Before | After |
|-----|--------|-------|
| #1 Cancelled dates disappear | After refresh, cancelled occurrences vanished | Cancelled dates stay visible with red styling + ✕ prefix |
| #2 No way to undo cancellation | No "Restore" button existed | "Restore" button appears for cancelled occurrences |
| #3 No immediate UI feedback | Cancel required page refresh to see change | Optimistic UI updates immediately, reconciles with server |
| #4 Public pages show blank | Date pills disappeared for cancelled dates | Cancelled pills show with line-through + opacity + red styling |

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| Default `showCancelled=true` | Cancelled dates shouldn't silently vanish (DSC UX §8: Dead States) |
| Optimistic UI + server reconcile | Immediate feedback while ensuring data consistency |
| Include cancelled in series view | Public pages show all dates with visual cancelled indicator |
| Active occurrence count excludes cancelled | "12 upcoming" counts only non-cancelled dates |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/events/nextOccurrence.ts` | Added `isCancelled` to `ExpandedOccurrence`, changed filtering to include cancelled with flag |
| `components/happenings/DatePillRow.tsx` | Added `isCancelled` prop with red styling, line-through, ✕ prefix |
| `components/happenings/SeriesCard.tsx` | Pass `isCancelled` flag to DatePillRow |
| `app/events/[id]/page.tsx` | Cancelled styling for inline date pills |
| `dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | Default showCancelled=true, optimistic UI, useEffect sync |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase5-03-occurrence-cancellation-ux.test.ts` | 17 tests covering all parts |

**Test Coverage:** 17 new tests (2863 total).

**Investigation Doc:** `docs/investigation/phase5-03-occurrence-cancellation-ux-stopgate.md`

---

### RSVP + Timeslots Host Control & Dashboard (Phase 5.02, January 2026) — RESOLVED

**Goal:** Fix recurring events with past claims permanently locking slot configuration changes, and give hosts proper date-scoped dashboard surfaces.

**Status:** Complete. All quality gates pass (lint 0, tests 28 new, build success).

**North-Star Model:** Option 2 — Series-Level Config with Future-Only Blocking

**Hard Invariants:**
1. `date_key >= todayKey` classifies as future (today counts as future)
2. Past data is preserved — no auto-deletion of past timeslots or claims
3. No migration needed — uses existing `date_key` column

**Work Items Completed:**

| Part | Description |
|------|-------------|
| A | Fixed blocking logic: only counts claims where `date_key >= todayKey` |
| B | Future-only regeneration: preserves past timeslots, only regenerates future |
| C1 | Created `TimeslotClaimsTable` component for hosts to manage claims |
| C2 | Made `RSVPList` date-scoped for recurring events |
| C3 | Integrated TimeslotClaimsTable and date-scoped RSVPList into event edit page |
| D | Actionable error messaging with links to claims management |
| E | 28 tests covering all parts |
| F | Documentation updated |

**Files Added:**

| File | Purpose |
|------|---------|
| `app/api/my-events/[id]/claims/route.ts` | Claims API (GET lists, DELETE soft-removes) |
| `dashboard/my-events/_components/TimeslotClaimsTable.tsx` | Host-visible claims management table |
| `__tests__/phase5-02-timeslots-rsvp-host-dashboard.test.ts` | 28 tests |

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/my-events/[id]/route.ts` | Future-only blocking and regeneration logic |
| `dashboard/my-events/_components/RSVPList.tsx` | Date selector + date-scoped API fetch |
| `dashboard/my-events/_components/EventForm.tsx` | Actionable error details with links |
| `dashboard/my-events/[id]/page.tsx` | TimeslotClaimsTable + updated RSVPList props |

**Key Behavior Changes:**

| Before | After |
|--------|-------|
| ANY timeslot claim blocked slot config changes | Only FUTURE claims block changes |
| Regeneration deleted ALL timeslots | Only future timeslots regenerated |
| RSVPList showed all RSVPs for series | Date selector scopes to specific occurrence |
| Generic "signups exist" error | Actionable error with link to claims management |

**Investigation Doc:** `docs/investigation/phase5-02-timeslots-rsvp-host-dashboard-stopgate.md`

---

### Leave Event Dialog Contrast Fix (January 2026) — RESOLVED

**Goal:** Fix red-on-red text contrast issue in the "Leave Event" confirmation dialog on the edit event page.

**Problem:** The confirmation dialog for leaving an event had poor text contrast in the sunrise (light) theme. The `text-red-800` text on `bg-red-100` background was difficult to read.

**Fix:** Changed to higher contrast colors:
- Background: `bg-red-50` (lighter) instead of `bg-red-100`
- Text: `text-red-900` (darker) instead of `text-red-800`
- Amber text: `text-amber-900` instead of `text-amber-800`

**Files Modified:**

| File | Change |
|------|--------|
| `components/events/LeaveEventButton.tsx` | Updated background and text colors for better contrast |

**Quality Gates:** Lint 0, Tests 2818 passing.

---

### TV Display Manager UX Hardening (Phase 4.99, January 2026) — RESOLVED

**Goal:** Launch-blocking UX hardening for TV Display + Lineup Control to make these features "discoverable, safe, reliable, and stress-proof for hosts running a live event."

**Status:** Complete. All quality gates pass (lint 0, tests 2818, build success).

**Checked against DSC UX Principles:** §3 (Rolling Windows), §6 (Anchored Navigation), §7 (UX Friction), §8 (Dead States)

**Work Items Completed:**

| Work Item | Description |
|-----------|-------------|
| A1-A2 | Added `LineupControlSection` to `/dashboard/my-events/[id]` with date selector |
| B3-B4 | `LineupDatePicker` modal for recurring events — no silent date defaulting |
| C5-C6 | TV Display link opens in new tab + copyable display URL field |
| D7-D8 | `LineupStateBanner` showing connection health + "Last updated" timestamp |
| E9-E10 | Confirmation dialogs for "Stop Event" and "Reset Lineup" actions |
| F11 | Security fix: Co-host authorization requires `invitation_status='accepted'` |

**Files Added:**

| File | Purpose |
|------|---------|
| `hooks/useLineupPolling.ts` | Shared polling hook |
| `components/events/LineupStateBanner.tsx` | Connection health banner |
| `components/events/LineupDatePicker.tsx` | Date selection modal for recurring events |
| `components/ui/ConfirmDialog.tsx` | Generic confirmation dialog component |
| `dashboard/my-events/[id]/_components/LineupControlSection.tsx` | Dashboard lineup entry point |
| `__tests__/phase4-99-tv-display-manager.test.ts` | 51 tests covering all work items |

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/lineup/page.tsx` | Date picker integration, confirmation dialogs, connection health, security fix |
| `app/events/[id]/display/page.tsx` | Connection health banner (subtle variant) |
| `dashboard/my-events/[id]/page.tsx` | LineupControlSection integration |

**Key Features:**

- **Dashboard Entry Point:** Hosts can now access lineup control directly from `/dashboard/my-events/[id]` without navigating to the public event page
- **No Silent Defaults:** Recurring events with multiple upcoming dates require explicit date selection before controlling lineup
- **Connection Health:** Both control and display pages show real-time connection status with "Last updated" timestamps
- **Confirmation Dialogs:** Destructive actions (Stop Event, Reset Lineup) require explicit confirmation
- **Security:** Pending/rejected co-hosts can no longer access lineup control

**Investigation Doc:** `docs/investigation/phase4-99-tv-display-manager-stopgate.md`

---

### Host/Cohost Equality + Safe Guardrails (Phase 4.98, January 2026) — RESOLVED

**Goal:** Implement host/cohost equality where cohosts are equal partners operationally, with safe guardrails to prevent accidental orphaning of events.

**Status:** Complete. All quality gates pass (lint 0, tests 2767, build success).

**North-Star Rules Implemented:**
1. Cohosts have full operational control — Can invite others, edit event, leave anytime
2. Single exception — Cohost cannot remove primary host; Primary host can remove cohost
3. Auto-promotion — If primary host leaves, oldest remaining host is auto-promoted
4. No silent failures — Forbidden actions show clear UI messages
5. Admin safety net — Copy communicates admins can repair issues

**Work Items Completed:**

| Work Item | Description |
|-----------|-------------|
| A | Remove button only visible to primary hosts; API errors displayed inline |
| B | Auto-promotion when primary host leaves (oldest remaining host promoted, notification sent) |
| C | Cohosts can invite others (equal partners operationally) |
| D | Claim approval/rejection now sends notifications to claimant |
| E | Permissions help block added showing what each role can do |
| F | Leave button shows auto-promotion message for non-sole primary hosts |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-98-host-cohost-equality.test.ts` | 45 tests covering all work items |
| `docs/investigation/phase4-98-host-cohost-equality-report.md` | Final report |

**Files Modified:**

| File | Change |
|------|--------|
| `cohosts/route.ts` | Removed role="host" constraint from POST, added auto-promotion logic in DELETE, notification to promoted user |
| `CoHostManager.tsx` | Remove button visibility fix, error handling, permissions help block, Leave button for all hosts |
| `my-events/[id]/page.tsx` | Full CoHostManager for all hosts (removed read-only list for cohosts) |
| `ClaimsTable.tsx` | Added approval/rejection notifications |
| `LeaveEventButton.tsx` | Added auto-promotion message for non-sole primary hosts |

**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States), §10 (Defaults), §11 (Soft Constraints)

---

### "Why Host on DSC?" Public Page (Phase 4.96, January 2026) — RESOLVED

**Goal:** Create a public marketing page explaining hosting benefits and update invite-related UX to reference it.

**Status:** Complete. All quality gates pass (lint 0, tests 2737, build success).

**Files Added:**

| File | Purpose |
|------|---------|
| `app/host/page.tsx` | Public "Why Host on DSC?" page |
| `docs/investigation/phase4-96-host-page-stopgate.md` | STOP-GATE investigation |

**Files Modified:**

| File | Change |
|------|--------|
| `app/event-invite/page.tsx` | Added "Learn more about hosting on DSC" link |
| `app/venue-invite/page.tsx` | Added "Learn more about hosting on DSC" link |
| `dashboard/my-events/[id]/_components/EventInviteSection.tsx` | Email template includes host page URL |

**Page Sections:**

| Section | Content |
|---------|---------|
| Hero | "Host on DSC" headline with signup/browse CTAs |
| What You Get | 3 benefit cards (Manage Lineup, Track Attendance, Reach Musicians) |
| Two Ways to Host | Cards for "Create Your Own" vs "Claim Existing" |
| Lineup Display | Description of TV/projector display feature |
| FAQ | 5 common questions (cost, co-hosts, cancellations, etc.) |
| Call to Action | Signup + Browse Happenings buttons |

**Invite Page Updates:**

- Added "Learn more about hosting on DSC" link in the "requires login" state
- Link appears below the login/signup buttons
- Uses subtle tertiary text styling with underline hover

**Email Template Update:**

- EventInviteSection email template now includes: "New to hosting? Learn what to expect: {host_url}"
- URL derived from `window.location.origin` for client-side compatibility

---

### Event Invite Redirect Preservation (Phase 4.95, January 2026) — RESOLVED

**Goal:** Preserve invite token through login AND signup + onboarding flows, auto-continue invite acceptance after auth completes.

**Status:** Complete. All quality gates pass (lint 0, tests 2737, build success).

**Problem:** Invite token was lost when users needed to log in or sign up before accepting an invite. The redirect URL was dropped during onboarding.

**Solution:** localStorage-based redirect preservation with 1-hour expiry:
1. Invite pages store return URL in localStorage before redirecting to login/signup
2. Login page checks for pending redirect
3. Onboarding completion checks for pending redirect
4. Redirect is consumed (removed) when used

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/auth/pendingRedirect.ts` | localStorage helpers for redirect preservation |
| `docs/investigation/phase4-95-event-invite-redirect.md` | STOP-GATE investigation |
| `__tests__/phase4-95-event-invite-redirect.test.ts` | 16 tests |

**Files Modified:**

| File | Change |
|------|--------|
| `app/event-invite/page.tsx` | Added `requiresLogin` state, improved messaging, store pending redirect |
| `app/venue-invite/page.tsx` | Same updates for consistency |
| `app/login/page.tsx` | Consumes pending redirect |
| `app/onboarding/profile/page.tsx` | Consumes pending redirect on completion |

**Helper Functions (`lib/auth/pendingRedirect.ts`):**

| Function | Purpose |
|----------|---------|
| `setPendingRedirect(url)` | Store URL with timestamp |
| `consumePendingRedirect()` | Get and remove URL (returns null if expired) |
| `hasPendingRedirect()` | Non-destructive check |
| `clearPendingRedirect()` | Force clear |

**Expiry:** 1 hour (sufficient for signup + onboarding flow)

**Test Coverage:** 16 new tests covering storage, consumption, expiry, and integration flows.

---

### Event Invites v1 (Phase 4.94, January 2026) — RESOLVED

**Goal:** Token-based invite system for event ownership, allowing admins and primary hosts to invite users to become hosts or co-hosts of events.

**Status:** Complete. All quality gates pass (lint 0, tests 48 new, build success).

**Checked against DSC UX Principles:** §8 (Dead States), §11 (Soft Constraints)

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260127000000_event_invites.sql` | Creates `event_invites` table with token-based invite system |

**Schema:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `event_id` | UUID | FK to events |
| `token_hash` | TEXT | SHA-256 hash of invite token |
| `email_restriction` | TEXT | Optional email restriction |
| `role_to_grant` | TEXT | `'host'` or `'cohost'` |
| `expires_at` | TIMESTAMPTZ | Invite expiry |
| `accepted_at` | TIMESTAMPTZ | When accepted |
| `revoked_at` | TIMESTAMPTZ | When revoked |

**API Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/my-events/[id]/invite` | POST | Create invite (admin/primary host) |
| `/api/my-events/[id]/invite` | GET | List invites (admin/primary host) |
| `/api/my-events/[id]/invite/[inviteId]` | DELETE | Revoke invite (admin/primary host) |
| `/api/event-invites/accept` | POST | Accept invite (authenticated user) |

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260127000000_event_invites.sql` | Migration |
| `app/api/my-events/[id]/invite/route.ts` | Create + list API |
| `app/api/my-events/[id]/invite/[inviteId]/route.ts` | Revoke API |
| `app/api/event-invites/accept/route.ts` | Accept API |
| `app/event-invite/page.tsx` | Acceptance landing page |
| `dashboard/my-events/[id]/_components/EventInviteSection.tsx` | Dashboard UI |
| `__tests__/event-invites-v1.test.ts` | 48 tests |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/page.tsx` | Added EventInviteSection for admin/primary host |

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| Token stored as SHA-256 hash | Security - plaintext shown once on create |
| Service role client for accept | Bypasses RLS for token lookup |
| `role_to_grant='host'` only if `events.host_id IS NULL` | No ownership transfers in v1 |
| Email restriction validated in API | Avoids RLS auth.users permission issues |
| Acceptance survives login redirect | Token preserved in URL during auth flow |

**Authorization Matrix:**

| Action | Admin | Primary Host | Co-host | Member |
|--------|-------|--------------|---------|--------|
| Create invite | ✅ | ✅ | ❌ | ❌ |
| List invites | ✅ | ✅ | ❌ | ❌ |
| Revoke invite | ✅ | ✅ | ❌ | ❌ |
| Accept invite | ✅ | ✅ | ✅ | ✅ |

**Invite Status States:**

| State | Condition |
|-------|-----------|
| `pending` | Not accepted, not revoked, not expired |
| `accepted` | `accepted_at IS NOT NULL` |
| `revoked` | `revoked_at IS NOT NULL` |
| `expired` | `expires_at < NOW()` |

**Test Coverage:** 48 new tests covering schema, status computation, authorization, acceptance flow, URL patterns, and notifications.

---

### DSC UX Principles Document (January 2026) — ADDED

**Goal:** Establish a living reference document for UX decisions and system design principles.

**New File:** `docs/DSC_UX_PRINCIPLES.md`

**Contains 15 core principles:**
1. Primary Goal — Prevent dead-ends, preserve intent, enable recovery
2. Visibility vs Trust vs Lifecycle — Core separation of concerns
3. Rolling Windows Must Be Explained
4. Centralize Logic, Never Rebuild It
5. Previews Must Match Reality
6. Anchored Navigation Is Mandatory
7. UX Friction Is a Tool (Use It Precisely)
8. Dead States Are Unacceptable
9. Admin UX Exists to Repair, Not Control
10. Defaults Should Match the Common Case
11. Prefer Soft Constraints Over Hard Rules
12. Test the Contract, Not the Implementation
13. One Fix Per Phase
14. If Something Feels Confusing, It Probably Is
15. The North Star

**Usage:**
- Before any new feature: sanity-check against Sections 2, 4, 6, and 8
- In STOP-GATE reports: reference explicitly as "Checked against DSC UX Principles §X"
- For repo-agent prompts: say "must comply with DSC UX Principles" instead of restating intent

---

### Gallery Upload UX Tightening (Phase 4.91, January 2026) — RESOLVED

**Goal:** Reduce "unassigned photo" creation by improving the upload flow with nudges and inline awareness.

**Status:** Complete. All quality gates pass (lint 0, tests 2673, build success).

**Checked against DSC UX Principles:** §7 (UX Friction), §8 (Dead States), §10 (Defaults), §11 (Soft Constraints)

**UX Changes:**

| Change | Before | After |
|--------|--------|-------|
| Album label | "Album (optional)" | "Album (recommended)" |
| Destination visibility | None | Always shows "Uploading to: X" above dropzone |
| No album warning | None | Amber nudge banner with explanation |
| First unassigned upload | No friction | Confirm dialog with "Don't show again" checkbox |

**localStorage Key:** `dsc_gallery_unassigned_warning_dismissed_v1`

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/gallery-upload-ux-nudges.test.tsx` | 15 tests for UX behaviors |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/gallery/UserGalleryUpload.tsx` | Destination label, nudge banner, confirm dialog, label text |
| `docs/investigation/phase4-91-gallery-upload-ux-nudges.md` | Implementation report |

**Test Coverage:** 15 new tests (2673 total).

**Relationship to Phase 4.90:**
- Phase 4.90: Fixed dead-end for managing existing unassigned photos
- Phase 4.91: Reduces creation of new unassigned photos through UX friction

---

### Unassigned Photos Manager — Fix Dead-End UX (Phase 4.90, January 2026) — RESOLVED

**Goal:** Fix the dead-end UX where photos uploaded without an album became stuck with no management options.

**Status:** Complete. All quality gates pass (lint 0, tests 2658, build success).

**Problem:** Users could upload photos to `/dashboard/gallery` with no album selected (`album_id = NULL`). These "unassigned photos" appeared in a read-only thumbnail grid with text saying "Add them to an album when uploading or via the admin panel" — but users cannot access the admin panel.

**Fix:** Created `UnassignedPhotosManager` client component that mirrors the proven admin pattern from `GalleryAdminTabs`:
- Select one or many photos (click to toggle selection)
- Move selected photos to any of the user's albums (dropdown + Move button)
- Delete selected photos with confirmation dialog
- Clear selection button

**Files Added:**

| File | Purpose |
|------|---------|
| `dashboard/gallery/_components/UnassignedPhotosManager.tsx` | Client component with selection, move, delete actions |
| `__tests__/unassigned-photos-manager.test.tsx` | 21 tests covering rendering, selection, move, delete, dead-end fix |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/gallery/page.tsx` | Replaced 40-line inline dead-end section with component usage (~6 lines) |
| `docs/investigation/phase4-90-gallery-unassigned-stopgate.md` | Added STOP-GATE 2A/2B summaries |

**Key Design Decisions:**
- No RLS changes needed — existing `gallery_images_update_own` and `gallery_images_delete_own` policies allow owner operations
- No schema changes — uses existing `album_id` and `sort_order` columns
- Server component fetches data, client component handles interactivity
- Sort order assigned sequentially after existing photos in target album

**Test Coverage:** 21 new tests (2658 total).

**Investigation Doc:** `docs/investigation/phase4-90-gallery-unassigned-stopgate.md`

---

### Bulk Import v1 — CSV Event Import (Phase 4.88, January 2026) — RESOLVED

**Goal:** Admin-only bulk import of events via CSV. INSERT-only mode (no UPDATE), 500 row max, with system-enforced defaults.

**Status:** Complete. All quality gates pass (lint 0, tests 2641, build success).

**How to Use:**
1. Navigate to `/dashboard/admin/ops/events/import`
2. Download the template CSV or create one with required columns
3. Paste CSV content and click "Preview Import"
4. Review valid/invalid/duplicate rows
5. Check the confirmation box and click "Import X Events"

**CSV Schema (16 columns):**
```
title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
```

**Required columns:** `title`, `event_type`, `event_date`

**Optional columns:** All others (null values accepted)

**System-Managed Defaults (enforced, not in CSV):**
- `source = 'import'`
- `host_id = null`
- `is_published = true`
- `status = 'active'`
- `is_dsc_event = false`
- `last_verified_at = null` (unless `pre_verified=true`)

**Recurrence Rules:**
- Weekly/biweekly: `day_of_week` derived from `event_date` if not provided
- Ordinal monthly (1st, 2nd, 3rd, 4th, last, 1st/3rd, 2nd/4th): REQUIRES `day_of_week` (reject if missing)

**Deduplication:**
- Slug collision (generated slug matches existing event)
- Title/date/venue match (exact title + event_date + venue_id match)

**Venue Resolution:**
- If `venue_name` provided without `venue_id`, attempts lookup by name
- Invalid `venue_id` references cause row rejection

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/ops/eventImportParser.ts` | RFC4180-compliant CSV parser |
| `lib/ops/eventImportValidation.ts` | Row validation + day_of_week derivation |
| `lib/ops/eventImportDedupe.ts` | Duplicate detection + venue resolution |
| `lib/ops/eventImportBuilder.ts` | INSERT payload builder with system defaults |
| `api/admin/ops/events/import-preview/route.ts` | Preview endpoint (read-only) |
| `api/admin/ops/events/import-apply/route.ts` | Apply endpoint (INSERT-only) |
| `dashboard/admin/ops/events/import/page.tsx` | Admin UI |
| `__tests__/bulk-import-v1.test.ts` | 65 tests |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/audit/opsAudit.ts` | Added `events_csv_import` action type |
| `dashboard/admin/ops/events/page.tsx` | Added link to import page |

**Test Coverage:** 65 tests covering parser, validation, builder, API contracts, recurrence rules.

**Rollback Plan:**
- Events created with `source='import'` can be identified via query
- Admin can soft-delete via status='cancelled' or hard-delete if no RSVPs/claims

**Axiom Query Snippets:**
```bash
# Track import actions in last 24h
axiom query "['vercel'] | where message contains 'events_csv_import' | where _time > ago(24h) | sort by _time desc"

# Find imported events by source
# SQL: SELECT id, title, created_at FROM events WHERE source = 'import' ORDER BY created_at DESC;
```

**Investigation Doc:** `docs/investigation/phase4-88-bulk-import-stopgate.md`

---

### Image Upload Primary CTA Saves Original (Phase 4.85, January 2026) — RESOLVED

**Goal:** Make "Save original image" the primary action in all image upload/crop UIs.

**Status:** Complete. All quality gates pass (lint 0, tests 2539, build success).

**Problem:** Users who wanted to upload their original image unchanged had to look past the prominent "Save Crop" button to find "Use Original Image". This led to accidental crops and extra steps.

**Fix:**

| Component | Change |
|-----------|--------|
| `CropModal.tsx` | "Save original image" now primary (accent bg), "Save cropped image" secondary (border) |
| `ImageUpload.tsx` | "Save original image" now primary (full-width, top), "Save cropped image" secondary |

**Affected Surfaces (all inherit):** Event covers, venue photos, profile photos, blog covers, gallery bulk upload.

**Commits:** `72acec3`

---

### Recurrence Canonicalization — Server-Side day_of_week Derivation (Phase 4.83, January 2026) — RESOLVED

**Goal:** Fix Bug #1 where ordinal monthly events with missing `day_of_week` disappeared from happenings.

**Status:** Complete. All quality gates pass (lint 0, tests 2528, build success).

**Problem:**
- Lone Tree Open Mic had `recurrence_rule='4th'` but `day_of_week=NULL`
- `interpretRecurrence()` returned `isConfident=false` when day_of_week was missing
- `expandOccurrencesForEvent()` returned empty array, hiding the event from happenings
- Event should have appeared on 4th Saturdays (including Jan 24, 2026)

**Fix (Three Layers of Protection):**

| Layer | Implementation |
|-------|----------------|
| Data Repair | SQL UPDATE set `day_of_week='Saturday'` for Lone Tree Open Mic |
| Server-Side Canonicalization | API routes derive `day_of_week` from `event_date` on save |
| Defensive Fallback | `interpretRecurrence()` derives day from anchor date at render time |

**New Helper Module:** `web/src/lib/events/recurrenceCanonicalization.ts`

| Function | Purpose |
|----------|---------|
| `isOrdinalMonthlyRule()` | Checks if recurrence rule requires day_of_week |
| `deriveDayOfWeekFromDate()` | Extracts day name from YYYY-MM-DD date |
| `canonicalizeDayOfWeek()` | Main entry point — returns existing day or derives from date |

**Integration Points:**
- POST `/api/my-events` — Uses `canonicalizeDayOfWeek()` in `buildEventInsert()`
- PATCH `/api/my-events/[id]` — Uses `canonicalizeDayOfWeek()` after fetching previous event
- `interpretLegacyRule()` in `recurrenceContract.ts` — Fallback derivation at render time

**Files Modified/Created:**

| File | Change |
|------|--------|
| `lib/events/recurrenceCanonicalization.ts` | **NEW** — Server-side canonicalization helpers |
| `app/api/my-events/route.ts` | Integrated canonicalization in POST |
| `app/api/my-events/[id]/route.ts` | Integrated canonicalization in PATCH |
| `lib/events/recurrenceContract.ts` | Added defensive fallback in `interpretLegacyRule()` |
| `__tests__/recurrence-canonicalization.test.ts` | **NEW** — 19 tests for canonicalization |
| `__tests__/bug1-diagnosis.test.ts` | Updated to test FIX behavior |

**Test Coverage:** 2528 tests passing (25 new tests).

**Investigation Doc:** `docs/investigation/phase4-83-bug1-bug3-stopgate-report.md`

---

### Override Propagation + Recurrence Fix + Inline Verification (Phase 4.82, January 2026) — RESOLVED

**Goal:** Fix override patch fields not propagating to all display surfaces, fix recurrence invariant violation causing events to disappear from happenings, and fix verification status error on save.

**Status:** Complete. All quality gates pass (lint 0, tests 2503, build success).

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Override fields not rendering on public pages | HappeningCard and event detail page only applied 2 of 26 override_patch fields | Apply ALL override_patch fields: title, description, venue_id, start_time, end_time, cover_image_url, host_notes |
| Override venue_id not resolving to venue name | Venue lookup ran before override was applied; no pre-fetch for override venues | Pre-resolve venue data server-side via `overrideVenueMap`, pass as prop |
| RECURRENCE INVARIANT VIOLATION on save | Monthly/weekly events in edit mode could save with `day_of_week = null` if DB didn't have it set | Derive `day_of_week` from anchor date (`weekdayNameFromDateMT`) when not explicitly set |
| False invariant warning for bounded series | `max_occurrences = 1` with `recurrence_rule = "weekly"` legitimately produces 1 occurrence | Skip invariant check when `max_occurrences` is set and ≤ 1 |
| Verification status error on save | Separate `POST /api/admin/ops/events/bulk-verify` call after PATCH could fail due to auth differences | Moved verification inline into PATCH route via `verify_action` body field |
| Auto-publish overwriting explicit admin unverify | Auto-confirm on publish ran after explicit `verify_action: "unverify"` | Skip auto-confirm when explicit `verify_action` is present |
| Duplicate Series Settings + Event Schedule sections | Both sections visible in edit mode for recurring events | Removed duplicate section; consolidated into single Schedule section |
| Preview card shows "Every Saturday" instead of "4th Saturday" | Live preview used generic recurrence label | Preview now uses `labelFromRecurrence()` with proper ordinal labels |

**Verification Fix Details:**
- `verify_action: "verify" | "unverify"` is now sent inline with the PATCH body
- Admin-only guard: non-admin users can include the field but it's silently ignored
- `verify_action` is NOT in `allowedFields` — cannot corrupt DB through generic field loop
- Auto-publish auto-confirm respects explicit admin intent (skips when `verify_action` present)

**Recurrence Fix Details:**
- Edit mode for monthly/weekly: derives `day_of_week` from `start_date` using `weekdayNameFromDateMT()` when the form field is empty
- This self-heals events with missing `day_of_week` in the DB on next save
- Invariant guard: `if (!event.max_occurrences || event.max_occurrences > 1)` prevents false positives for intentionally bounded series

**Override Venue Resolution:**
- Happenings page pre-fetches all override venue_ids in a single query
- Builds `overrideVenueMap: Map<venueId, {name, slug, google_maps_url, website_url}>`
- Passes resolved venue data to `HappeningsCard` → `HappeningCard` as `overrideVenueData` prop
- HappeningCard uses override venue name when `override_patch.venue_id` is set

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Pre-fetch override venue data, pass overrideVenueData to cards |
| `components/happenings/HappeningCard.tsx` | Apply all override_patch fields, use overrideVenueData for venue name |
| `components/happenings/HappeningsCard.tsx` | Added overrideVenueData prop pass-through |
| `app/events/[id]/page.tsx` | Apply all override_patch fields, re-fetch venue on venue_id override |
| `dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | Show rescheduled display date as primary label |
| `dashboard/my-events/_components/EventForm.tsx` | Derive day_of_week from anchor, inline verify_action, fix duplicate sections, fix preview label |
| `app/api/my-events/[id]/route.ts` | Handle `verify_action` inline (admin-only), auto-publish respects explicit verify |
| `lib/events/nextOccurrence.ts` | Skip invariant for bounded series |

**Test Coverage:** 2503 tests passing.

---

### Occurrence Rescheduling — Timeline + Series + Editor Display (January 2026) — RESOLVED

**Goal:** When a host changes an occurrence's date via `override_patch.event_date`, the system shows the occurrence on its new date in the timeline, series card pills, and OccurrenceEditor with proper reschedule indicators.

**Status:** Complete.

**Key Design Principle:**
- `date_key` = IDENTITY (never changes) — used in URLs, RSVPs, comments, override row PK
- `override_patch.event_date` = DISPLAY date — where the occurrence appears in the timeline
- Links always use `date_key` for routing; visual display uses the override `event_date` for placement

**New Functions in `nextOccurrence.ts`:**

| Function | Purpose |
|----------|---------|
| `applyReschedulesToTimeline()` | Post-processes expanded groups: moves entries from original date group to rescheduled date group |
| `getDisplayDateForOccurrence()` | Returns display date + isRescheduled flag from override |

**Extended Interfaces:**

| Interface | New Fields |
|-----------|-----------|
| `ExpandedOccurrence` | `displayDate?`, `isRescheduled?` |
| `EventOccurrenceEntry` | `isRescheduled?`, `originalDateKey?`, `displayDate?` |
| `DatePillData` | `isRescheduled?` |

**UI Indicators:**

| Surface | Indicator |
|---------|-----------|
| DatePillRow | ↻ prefix + amber styling for rescheduled pills |
| SeriesCard | Uses `displayDate` for labels, `dateKey` for hrefs |
| OccurrenceEditor | RESCHEDULED status pill (indigo) + "→ New Date" text |
| Event detail page | Amber pills with ↻ for rescheduled occurrences |

**Conflict Detection (EventForm):**
- When rescheduling, checks both series pattern dates AND other override reschedule targets
- Shows amber warning: "This occurrence will be rescheduled from X to Y"
- Shows conflict warning if target date already has an occurrence

**Server-Side Validation (`/api/my-events/[id]/overrides`):**
- Validates `event_date` format (YYYY-MM-DD)
- Strips pointless reschedules (new date = same as date_key)
- Rejects past dates

**Key Invariants:**
1. `date_key` never changes — identity for RSVPs, comments, URLs, override PK
2. Links always use `date_key` — `?date=2026-01-18` even if display shows Feb 1
3. `expandOccurrencesForEvent()` stays pure — never knows about overrides
4. Post-processing (`applyReschedulesToTimeline`) is the only reschedule-aware layer
5. Cancelled > Rescheduled — if both, treat as cancelled

**Files Modified:**

| File | Change |
|------|--------|
| `lib/events/nextOccurrence.ts` | Added `applyReschedulesToTimeline()`, `getDisplayDateForOccurrence()`, extended interfaces |
| `app/happenings/page.tsx` | Call post-processing after expansion, use rescheduled groups for filtering |
| `components/happenings/DatePillRow.tsx` | Added `isRescheduled` to interface, ↻ indicator + amber styling |
| `components/happenings/SeriesCard.tsx` | Use displayDate for labels, dateKey for hrefs |
| `app/events/[id]/page.tsx` | Reschedule-aware date pills + display date for selected occurrence |
| `dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | RESCHEDULED pill + "→ date" indicator |
| `dashboard/my-events/_components/EventForm.tsx` | Occurrence date input, conflict detection, reschedule preview text |
| `dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` | Conflict detection with other reschedule targets |
| `api/my-events/[id]/overrides/route.ts` | Server-side date validation for reschedules |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/occurrence-reschedule.test.ts` | 27 tests for timeline moves, display dates, validation, status priority, round-trips |

**Test Coverage:** 27 new tests (2503 total).

---

### Edit Form Date/Recurrence Fix + Day-of-Week Indicator (January 2026) — RESOLVED

**Goal:** Fix one-time mode save not clearing recurrence fields, remove duplicate date field, and add day-of-week confirmation indicator to all date inputs.

**Status:** Complete.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Saving as one-time still shows "Every Saturday" | `day_of_week` not cleared for single mode in submit handler | Only keep `day_of_week` for weekly/monthly; null for single/custom |
| Recurrence card shows stale pattern after mode change | `is_recurring` column not updated on save | Added `is_recurring` to PATCH allowedFields; form sends `false` for single mode |
| Duplicate Event Date fields in form | Section 3a (edit-mode date) + Section 3b (schedule section) both visible | Removed Section 3a; consolidated all dates into schedule section |
| Date inputs don't confirm day of week | No visual feedback for which day a selected date falls on | Added `DateDayIndicator` component showing derived day name |
| Edit mode date inputs empty | `start_date` initialized to `""` instead of event's `event_date` | Initialize `start_date` from `event.event_date` |

**DateDayIndicator Component:**
- Shows derived day name (e.g., "Saturday") in accent color next to the date label
- Blank when no date is entered, updates dynamically when date changes
- Applied to: single mode, weekly mode, monthly mode date inputs
- Custom date pills now show weekday abbreviation (e.g., "Sat, Jan 24")

**Submit Handler Fix (line 522):**
```typescript
// Before: Only cleared for custom mode
effectiveDayOfWeek = formData.series_mode === "custom" ? null : (formData.day_of_week || null);

// After: Only preserved for recurring modes
effectiveDayOfWeek = (formData.series_mode === "weekly" || formData.series_mode === "monthly")
  ? (formData.day_of_week || null)
  : null;
```

**Files Modified:**

| File | Change |
|------|--------|
| `EventForm.tsx` | DateDayIndicator, removed Section 3a, start_date init, submit fixes, is_recurring in body |
| `api/my-events/[id]/route.ts` | Added `is_recurring` to allowedFields |

**Commits:** `0e0ef0d`

---

### Edit Form Series Type Selector + Contrast Audit (January 2026) — RESOLVED

**Goal:** Allow hosts/admins to change an existing happening's series type (One-time, Weekly, Monthly, Custom Dates) from the edit form, and fix all remaining low-contrast text across both themes.

**Status:** Complete.

**Series Type Selector in Edit Mode:**

| Change | Implementation |
|--------|----------------|
| Selector visibility | Changed from `mode === "create"` only to all non-occurrence modes |
| Condition | `{!occurrenceMode && (` — shows in both create and edit |
| Occurrence override protection | `occurrenceMode={true}` hides series options in per-date editor |
| Mode switching warning | Amber banner warns about orphaned RSVPs/overrides when changing type |
| custom_dates clearing | Sends `null` in edit mode when switching away from custom |
| API support | PATCH route handles `custom_dates: null` to clear column |

**Series Mode Initialization (Edit Mode):**

| recurrence_rule | Detected Mode |
|----------------|---------------|
| `"weekly"` / `"biweekly"` | weekly |
| `"custom"` | custom |
| `"2nd"` / `"1st/3rd"` / etc. | monthly |
| `null` / missing | single |

**Data Safety:** Saving without changing the series type rebuilds the exact same `recurrence_rule` from the initialized state. No unintended data mutations.

**Orphan Behavior:** When switching series types, past RSVPs/comments/overrides for dates no longer generated remain in the DB but become invisible (expected trade-off of single-row model).

**Dual-Theme Contrast Fixes (11 files):**

All instances of `text-*-400` used without light-mode counterparts now use `text-*-800 dark:text-*-400`:

| File | Fix |
|------|-----|
| `auth/reset/page.tsx` | Error + success message banners |
| `newsletter-signup.tsx` | Status message text |
| `NewsletterSection.tsx` | Status message text |
| `EventUpdateSuggestionsTable.tsx` | Error text + suggested value |
| `VenueDiffTable.tsx` | Update count + not-found text |
| `EventDiffTable.tsx` | Not-found count |
| `OverrideDiffTable.tsx` | Event ID count + status colors |
| `ProfileCompleteness.tsx` | Low completion percentage |
| `DashboardProfileCard.tsx` | Low completion percentage |
| `dashboard/page.tsx` | Auth error text |
| `studio-appointments/page.tsx` | Auth error text |

**Correct Dual-Theme Pattern:**
- Light mode: `text-red-800` / `text-amber-800` / `text-green-800`
- Dark mode: `dark:text-red-400` / `dark:text-amber-400` / `dark:text-green-400`
- Background: `bg-*-100 dark:bg-*-500/10`
- Border: `border-*-300 dark:border-*-500/30`

**Acceptable exceptions (not fixed):**
- Required field asterisks (`<span className="text-red-400">*</span>`) — small decorative characters
- Image overlay badges (`bg-black/50` backdrop ensures contrast)
- `text-amber-500` / `text-emerald-500` for percentage indicators (medium brightness, acceptable on both themes)

**Commits:** `ea1ee4d`, `5b87458`, `fe10bea`

---

### Override Patch Rendering Fix + Legacy Admin Form Redirect (January 2026) — RESOLVED

**Goal:** Fix per-occurrence override_patch fields not displaying on public pages; eliminate legacy admin edit forms causing form drift between accounts.

**Status:** Complete.

**Problem 1: Override patch fields not rendering**
The occurrence editor correctly saved all override_patch fields (venue_id, description, end_time, title, cover_image_url, etc.) to the database, but public-facing pages only applied `start_time` and `cover_image_url` from the patch. All other fields reverted to base event values.

**Root Cause:** Event detail page extracted only 2 fields from override_patch. Venue lookup ran BEFORE the override was fetched, so overridden venue_id was never used.

**Problem 2: Legacy admin edit form**
The admin edit page at `/dashboard/admin/events/[id]/edit` used a legacy `EventEditForm` with basic dropdowns, missing all modern features (occurrence overrides, series controls, full field set). Admins reaching this page via bookmarks saw different forms than the canonical editor.

**Fix:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Apply ALL override_patch fields: title, description, end_time, venue_id (with re-fetch), cover_image_url, host_notes; pass `displayStartTime` to TimeslotSection |
| `components/happenings/HappeningCard.tsx` | Read `override_patch` for start_time, cover_image_url precedence over legacy columns |
| `admin/events/[id]/edit/page.tsx` | Replaced with server-side redirect to `/dashboard/my-events/[id]` |
| `admin/events/new/page.tsx` | Replaced with server-side redirect to `/dashboard/my-events/new` |

**Override Rendering Priority (event detail page):**
1. `override_patch.field` (highest priority)
2. Legacy override columns (`override_start_time`, `override_cover_image_url`, `override_notes`)
3. Base event field (fallback)

**Venue Override Behavior:**
When `override_patch.venue_id` differs from base event, the detail page re-fetches venue details (name, address, slug, maps URL, website) and updates all display variables.

**Admin Form Redirect Rule:** `/dashboard/admin/events/[id]/edit` and `/dashboard/admin/events/new` are intentional server-side redirects. The canonical editor is the ONLY supported path for happening editing. Do NOT reintroduce admin-specific edit forms.

**Dead Code (not deleted, orphaned by redirects):**
- `admin/events/[id]/edit/EventEditForm.tsx` — Legacy form component
- `admin/events/new/EventCreateForm.tsx` — Legacy create form component

---

### Admin Override Modal Removal + Canonical Redirect (January 2026) — RESOLVED

**Goal:** Eliminate the legacy 4-field admin override modal and make all occurrence edits use the full canonical EventForm occurrence editor.

**Status:** Complete.

**Problem:** The admin overrides page at `/dashboard/admin/events/[id]/overrides` used `OccurrenceOverrideModal` which only edited 4 legacy fields (status, override_start_time, override_cover_image_url, override_notes). It bypassed the `override_patch` JSONB system and the API route's server-side allowlist validation.

**Fix:**
- Admin overrides page now server-side redirects to `/dashboard/my-events/[id]/overrides`
- All "Edit" actions navigate to the full per-date EventForm editor (26-field override_patch)
- Deleted dead code: `OccurrenceOverrideModal.tsx`, `OccurrenceOverrideList.tsx`

**Files Deleted:**

| File | Reason |
|------|--------|
| `admin/events/[id]/overrides/_components/OccurrenceOverrideModal.tsx` | Dead code — replaced by canonical EventForm |
| `admin/events/[id]/overrides/_components/OccurrenceOverrideList.tsx` | Dead code — admin page redirects before rendering |

**Files Modified:**

| File | Change |
|------|--------|
| `admin/events/[id]/overrides/page.tsx` | Replaced 213-line page with 23-line server-side redirect |

**Commits:** `77ce7fa`

---

### Occurrence Mode Form — Per-Date Field Overrides (January 2026) — RESOLVED

**Goal:** Allow hosts/admins to edit nearly all canonical event fields per-occurrence using the same EventForm in a new "occurrence" mode, stored as `override_patch` JSONB.

**Status:** Complete and deployed.

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260125000000_add_override_patch.sql` | Add `override_patch JSONB NULL` column + GIN index to `occurrence_overrides` |

**Override System (Complete):**

| Override Type | Column | Behavior |
|---------------|--------|----------|
| Cancel single date | `status = 'cancelled'` | Date hidden from public listings |
| Hide single date | `override_patch.is_published = false` | Date hidden from public |
| Modify fields | `override_patch = {key: value}` | Per-occurrence field changes |
| Legacy time override | `override_start_time` | Backward-compatible time change |
| Legacy flyer override | `override_cover_image_url` | Backward-compatible image |
| Legacy notes | `override_notes` | Backward-compatible notes |

**Canonical Merge Function:** `applyOccurrenceOverride()` in `web/src/lib/events/nextOccurrence.ts`
- Applies legacy columns first, then overlays `override_patch` keys
- Only allowlisted keys applied (enforced by `ALLOWED_OVERRIDE_FIELDS` set)
- Patch takes precedence over legacy columns when both set
- Returns new object (never mutates base event)

**ALLOWED_OVERRIDE_FIELDS** (`web/src/lib/events/nextOccurrence.ts`):
```
title, description, start_time, end_time, venue_id, location_mode,
custom_location_name, custom_address, custom_city, custom_state,
online_url, location_notes, capacity, has_timeslots, total_slots,
slot_duration_minutes, is_free, cost_label, signup_url, signup_deadline,
age_policy, external_url, categories, cover_image_url, host_notes, is_published
```

**Blocked Fields (series-level, never per-occurrence):**
`event_type`, `recurrence_rule`, `day_of_week`, `custom_dates`, `max_occurrences`, `series_mode`, `is_dsc_event`

**UI Routes:**

| Route | Purpose |
|-------|---------|
| `/dashboard/my-events/[id]/overrides` | Host/admin occurrence list (cancel/restore/edit) — CANONICAL |
| `/dashboard/my-events/[id]/overrides/[dateKey]` | Per-date edit using EventForm in occurrence mode — CANONICAL |
| `/dashboard/admin/events/[id]/overrides` | Server-side redirect to canonical list (intentional) |

**Admin Overrides Redirect Rule:** The admin overrides page is intentionally a server-side `redirect()`. The canonical per-date editor is the ONLY supported path for occurrence editing. Do NOT reintroduce an admin-specific occurrence editor — all occurrence edits must flow through the canonical EventForm occurrence mode.

**API Route:** `GET/POST/DELETE /api/my-events/[id]/overrides`
- Auth: event owner, accepted host, or admin
- POST: Upserts override with `date_key`, `status`, legacy columns, and/or `override_patch`
- Server-side sanitizes patch against ALLOWED_OVERRIDE_FIELDS
- Auto-deletes row when all fields empty (revert behavior)

**EventForm Occurrence Mode:**
- Props: `occurrenceMode`, `occurrenceDateKey`, `occurrenceEventId`
- Hides: event type, day of week, series controls, publish section, live preview
- Submit: Builds diff against base event, sends only changed keys as `override_patch`

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260125000000_add_override_patch.sql` | Migration |
| `web/src/app/api/my-events/[id]/overrides/route.ts` | API route |
| `web/src/app/(protected)/dashboard/my-events/[id]/overrides/page.tsx` | Occurrence list page |
| `web/src/app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | Editor component |
| `web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` | Per-date edit page |
| `web/src/__tests__/override-patch-merge.test.ts` | 20 tests for merge function |

**Files Modified:**

| File | Change |
|------|--------|
| `web/src/lib/events/nextOccurrence.ts` | Added `override_patch` to type, `ALLOWED_OVERRIDE_FIELDS`, `applyOccurrenceOverride()` |
| `web/src/components/events/SeriesEditingNotice.tsx` | Link to host occurrence editor (was admin-only) |
| `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx` | `showOverrideLink` for hosts (not just admins) |
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | Occurrence mode props + diff submit |

**Test Coverage:** 20 new tests (2455 total).

---

### Custom Date Series → Single-Row Model (January 2026) — RESOLVED

**Goal:** Fix custom-date series creating N independent DB rows instead of one series identity, causing inconsistent publish/verify state and no occurrence expansion.

**Status:** Complete and deployed.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Custom series = N independent rows | Create API looped over dates, creating one row per date | Single row with `recurrence_rule='custom'` + `custom_dates TEXT[]` |
| Only one row published | PATCH not series-aware; user published one, rest stayed draft | Single row = single publish state |
| Admin edit used legacy form | EventSpotlightTable linked to `/dashboard/admin/events/${id}/edit` | Changed to canonical `/dashboard/my-events/${id}` |
| No occurrence expansion | No expansion logic for custom dates | Added Case 2a in `expandOccurrencesForEvent()` |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260124000000_custom_dates_single_row.sql` | Add `custom_dates TEXT[]`, expand status CHECK to include `'duplicate'`, trigger update, retroactive conversion |

**Retroactive Migration:**
- 1 legacy series found: "Barrels and Bottles Open Mic" (12 rows, shared `series_id`)
- Canonical row promoted: `recurrence_rule='custom'`, `custom_dates=[12 dates]`, `series_id=NULL`
- 11 siblings soft-retired: `status='duplicate'`, `is_published=false` (rows preserved for FK safety)
- Total events unchanged: 94

**Single-Row Custom Dates Model:**

| Field | Value |
|-------|-------|
| `recurrence_rule` | `'custom'` |
| `custom_dates` | `TEXT[]` array of `YYYY-MM-DD` date strings |
| `event_date` | First date in array (anchor) |
| Expansion | `expandOccurrencesForEvent()` reads from `custom_dates` array |
| Max dates | 12 per event (validated in API) |

**Files Modified:**

| File | Change |
|------|--------|
| `components/admin/EventSpotlightTable.tsx` | Admin edit link → canonical form |
| `app/api/my-events/route.ts` | Single-row creation + `custom_dates` in insert |
| `app/api/my-events/[id]/route.ts` | Added `custom_dates` to PATCH allowedFields |
| `lib/events/recurrenceContract.ts` | `"custom"` frequency + interpretation + label |
| `lib/events/nextOccurrence.ts` | `custom_dates` in interface + expansion + next occurrence |
| `__tests__/custom-dates-api.test.ts` | Updated 7 tests for single-row expectations |

**Commits:** `7b970b0`

---

### Theme Auto Mode Fix (January 2026) — RESOLVED

**Goal:** Fix "Auto" theme option so it actually follows OS light/dark preference.

**Status:** Complete.

**Root Cause:** When user selected "Auto" in ThemePicker, localStorage stored `"auto"` as the value. On page load, both the inline pre-hydration script and ThemeInitializer set `data-theme="auto"` on the `<html>` element — which matched no CSS selector in `presets.css`. The CSS fallback (`@media (prefers-color-scheme: light) { :root:not([data-theme]) }`) only activates when `data-theme` is **absent**, so Auto mode was broken.

**Fix:** Both the inline script and ThemeInitializer now treat `"auto"` as "remove the `data-theme` attribute", allowing the CSS `@media (prefers-color-scheme)` rules to take effect naturally.

**Behavior:**

| Stored Value | Behavior |
|-------------|----------|
| `"auto"` | `data-theme` removed; CSS media query follows OS preference |
| `"night"` | `data-theme="night"` set; OS changes ignored |
| `"sunrise"` | `data-theme="sunrise"` set; OS changes ignored |
| `null` (no preference) | SSR default applied; CSS handles OS preference |

**Files Modified:**

| File | Change |
|------|--------|
| `app/layout.tsx` | Inline script treats `"auto"` as remove-attribute |
| `components/ui/ThemeInitializer.tsx` | Same: `"auto"` removes `data-theme` |

---

### Canonical Create Happening Entry Point (January 2026) — RESOLVED

**Goal:** Make `/dashboard/my-events/new` the single canonical "create happening" form entry point from all dashboards.

**Status:** Complete.

**Problem:** Multiple "create happening" CTAs across dashboards pointed to different forms (admin-only `EventCreateForm` at `/dashboard/admin/events/new`, public submission form at `/submit-open-mic`). The canonical form at `/dashboard/my-events/new` already handles all roles (admin, host, member) via `canCreateDSC` and `canCreateVenue` props.

**Fix:** Updated two CTAs to point to the canonical form.

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/admin/events/page.tsx` | "+ Add New Happening" → `/dashboard/my-events/new` (was `/dashboard/admin/events/new`) |
| `app/happenings/page.tsx` | "+ Add Open Mic" (open_mic filter) → `/dashboard/my-events/new` (was `/submit-open-mic`) |

**Unchanged:**
- "Correction" button on happenings page still links to `/submit-open-mic` (different purpose)
- All other `/submit-open-mic` references unchanged (community submission/correction tool)
- Old routes remain accessible via direct URL (not removed)

---

### OG Image Redesign: Stronger DSC Branding + Improved Readability (January 2026) — RESOLVED

**Goal:** Redesign OG (Open Graph) social sharing images with image-dominant layout, stronger branding, and readable badges at thumbnail scale.

**Status:** Complete and deployed.

**Layout (1200x630):**
- Image Zone (top 400px): entity image fills top ~63%
- Content Bar (bottom 230px): card-spotlight gradient with title/subtitle/chips

**Design Features:**

| Element | Size | Position |
|---------|------|----------|
| Kind badge (event type) | 48px bold | Top-left on image |
| DSC wordmark | 24px gold | Top-right with dark scrim |
| Date/time overlay | 44px bold | Bottom-left on image |
| City label | 22px | Bottom-right on image |
| Title | 40-52px (length-based) | Content bar |
| Subtitle | 24px | Content bar |
| Chips | 18px gold pills | Content bar |

**Entity-Specific Behavior:**

| Entity | Extra Props |
|--------|-------------|
| Event | dateOverlay (series pattern or one-time date + time), cityLabel (venue city/state) |
| Venue | cityLabel (city/state), subtitle with neighborhood |
| Blog | Author avatar + name (only when real author exists) |
| Gallery | Creator name, venue city in subtitle |
| Songwriter | Genres as chips |

**Files Modified:**

| File | Change |
|------|--------|
| `og/_shared/ogCard.tsx` | Complete v2 layout with image zone + content bar |
| `og/event/[id]/route.tsx` | Venue FK join for city, recurrence labels, dateOverlay, cityLabel |
| `og/venue/[id]/route.tsx` | imageFit: cover, cityLabel, subtitle with pin emoji |
| `og/blog/[slug]/route.tsx` | Author only shown when full_name exists |
| `og/gallery/[slug]/route.tsx` | Creator join, venue city in subtitle |
| `__tests__/og-metadata.test.ts` | 6 venue OG regression tests added |

**Commits:** `6ec5964`, `54d5dd6`, `2f15346`, `1d81118`

---

### Single-Row Weekly Series + max_occurrences (January 2026) — RESOLVED

**Goal:** Fix misleading "Number of Events" dropdown for weekly series and add proper series end control.

**Status:** Complete and deployed.

**Problem:** The weekly series form had a "Number of Events" dropdown that created N DB rows, but occurrence expansion ignored row count and expanded indefinitely within a 90-day window. The dropdown was effectively cosmetic.

**Solution:**
1. Weekly series now creates a single DB row (matching monthly pattern) with `recurrence_rule = "weekly"`
2. New `max_occurrences` column controls series length
3. Form UI replaced with radio choice: "No end date (ongoing)" vs "Ends after X occurrences"

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260123200000_add_max_occurrences.sql` | Add nullable `max_occurrences` integer column to events |

**Behavior:**

| Setting | DB Value | Expansion Behavior |
|---------|----------|-------------------|
| No end date (ongoing) | `max_occurrences = NULL` | Expands indefinitely within 90-day window |
| Ends after N occurrences | `max_occurrences = N` | Stops after N occurrences from anchor date |

**Backward Compatibility:**
- Existing multi-row series (created before this change) continue working — `interpretRecurrence()` returns `isRecurring: true` for any event with `day_of_week` set
- Existing events have `max_occurrences = NULL` (infinite, preserving current behavior)
- No data migration needed

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Radio UI for series end mode (no end date vs finite) |
| `app/api/my-events/route.ts` | Single-row creation, server-side `recurrence_rule` enforcement, `max_occurrences` in insert |
| `app/api/my-events/[id]/route.ts` | Added `max_occurrences` to PATCH allowed fields |
| `lib/events/nextOccurrence.ts` | `max_occurrences` in interface, `computeSeriesEndDate()`, expansion limiting |

**Key Implementation Details:**
- `computeSeriesEndDate()` calculates the effective end date based on anchor + max_occurrences
- Expansion stops at whichever is earlier: 90-day window end or series end date
- Weekly: `(maxOccurrences - 1) * 7` days from anchor
- Biweekly: `(maxOccurrences - 1) * 14` days from anchor
- Monthly: `maxOccurrences * 35` days from anchor (generous window)

**Test Coverage:** Updated tests in `custom-dates-api.test.ts` and `series-creation-rls.test.ts` to assert single-row behavior.

---

### Edit Form Series Controls + Save Button UX (January 2026) — RESOLVED

**Goal:** Add full series controls (ordinal checkboxes, series length) to the edit form for recurring events, and move the Save button to the top of the form for immediate access.

**Status:** Complete and deployed.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Save button buried in middle of form | Placed inside Section 8 (Publish) | Moved to very top of form, above Event Type |
| No series controls on edit form | Monthly ordinal + series length only in create mode | Added "Series Settings" section in edit mode |
| Edit save wiped recurrence_rule | Submit used series_mode="single" (default) in edit | Derive series_mode from event.recurrence_rule |
| Day of Week wrong for monthly events | Independent dropdown allowed mismatch with date | Hidden for monthly; derived from date picker |
| selectedOrdinals not initialized | Hardcoded to [1] regardless of event data | Parse from recurrence_rule (e.g., "3rd" → [3]) |
| max_occurrences not sent on edit | Body didn't include it | Added to PATCH payload |

**Edit Form Layout (New):**

```
[Save Changes] [Back without saving]     ← TOP of form
────────────────────────────────────
Event Type cards
Categories
Title
Schedule (Day of Week for weekly only, Start/End time)
Series Start Date (edit mode)
Series Settings (edit mode, recurring only):
  - Ordinal checkboxes (monthly): 1st, 2nd, 3rd, 4th, Last
  - Pattern summary: "3rd Thursday of the month"
  - Series Length: No end date / Ends after N occurrences
Location
Description / Cover Image
Attendance (RSVP/Slots)
Advanced Options (collapsed)
Publish toggle + Verify checkbox
Preview card
"Scroll up to save" hint                  ← BOTTOM of form
```

**Series Mode Detection (Edit Mode):**

| recurrence_rule | Detected Mode | Controls Shown |
|----------------|---------------|----------------|
| `"weekly"` / `"biweekly"` | weekly | Day of Week dropdown + Series Length |
| `"3rd"` / `"1st/3rd"` / etc. | monthly | Ordinal checkboxes + Pattern summary + Series Length |
| `null` / missing | single | Event Date only |

**Ordinal Parsing (recurrence_rule → selectedOrdinals):**

| Input | Parsed |
|-------|--------|
| `"3rd"` | `[3]` |
| `"1st/3rd"` | `[1, 3]` |
| `"2nd/4th"` | `[2, 4]` |
| `"last"` | `[-1]` |
| `"1st/3rd/last"` | `[1, 3, -1]` |

**Recurrence Rule Rebuild (selectedOrdinals → recurrence_rule on save):**

| Ordinals | Output |
|----------|--------|
| `[3]` | `"3rd"` |
| `[1, 3]` | `"1st/3rd"` |
| `[2, -1]` | `"2nd/last"` |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Save at top, series controls in edit mode, ordinal parsing, submit rebuild, Day of Week visibility |

**Test Coverage:** 59 new tests in `__tests__/edit-form-series-controls.test.ts`

| Test Category | Tests |
|---------------|-------|
| Ordinal parsing from recurrence_rule | 13 |
| Recurrence rule rebuild from ordinals | 8 |
| Series mode detection | 7 |
| max_occurrences conversion | 6 |
| Day of Week visibility rules | 7 |
| Occurrence count initialization | 5 |
| Round-trip (parse → rebuild) | 6 |
| Edit mode body construction | 7 |

---

### Feedback Screenshot Support (January 2026) — RESOLVED

**Goal:** Allow users to attach screenshots to feedback submissions via paste or file upload.

**Status:** Complete and deployed.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Clipboard paste | Paste images directly into description textarea |
| File upload | Click to upload PNG/JPG files |
| Max 2 attachments | Per submission limit enforced client + server |
| Max 5MB per file | Size validation on both client and server |
| PNG/JPG only | MIME type validation |
| Private storage | `feedback-attachments` bucket, admin-only access |
| Signed URLs | 7-day expiry for admin viewing |
| Email links | Screenshot links in admin notification email |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260121200000_feedback_attachments.sql` | Add `attachments text[]` column, create private storage bucket, storage policies |

**Storage Policies:**

| Policy | Access |
|--------|--------|
| Upload | Anyone (public feedback form) |
| View/Download | Admin only (via signed URLs) |
| Delete | Admin only |

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260121200000_feedback_attachments.sql` | Migration |
| `web/src/__tests__/feedback-screenshot-support.test.ts` | 18 tests |

**Files Modified:**

| File | Change |
|------|--------|
| `app/feedback/page.tsx` | Paste handler, file upload UI, thumbnail previews, FormData submission |
| `app/api/feedback/route.ts` | Multipart form parsing, attachment validation, storage upload, signed URLs |
| `lib/email/templates/feedbackNotification.ts` | Attachments section in HTML and plain text |

**UI Flow:**
1. User pastes image or clicks "Add Screenshot" button
2. Thumbnail preview appears below textarea with remove button
3. On submit, files uploaded to Supabase Storage
4. Signed URLs generated and stored in `feedback_submissions.attachments`
5. Admin notification email includes clickable screenshot links

**Backward Compatibility:**
- Existing feedback flow unchanged (attachments optional)
- Honeypot and rate limiting preserved
- All form validation unchanged

**Test Coverage:** 18 new tests (2334 total).

---

### Auto-Confirmation on Republish + Draft Banner Fix (January 2026) — RESOLVED

**Goal:** Fix two bugs: (1) Republishing an event did not auto-confirm it, (2) Draft banner persisted after publishing.

**Status:** Complete.

**Bug 1: Republish Not Confirming Events**

**Root Cause:** The PATCH route in `my-events/[id]/route.ts` only set `last_verified_at` when `!prevEvent?.published_at` (first publish). When an event was unpublished and republished, `published_at` still had a value from the first publish, so auto-confirmation didn't trigger.

**Fix:** Changed logic to check `wasPublished` (current `is_published` state) instead of `published_at`. Now auto-confirms whenever transitioning from unpublished → published:
```typescript
// Before: Only on first publish
if (!prevEvent?.published_at) { updates.last_verified_at = now; }

// After: On any publish (including republish)
if (!wasPublished) { updates.last_verified_at = now; }
```

**Bug 2: Draft Banner Persistence**

**Root Cause:** `CreatedSuccessBanner` used URL params (`?status=draft`) to determine draft state, but URL params don't update after form save. The banner showed stale "draft" status even after publishing.

**Fix:** Changed to use actual event state (`!event.is_published`) instead of URL params:
```typescript
// Before: Used stale URL params
<CreatedSuccessBanner isDraft={status === "draft"} ... />

// After: Uses current event state
<CreatedSuccessBanner isDraft={!event.is_published} ... />
```

**Bug 3: PublishButton Bypassing API Auto-Confirm**

**Root Cause:** The PublishButton component directly updated Supabase, bypassing the API route's auto-confirm logic. It only set `is_published` and `status`, but NOT `last_verified_at`.

**Fix:** Added `last_verified_at` to PublishButton's update payload when publishing:
```typescript
if (!isPublished) {
  updates.status = "active";
  updates.last_verified_at = new Date().toISOString(); // Auto-confirm
}
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/my-events/[id]/route.ts` | Check `wasPublished` instead of `published_at` for auto-confirm |
| `dashboard/my-events/[id]/page.tsx` | Use `event.is_published` instead of URL params for banner |
| `dashboard/my-events/[id]/_components/PublishButton.tsx` | Set `last_verified_at` when publishing |

**Test Coverage:** All 2308 tests passing.

---

### Four Series Modes + Monthly Ordinal Patterns (January 2026) — RESOLVED

**Goal:** Enable flexible event scheduling with four modes: single, weekly, monthly ordinal patterns, and custom dates. Improved UX with card-style selection and clear descriptions.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Four series modes | `single`, `weekly`, `monthly`, `custom` |
| Monthly ordinal patterns | Support for "1st & 3rd Sunday", "2nd/4th Tuesday" etc. |
| Card-style mode selection | Large cards with title + description for better UX |
| Ordinal checkboxes | Multi-select for 1st, 2nd, 3rd, 4th, 5th, Last |
| Auto-confirmation | Non-admin events auto-confirmed on first publish |
| Date timezone fix | All date parsing uses `T12:00:00Z` to avoid off-by-one errors |

**Series Mode Details:**

| Mode | DB Behavior | Description |
|------|-------------|-------------|
| `single` | 1 DB row, no recurrence | A single happening on one date |
| `weekly` | N DB rows (2-12), linked by `series_id` | Same day each week (e.g., every Tuesday) |
| `monthly` | 1 DB row with `recurrence_rule` (e.g., "1st/3rd") | Specific weeks each month (e.g., 1st & 3rd Sunday) |
| `custom` | N DB rows for specific dates, linked by `series_id` | Pick specific dates (irregular schedule) |

**Monthly Mode:**
- Creates ONE database row with `recurrence_rule` field
- Occurrence expansion happens at query time via `expandOccurrencesForEvent()`
- Per-occurrence RSVPs, comments, timeslots via `date_key` column (Phase ABC6)

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Four-mode card selection, ordinal checkboxes, improved validation |
| `app/api/my-events/route.ts` | Monthly mode handling (single row with recurrence_rule) |
| `happenings/page.tsx` | Date timezone fix (T12:00:00Z) |
| `components/events/EventCard.tsx` | Date timezone fix |
| `MyEventsFilteredList.tsx` | Date timezone fix |

**Test Coverage:**

| Test File | Tests |
|-----------|-------|
| `__tests__/custom-dates-api.test.ts` | 15 tests - all four modes, validation, edge cases |
| `__tests__/series-creation-rls.test.ts` | 11 tests - RLS compliance |
| `__tests__/recurrence-unification.test.ts` | 24 tests - recurrence contract |

**UX Card Descriptions:**
- **One-time Event:** "A single happening on one date"
- **Weekly Series:** "Same day each week (e.g., every Tuesday)"
- **Monthly Pattern:** "Specific weeks each month (e.g., 1st & 3rd Sunday)"
- **Custom Dates:** "Pick specific dates (irregular schedule)"

---

### Early Contributors CTA on Homepage (January 2026) — RESOLVED

**Goal:** Add a subtle CTA section on the homepage inviting users to become Early Contributors.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Placement | After Theme Picker, before Newsletter Signup |
| Styling | `card-spotlight` card with centered text |
| Link target | `/early-contributors` |
| Visibility | Always visible (no conditional rendering) |
| Copy | No time estimates (approved Option A copy) |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/early-contributors-cta.test.tsx` | 8 tests for copy requirements and structure |

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Added Early Contributors CTA section |

**Copy (Approved):**
- Title: "Early Contributors"
- Body: "Help shape the Denver Songwriters Collective. Explore the site and tell us what worked, what didn't, and what would make you share it."
- Subtitle: "For songwriters, hosts, venues, and curious first-timers."
- Button: "Become an Early Contributor"

**Test Coverage:** 8 tests preventing time estimates from creeping back in.

---

### Spotlight Happenings Homepage Section (January 2026) — RESOLVED

**Goal:** Give the admin `is_spotlight` toggle a public display on the homepage.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Admin toggle | `is_spotlight` checkbox in EventSpotlightTable (admin happenings dashboard) |
| Homepage section | "✨ Spotlight" section displays admin-selected happenings |
| Query filters | Only shows published, active events with `is_spotlight=true` |
| Layout | 3-column grid matching other homepage sections |
| Limit | Up to 6 spotlight happenings displayed |

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Added spotlight happenings query and section |

**Behavior:**
- Admins toggle spotlight on/off from `/dashboard/admin/events` table
- Spotlighted happenings appear in dedicated homepage section after "Tonight's Happenings"
- Section only renders if at least one spotlight happening exists
- Uses existing HappeningsCard component for consistent display

---

### Auto-Confirm on Publish via PublishButton (January 2026) — RESOLVED

**Goal:** Fix events not being auto-confirmed when published via the header PublishButton.

**Status:** Complete.

**Problem:** Events published via the PublishButton showed "Unconfirmed" on public pages because the button bypassed the API route's auto-confirm logic.

**Root Cause:** PublishButton directly updated Supabase, only setting `is_published` and `status`, but not `last_verified_at`.

**Fix:** Added `last_verified_at: new Date().toISOString()` to PublishButton's update payload when publishing.

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/_components/PublishButton.tsx` | Added `last_verified_at` when publishing |

**Behavior:**
- Both PublishButton (header) and EventForm (save button) now auto-confirm on publish
- Republishing an event also refreshes the `last_verified_at` timestamp
- Community events no longer show "Unconfirmed" after being published

---

### Image Upload for New Happenings + Auto-Cover (January 2026) — RESOLVED

**Goal:** Add image upload to admin "Add New Happening" form and auto-set first image as cover photo.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Image upload on create | `EventCreateForm.tsx` now includes `ImageUpload` component |
| Deferred upload | Image stored locally until event created, then uploaded to storage |
| Auto-cover on first upload | First image uploaded to any happening automatically becomes cover photo |
| Storage path | `event-images/{event_id}/{uuid}.{ext}` |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/admin/events/new/EventCreateForm.tsx` | Added ImageUpload component, deferred upload logic |
| `dashboard/admin/events/new/page.tsx` | Pass `userId` prop to form |
| `components/events/EventPhotosSection.tsx` | Auto-set first uploaded image as cover |

**Behavior:**
- New happening form now shows "Cover Image" upload field
- After event creation, pending image is uploaded and set as `cover_image_url`
- In EventPhotosSection, first image uploaded (when no cover exists) is automatically set as cover
- Subsequent images require explicit "Set as cover" click

---

### Multiple Categories Support for Happenings (January 2026) — RESOLVED

**Goal:** Allow happenings to have multiple categories (multi-select) instead of single category.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Database column | Added `categories text[]` to events table |
| Multi-select UI | Checkbox-style category selection in EventEditForm |
| Card display | Categories shown as chips on HappeningCard and SeriesCard |
| Backward compatible | Single `category` field still exists for legacy support |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260120200000_add_categories_array.sql` | Add `categories text[]` column to events |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/admin/events/[id]/edit/EventEditForm.tsx` | Multi-select category checkboxes |
| `components/happenings/HappeningCard.tsx` | Display categories as muted chips |
| `components/happenings/SeriesCard.tsx` | Display categories as muted chips |

**Categories Available:** music, comedy, poetry, variety, other

---

### Admin Happenings Table Improvements (January 2026) — RESOLVED

**Goal:** Improve admin happenings table with clickable links and inline verify action.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Clickable titles | Event titles link to public event detail page |
| Verify checkbox | Inline checkbox to mark events as verified/unverified |
| Visual feedback | Checkbox shows current verification state |

---

### About Page Rewrite (January 2026) — RESOLVED

**Goal:** Simplify the About page with explicit builder attribution and clear CTAs.

**Status:** Complete.

**Changes:**

| Section | Content |
|---------|---------|
| What This Is | Platform description for discovering open mics and connecting with local musicians |
| Who Built It | Sami Serrag attribution with clickable profile card, AI tools mention |
| Your Privacy Matters | Callout box linking to Privacy Policy |
| Get Involved | CTA buttons for Get Involved, Submit Feedback, Tip Jar |

**Key Implementation Details:**
- Server-side query for Sami's avatar via slug lookup (`profiles.slug = "sami-serrag"`)
- Inline "Built by" card using `card-spotlight` class pattern
- Reduced from ~230 lines to ~157 lines (removed About FAQ, Open Mic Guide, unused sections)

**Files Modified:**

| File | Change |
|------|--------|
| `app/about/page.tsx` | Complete rewrite with 4 focused sections |

---

### Privacy Policy + Get Involved Page Updates (January 2026) — RESOLVED

**Goal:** Update Privacy Policy date and revise Get Involved page content to focus on hosting, venues, and community outreach.

**Status:** Complete.

**Changes:**

| Page | Updates |
|------|---------|
| `/privacy` | Updated "Last updated" date from December 2024 to January 2026 |
| `/get-involved` | Revised hero subtitle, Ways to Help cards, and Why It Matters section |

**Get Involved Revisions:**
- Hero subtitle: "Host events, find venues, spread the word, and help keep our open mic directory accurate."
- Reorganized "Ways to Help" cards with new priorities:
  1. Help Host Events — Encouraging people to run open mics/showcases
  2. Find & Suggest Venues — Connecting with new venues
  3. Update Open Mic Info — Keeping the directory accurate
  4. Spread the Word — Telling musicians in the local scene
  5. Connect Partners (unchanged)
  6. Test Website Features (moved to end)
- Updated "Why Your Contribution Matters" to focus on building the local music scene
- Updated volunteer form intro to mention hosting events and venues

---

### Bandcamp URL Support + Listen to My Music Section Enhancement (January 2026) — RESOLVED

**Goal:** Add Bandcamp URL to member profiles and improve the "Listen to My Music" section with music platform pills.

**Status:** Complete.

**Part 1: Listen to My Music Section Enhancement**

| Feature | Implementation |
|---------|----------------|
| Music platform pills | Spotify, Bandcamp, YouTube links shown inside "Listen to My Music" section |
| Placement | Pills appear ABOVE individual song/track links |
| Section visibility | Shows if EITHER `song_links` OR music platform URLs exist |
| Pages updated | Both `/songwriters/[id]` and `/members/[id]` |

The existing social link pills at the top of the profile remain unchanged (intentional duplication for discoverability).

**Part 2: Bandcamp URL Support**

| Feature | Implementation |
|---------|----------------|
| Database column | Added `bandcamp_url` to profiles table |
| Icon | Bandcamp icon added to `SocialIcon` component |
| URL normalization | Handles full URLs, bare domains, and usernames |
| Link order | Bandcamp appears after Spotify (musician-centric ordering) |
| Onboarding | Bandcamp input field in profile onboarding form |
| Dashboard | Bandcamp input field in profile edit page |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260120100000_add_bandcamp_url.sql` | Add `bandcamp_url` column to profiles |

**Files Modified:**

| File | Change |
|------|--------|
| `components/profile/ProfileIcons.tsx` | Added Bandcamp icon, URL normalization, buildSocialLinks entry |
| `app/songwriters/[id]/page.tsx` | Music platform pills in Listen to My Music section |
| `app/members/[id]/page.tsx` | Music platform pills in Listen to My Music section |
| `app/onboarding/profile/page.tsx` | Added Bandcamp input field |
| `app/api/onboarding/route.ts` | Added bandcamp_url persistence |
| `app/(protected)/dashboard/profile/page.tsx` | Added Bandcamp input field |
| `lib/supabase/database.types.ts` | Regenerated with bandcamp_url column |

**Test Coverage:** 13 new tests in `__tests__/bandcamp-url-support.test.ts`

---

### Private Section Banner for Profile Pages (January 2026) — RESOLVED

**Goal:** Add prominent privacy indicator to private profile sections (My RSVPs, My Performances).

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| PrivateSectionBanner component | Lock icon + "Private — Only you can see this section" message |
| Applied to | My RSVPs and My Performances sections on profile pages |
| Styling | Uses theme tokens, subtle background with border |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/profile/PrivateSectionBanner.tsx` | Reusable privacy indicator component |

**Files Modified:**

| File | Change |
|------|--------|
| `app/songwriters/[id]/page.tsx` | Added PrivateSectionBanner to private sections |
| `components/profile/index.ts` | Exported PrivateSectionBanner |

---

### Timeslots + Host Controls for ALL Events (January 2026) — RESOLVED

**Goal:** Enable performer slots, host controls, and signup warnings for ALL events (not just DSC official events).

**Status:** Complete.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Timeslots not showing on community events | `TimeslotSection` gated by `is_dsc_event` | Removed gate, now shows for any event with `has_timeslots=true` |
| Timeslots not showing on recurring events | Query used occurrence `date_key` but slots created with anchor `date_key` | Added fallback query without date filter |
| Host Controls not showing for community events | `HostControls` gated by `is_dsc_event` | Removed gate, shows for all events |
| No signup warning missing for community events | Warning banner gated by `is_dsc_event` | Removed gate, shows for all managed events |
| Stale "Approved" claim after host removal | Claim status shown even when user removed from `event_hosts` | Check if user still in hosts before showing approved claim |

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Removed `is_dsc_event` gates from TimeslotSection, HostControls, signup warning; added stale claim detection |
| `components/events/TimeslotSection.tsx` | Added fallback query when no slots found for specific date_key |
| `__tests__/phase4-43-rsvp-always.test.ts` | Updated tests for new behavior |
| `__tests__/signup-lane-detection.test.ts` | Updated tests for new behavior |

**Behavior Change:**

| Feature | Before | After |
|---------|--------|-------|
| TimeslotSection | DSC events only | Any event with `has_timeslots=true` |
| HostControls | DSC events only | All events (component handles auth) |
| No signup warning | DSC events only | All managed events |

**Test Coverage:** 2118 tests passing.

---

### Host Step-Down + Admin Host Removal (January 2026) — RESOLVED

**Goal:** Allow hosts and co-hosts to leave events, and give admins the ability to remove any host from any event.

**Status:** Complete.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Self-removal | Hosts and co-hosts can leave events via LeaveEventButton |
| Admin removal | Admins can remove any host (primary or co-host) from any event |
| Sole host warning | Shows warning when leaving would make event unhosted |
| Event unhosting | When last host leaves, `events.host_id` is set to null |
| Removal notification | Users notified when removed by someone else |

**Authorization Matrix:**

| User | Can Leave | Can Remove Co-hosts | Can Remove Primary Hosts |
|------|-----------|---------------------|--------------------------|
| Co-host | ✅ Self only | ❌ | ❌ |
| Primary Host | ✅ Self (with warning if sole) | ✅ | ❌ |
| Admin | N/A | ✅ | ✅ |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/events/LeaveEventButton.tsx` | Two-step confirmation button for leaving events |
| `components/admin/AdminHostManager.tsx` | Admin component to manage/remove any host |

**Files Modified:**

| File | Change |
|------|--------|
| `api/my-events/[id]/cohosts/route.ts` | Extended DELETE for self-removal, admin removal, event unhosting |
| `dashboard/my-events/[id]/page.tsx` | Co-hosts section visible to all hosts, leave button for co-hosts |
| `dashboard/my-events/_components/CoHostManager.tsx` | Added leave button for primary hosts, new props |
| `dashboard/admin/events/[id]/edit/page.tsx` | Added Host Management section with AdminHostManager |

**API Changes (`DELETE /api/my-events/[id]/cohosts`):**

- Supports self-removal (any host can leave)
- Supports admin removal of any host
- Primary hosts can remove co-hosts but not other primary hosts
- Clears `events.host_id` when primary host leaves or event becomes unhosted
- Sends notification when user is removed by someone else
- Returns `{ success, removedRole, eventNowUnhosted }`

---

### Admin Suggestion Notification + UI Improvements (January 2026) — RESOLVED

**Goal:** Add admin email notifications for event update suggestions and fix admin table UI.

**Status:** Fixed.

**Features Added:**

| Feature | Implementation |
|---------|----------------|
| Admin notification email | `adminSuggestionNotification` template sends email to admin when suggestions are submitted |
| Improved action buttons | Approve/Reject/Need Info buttons now more visible with white text, proper contrast |
| Actions column width | Minimum width ensures buttons aren't cut off on narrow screens |
| "Already reviewed" text | Shows when suggestion has already been processed (not pending) |

**New Email Template:**

| Template | Path | Purpose |
|----------|------|---------|
| `adminSuggestionNotification` | `lib/email/templates/adminSuggestionNotification.ts` | Notifies admin of new event update suggestions |

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/email/templates/adminSuggestionNotification.ts` | Email template for admin notification |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/registry.ts` | Registered new template |
| `lib/email/index.ts` | Added export for new template |
| `lib/email/email.test.ts` | Updated template count (19→20) |
| `app/api/event-update-suggestions/route.ts` | Sends admin notification email after suggestion is created |
| `components/admin/EventUpdateSuggestionsTable.tsx` | Improved button visibility, added min-width to Actions column |
| `components/events/EventSuggestionForm.tsx` | Fixed success message contrast (theme-aware green styling) |

**Email Template Details:**

The `adminSuggestionNotification` email includes:
- Submitter name and email (if provided)
- Event title with link to event page
- Field being changed, old value, and new value
- Any notes from the submitter
- Link to admin review page (`/dashboard/admin/event-update-suggestions`)

---

### Happening Card Image Display + Admin Verification Control (January 2026) — RESOLVED

**Goal:** Fix card image cropping and add verification control for admins on event detail pages.

**Status:** Fixed.

**Issues Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Tall flyer images heavily cropped on happening cards | `object-cover` CSS always crops to fill | Changed to `object-contain` with bg-tertiary letterbox background |
| Admins/hosts cannot verify happenings from detail page | No UI control existed | Added `VerifyEventButton` component |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/events/VerifyEventButton.tsx` | Admin button to verify/unverify happenings |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningCard.tsx` | Tier 2 poster now uses `object-contain`, added `bg-[var(--color-bg-tertiary)]` for letterbox background |
| `app/events/[id]/page.tsx` | Added VerifyEventButton in unconfirmed banner for admins |

**Behavior:**

- **Card images:** Tall images now show fully with letterbox (empty space on sides) instead of being cropped
- **Verify button:** Admins see "Confirm this happening" button in the unconfirmed warning banner
- **After verification:** Shows green "Verified" badge with date, option to remove verification
- Uses existing `/api/admin/ops/events/bulk-verify` endpoint (works for single events)

---

### Event-Images Storage Policy Fix (January 2026) — RESOLVED

**Goal:** Fix admin image upload failing on happenings admin editor.

**Status:** Fixed.

**Problem:** When admin tried to upload images via EventPhotosSection, the upload failed with "Failed to upload image. Please try again."

**Root Cause:** Conflicting storage policies in two migrations:
1. Old migration (`20251209200002`) required `{user_id}/*` paths for the event-images bucket
2. New migration (`20260118120000`) expected `{event_id}/*` paths (matching EventPhotosSection code)

The EventPhotosSection uploads to `{eventId}/{uuid}.{ext}` but the old policy blocked uploads because the path didn't start with the user's ID.

**Fix:** Created migration `20260118200000_fix_event_images_storage_policy.sql` that:
1. Drops the conflicting `{user_id}/*` policies from the old migration
2. Ensures admin upload/update/delete policies work for `{event_id}/*` paths

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260118200000_fix_event_images_storage_policy.sql` | Remove conflicting policies, ensure admin access works |

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260118200000_fix_event_images_storage_policy.sql` | Storage policy fix |

---

### Slice 7: Event Photo Gallery + External URL + UI Terminology (January 2026) — RESOLVED

**Goal:** Add photo gallery system to happenings (same pattern as venues), add external_url field for outside happening links, and update UI terminology from "events" to "happenings" in dashboards.

**Status:** Implemented.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Event images table | New `event_images` table with soft-delete support (matches venue_images) |
| RLS policies | Host view, co-host view, admin view, public view, insert, update, delete |
| Storage policies | Event hosts and admins can upload to `event-images/{event_id}/*` |
| Admin UI | EventPhotosSection component in admin event edit page |
| External URL field | `external_url` column for linking to outside happening pages |
| UI terminology | "events" → "happenings" in user-facing dashboard copy |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260118120000_event_images_and_external_url.sql` | Create table, indexes, RLS policies, storage policies, external_url column |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/events/EventPhotosSection.tsx` | Admin photo management component (same pattern as VenuePhotosSection) |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/admin/events/[id]/edit/page.tsx` | Integrated EventPhotosSection, fetch images |
| `dashboard/admin/events/[id]/edit/EventEditForm.tsx` | Added external_url field |
| `api/my-events/[id]/route.ts` | Added external_url to allowedFields |
| `api/my-events/route.ts` | Added external_url to insert payload |
| `components/navigation/DashboardSidebar.tsx` | "My Events" → "My Happenings", "Event Claims" → "Happening Claims" |
| `dashboard/my-events/page.tsx` | All headings/labels updated to "Happenings" |
| `dashboard/my-events/new/page.tsx` | "Create Event" → "Create Happening" |
| `dashboard/my-events/[id]/page.tsx` | "Edit Event" → "Edit Happening" |
| `dashboard/my-events/_components/EventForm.tsx` | "Create Event" → "Create Happening" |
| `dashboard/my-events/_components/MyEventsFilteredList.tsx` | All references to "happenings" |
| `dashboard/my-events/[id]/_components/CreatedSuccessBanner.tsx` | All references to "happenings" |
| `dashboard/admin/claims/page.tsx` | "Event Claims" → "Happening Claims" |
| `dashboard/invitations/InvitationsList.tsx` | References to "happenings" |
| `dashboard/page.tsx` | Quick action "My Events" → "My Happenings" |

**Terminology Note:** Backend code keeps "event" terminology (API routes, DB tables, TypeScript types). Only user-facing UI copy changed to "happenings".

**Commit:** `e362238`

---

### Venue Management + Storage Policies Hotfixes (January 2026) — RESOLVED

**Goal:** Fix venue management dashboard access and image upload failures.

**Status:** Fixed.

**Issues Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Venue edit pages showing "Something went wrong" | `onCoverChange` callback passed from Server Component to Client Component | Removed callback, use local state + `router.refresh()` |
| Venue cover image upload failing | Storage RLS policies only allowed `{user_id}/*` paths | Added policies for `venue-covers/{venue_id}/*` in gallery-images bucket |
| Venue gallery image upload failing | Storage RLS policies only allowed `{user_id}/*` paths | Added policies for `venues/{venue_id}/*` in avatars bucket |
| Error message poor contrast on light theme | `text-red-300` on `bg-red-900/30` | Theme-aware: `bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300` |
| Venue card images cropped (wide images cut off) | `object-cover` CSS | Changed to `object-contain` with background color |
| ImageUpload preview showing cropped image when "Use Original" selected | Preview used hardcoded 1:1 aspect + `object-cover` | Preview now respects `aspectRatio` prop + uses `object-contain` |

**Database Migrations:**

| Migration | Purpose |
|-----------|---------|
| `20260118100000_venue_images_storage_policy.sql` | Storage policies for `avatars` bucket venue paths |
| `20260118110000_venue_covers_storage_policy.sql` | Storage policies for `gallery-images` bucket venue-covers paths |

**Files Modified:**

| File | Change |
|------|--------|
| `components/venue/VenuePhotosSection.tsx` | Removed `onCoverChange` prop, use local state + router |
| `components/venue/VenueCard.tsx` | Changed `object-cover` to `object-contain` for cover images |
| `components/ui/ImageUpload.tsx` | Theme-aware error message styling; preview respects aspectRatio prop + object-contain |
| `app/(protected)/dashboard/admin/venues/[id]/page.tsx` | Removed `onCoverChange` prop |
| `app/(protected)/dashboard/my-venues/[id]/page.tsx` | Removed `onCoverChange` prop |

**Storage Bucket Policies Added:**

| Bucket | Path Pattern | Roles |
|--------|--------------|-------|
| `avatars` | `venues/{venue_id}/*` | Venue managers, Admins |
| `avatars` | `profile-gallery/{user_id}/*` | Own user |
| `gallery-images` | `venue-covers/{venue_id}/*` | Venue managers, Admins |

**Commits:** `c03b1a4`, `2491345`, `84c8a07`, `09fafc1`

---

### Event Update Suggestions Admin Workflow Fixes (January 2026) — RESOLVED

**Goal:** Fix admin workflow for reviewing and applying event update suggestions.

**Status:** Fixed.

**Issues Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Approved suggestions not applied to events | PATCH endpoint only updated suggestion status, never updated the event itself | Added logic to apply approved changes to events table |
| "Need Info" status lost approve/reject ability | Table only showed action buttons for `status === "pending"` | Now shows buttons for `pending` OR `needs_info` status |
| Can't edit suggestion values before approving | No edit UI in modal | Added editable textarea in approval modal |
| Co-host search not finding members | `.ilike()` search required exact match | Changed to partial match with `%search%` wildcards |
| Host label wrong in co-hosts section | All hosts displayed role as-is ("host", "cohost") | Now shows "Primary Host" vs "Co-host" for clarity |

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/admin/event-update-suggestions/[id]/route.ts` | Apply approved changes to events; accept edited values |
| `components/admin/EventUpdateSuggestionsTable.tsx` | Show actions for `needs_info`; add editable value field in modal |
| `app/api/my-events/[id]/cohosts/route.ts` | Partial name search with wildcards; multi-match feedback |
| `app/(protected)/dashboard/my-events/_components/CoHostManager.tsx` | "Primary Host" vs "Co-host" labels |

**Admin Approval Flow (Now Works):**
1. Admin reviews suggestion in table
2. Clicks "Approve" → modal shows editable value
3. Admin can modify the value before confirming
4. On confirm: suggestion marked approved + event updated with (edited) value

---

### Password Reset Flow Fix (January 2026) — RESOLVED

**Goal:** Fix password reset flow showing "Auth session missing!" error.

**Status:** Fixed.

**Root Cause:** The `/auth/reset` page wasn't properly handling the Supabase PKCE flow. Reset links include tokens in URL hash that need to be exchanged for a session before calling `updateUser()`.

**Files Modified:**

| File | Change |
|------|--------|
| `app/auth/reset/page.tsx` | Complete rewrite to handle PKCE tokens from URL hash |
| `app/auth/reset-request/page.tsx` | Improved UX with loading state and email confirmation |
| `app/login/page.tsx` | Added success banner after password reset |

**Commits:** `e432633`, `af2f4f1`

---

### Slice 6: Venue Photo Gallery (January 2026) — RESOLVED

**Goal:** Allow venue managers and admins to upload photos for venues. Photos appear on public venue detail pages.

**Status:** Implemented.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Venue images table | New `venue_images` table with soft-delete support |
| RLS policies | 10 policies: manager view, admin view, public view, insert, update, delete |
| Dashboard UI | `VenuePhotosSection` component with upload, grid, cover selection |
| Cover selection | Clicking "Set as cover photo" copies URL to `venues.cover_image_url` |
| Storage path | `venues/{venue_id}/{uuid}.{ext}` in `avatars` bucket |
| Public display | Photos displayed on `/venues/[id]` using `PhotoGallery` component |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260117100000_venue_images.sql` | Create table, indexes, RLS policies |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/venue/VenuePhotosSection.tsx` | Dashboard photo management component |
| `supabase/migrations/20260117100000_venue_images.sql` | Migration file |

**Files Modified:**

| File | Change |
|------|--------|
| `app/(protected)/dashboard/my-venues/[id]/page.tsx` | Integrated VenuePhotosSection, fetch images |
| `app/venues/[id]/page.tsx` | Added venue photo gallery display |
| `lib/supabase/database.types.ts` | Regenerated with venue_images table |
| `components/gallery/CropModal.tsx` | Added onUseOriginal callback for skipping crop |
| `components/gallery/BulkUploadGrid.tsx` | Added handleUseOriginal callback |

**RLS Authorization:**

| Role | Can View | Can Upload | Can Delete |
|------|----------|------------|------------|
| Venue Manager | Own venue images | Own venue | Own venue |
| Admin | All images | All venues | All venues |
| Public | Active images only | No | No |

---

### Slice 5: Member Profile Photo Gallery (January 2026) — RESOLVED

**Goal:** Allow members to upload multiple profile photos and choose which one to display as their avatar.

**Status:** Implemented.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Profile images table | New `profile_images` table with soft-delete support |
| RLS policies | 7 policies: own view, admin view, public view (if is_public), insert, update, delete |
| Dashboard UI | `ProfilePhotosSection` component with upload, grid, avatar selection |
| Avatar selection | Clicking "Set as profile photo" copies URL to `profiles.avatar_url` |
| Storage path | `profile-gallery/{user_id}/{uuid}.{ext}` in `avatars` bucket |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260117000001_profile_images.sql` | Create table, indexes, RLS policies |

**Files Added:**

| File | Purpose |
|------|---------|
| `components/profile/ProfilePhotosSection.tsx` | Dashboard photo management component |
| `__tests__/profile-images-rls-and-contract.test.ts` | RLS contract tests (62 tests) |
| `__tests__/profile-photos-ui.test.tsx` | UI behavior tests (49 tests) |
| `docs/investigation/phase-member-profile-photos.md` | Investigation document |

**Files Modified:**

| File | Change |
|------|--------|
| `app/(protected)/dashboard/profile/page.tsx` | Integrated ProfilePhotosSection, fetch images |
| `components/profile/index.ts` | Added export |
| `lib/supabase/database.types.ts` | Regenerated with profile_images table |

**Test Coverage:** 111 new tests (2116 total).

**Commit:** `3a3144b`

---

### P0 UI Polish: Hero Contrast + Nav Order + CTA Labels (January 2026) — RESOLVED

**Goal:** Fix remaining P0 UI items for test-user readiness.

**Status:** Fixed.

**Changes:**

| Item | Before | After |
|------|--------|-------|
| A) Hero text contrast | 30% top vignette only | 40% full overlay + 30% top vignette |
| B) Nav menu order | Happenings → Venues → Members | Happenings → Members → Venues |
| C) CTA pill labels | "See happenings" / "See open mics" | "See All Happenings" / "See Open Mics" |

**Files Modified:**

| File | Change |
|------|--------|
| `components/layout/hero-section.tsx` | Added 40% black overlay for text readability |
| `components/navigation/header.tsx` | Reordered navLinks array |
| `app/page.tsx` | Updated CTA button text (hero + Collective Happenings sections) |

**Commit:** `dfe46d7`

---

### Slice 3: Getting Started Dashboard Prompts (January 2026) — RESOLVED

**Goal:** Add post-onboarding action prompts to dashboard for hosts and venue managers.

**Status:** Implemented.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Host prompt | Shows when `is_host=true` AND NOT approved host AND NO pending request |
| Venue prompt | Shows when `(is_host OR is_studio)` AND venueCount === 0 |
| Dismiss persistence | localStorage key `dsc_getting_started_dismissed_v1` |
| Host CTA | Inline `RequestHostButton` component (was previously built but unused) |
| Venue CTA | Link to `/venues` for discovering and claiming venues |

**Files Added:**

| File | Purpose |
|------|---------|
| `dashboard/_components/GettingStartedSection.tsx` | Client component with dismissable prompts |
| `__tests__/getting-started-section.test.tsx` | 22 tests for visibility logic |
| `docs/investigation/phase-role-based-onboarding-slice-3-prompts.md` | Investigation doc |

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/page.tsx` | Added server-side queries + GettingStartedSection component |

**Test Coverage:** 22 tests covering visibility logic, localStorage behavior, and link targets.

**Commit:** `5f8103e`

---

### Slice 1: Conditional Onboarding Step Display (January 2026) — RESOLVED

**Goal:** Show/hide onboarding accordion sections based on identity flags.

**Status:** Implemented.

**Features:**
- `getRelevantSections()` function determines visible sections based on identity flags
- Fan-only users see minimal fields (Basic Info, Social Links)
- Songwriter/Host/Studio users see role-relevant sections
- All identity flags are NOT mutually exclusive (can be multiple)

**Files Modified:**

| File | Change |
|------|--------|
| `app/onboarding/profile/page.tsx` | Added `getRelevantSections()` and conditional rendering |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/onboarding-conditional-steps.test.ts` | 12 tests for section visibility |

**Commit:** `30e4d13`

---

### P0 Fix: Global Nav Search (January 2026) — RESOLVED

**Goal:** Fix global nav search to find Happenings, Venues, AND Members, with correct navigation to detail pages.

**Status:** Fixed.

**Problems Fixed:**

| Issue | Before | After |
|-------|--------|-------|
| Open mic results | Linked to `/happenings?type=open_mic` (filter page) | Links to `/events/{slug}` (detail page) |
| Event results | Linked to `/happenings?type=dsc` (filter page) | Links to `/events/{slug}` (detail page) |
| Member results | Linked to `/members?id={id}` (ignored param) | Links to `/songwriters/{slug}` (detail page) |
| Venue search | Not searchable | Now searchable, links to `/venues/{slug}` |
| Member search | Returned empty results | Fixed query to use `select("*")` |

**Root Cause (Member Search):**
The Supabase JS client has a quirk where combining `.eq()` with `.ilike()` on explicit column selections (`.select(\`id, slug, ...\`)`) fails silently. Changing to `.select("*")` (matching the working `/songwriters` page pattern) fixed the issue.

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/search/route.ts` | Fixed all URLs, added venue search, fixed member query |
| `components/GlobalSearch.tsx` | Added venue type with label and icon |

**Test Coverage:** 18 new tests in `src/__tests__/nav-search.test.ts`

**Commits:**
- `a92613b` — Fix URLs for happenings/venues/members navigation
- `b5d0af8` — Fix member search using `ilike()` instead of `or()`
- `2449fd6` — Fix member search using `select("*")` to match working query pattern

---

### P0 Fix: DSC TEST Events + Recurring Events in Happenings (January 2026) — RESOLVED

**Goal:** Fix DSC TEST events not appearing in happenings and showing incorrect "ended" state.

**Status:** Fixed.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| DSC filter shows 0 happenings | Recurring events with past anchor `event_date` filtered out | Added `recurrence_rule.not.is.null` to query OR clause |
| Event detail shows "This happening has ended" | `isPastEvent` only checked anchor date, not future occurrences | Check `recurrence_rule`, recompute after occurrence expansion |
| "Unconfirmed" badge on DSC TEST events | Badge logic didn't suppress for internal test events | Added `shouldShowUnconfirmedBadge()` helper |
| Series slug without `?date=` param | No redirect to canonical URL | Redirect to include next occurrence date |

**Key Changes:**

1. **Happenings Query Fix (`app/happenings/page.tsx`):**
   - Query now includes `recurrence_rule.not.is.null` in OR clause
   - Recurring events with past anchor dates are fetched and expanded to future occurrences

2. **Event Detail Page Fix (`app/events/[id]/page.tsx`):**
   - Check `recurrence_rule` before marking event as past
   - Recompute `isPastEvent` after occurrence expansion (only past if 0 upcoming)
   - Redirect series slugs without `?date=` to include next occurrence date

3. **DSC TEST Badge Suppression (`lib/events/verification.ts`):**
   - New `shouldShowUnconfirmedBadge()` helper
   - Rule: If `is_dsc_event=true` AND title starts with "TEST" (case-sensitive), hide badge
   - Display-only suppression — doesn't change underlying verification state

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Added `recurrence_rule.not.is.null` to time filter queries |
| `app/events/[id]/page.tsx` | Fixed `isPastEvent` for recurring events, added series slug redirect |
| `lib/events/verification.ts` | Added `shouldShowUnconfirmedBadge()` helper |
| `components/happenings/HappeningCard.tsx` | Use `shouldShowUnconfirmedBadge()` for badge display |
| `components/happenings/SeriesCard.tsx` | Use `shouldShowUnconfirmedBadge()` for badge display |

**Test Coverage:** 23 new tests in `src/__tests__/dsc-test-unconfirmed-suppression.test.ts`

**Commits:**
- `04ca056` — Suppress "Unconfirmed" badge on DSC TEST series
- `58d5979` — Fix recurring events `isPastEvent` check + series slug redirect
- `43f64e4` — Include recurring events with past anchor dates in happenings query

---

### Hotfix: Venue Invite RLS + URL + Acceptance Issues (January 2026) — RESOLVED

**Goal:** Fix venue invite creation, URL generation, and invite acceptance flow.

**Status:** Fixed.

**Root Causes (Four Issues):**

1. **Issue 1:** The RLS policy `"Admins can manage all venue invites"` had only a `USING` clause but no `WITH CHECK` clause. PostgreSQL RLS requires `WITH CHECK` for INSERT operations.
   - **Migration:** `20260113210000_fix_venue_invites_rls_insert.sql`

2. **Issue 2:** The `users_see_own_invites` policy contained a subquery accessing `auth.users`:
   ```sql
   email_restriction = (SELECT email FROM auth.users WHERE id = auth.uid())
   ```
   The `authenticated` role has no SELECT permission on `auth.users`, causing error `42501: permission denied for table users`.
   - **Migration:** `20260114000000_fix_venue_invites_users_policy.sql`

3. **Issue 3:** Invite URL used `process.env.NEXT_PUBLIC_SITE_URL` directly which fell back to `localhost:3000` in production.
   - **Fix:** Import `SITE_URL` from `@/lib/email/render` which has proper production fallback.

4. **Issue 4:** Invite acceptance endpoint used user session client which couldn't read `venue_invites` table (regular users aren't venue managers yet - that's what the invite grants).
   - **Fix:** Use `createServiceRoleClient()` for token lookup, manager check, invite update, and manager grant operations.

**Lessons:**
- When creating `FOR ALL` RLS policies, always include both `USING` and `WITH CHECK` clauses
- RLS policies cannot query `auth.users` directly (no SELECT permission for authenticated role)
- Use the centralized `SITE_URL` constant from `lib/email/render.ts` for URL generation
- Token validation endpoints that grant access should use service role to bypass RLS

---

### UI Contrast Fix: Amber Warning Banners (January 2026) — RESOLVED

**Goal:** Fix poor text contrast on amber/yellow warning banners (light text on light background).

**Status:** Fixed.

**Problem:** Components used `bg-amber-500/10` (very light) with `text-amber-400` (light text), resulting in poor readability.

**Solution:** Changed to `bg-amber-100` (solid light) with `text-amber-800` (dark text) for proper WCAG contrast.

**Files Modified:**
- `VenueInviteSection.tsx` - "This link will only be shown once!" banner
- `BetaBanner.tsx` - Beta schedules warning
- `confirm-sent/page.tsx` - Email junk folder warning
- `EventForm.tsx` - Timeslot duration warning
- `BlogPostForm.tsx` - Non-admin approval notice
- `EventImportCard.tsx` - Warnings and confirmation dialogs
- `VenueImportCard.tsx` - Confirmation dialog
- `OverrideImportCard.tsx` - Confirmation dialog
- `logs/page.tsx` - Warning count stat card

**Pattern to Use:**
- Light backgrounds: `bg-amber-100 border-amber-300 text-amber-800`
- Dark backgrounds (dark mode): `bg-amber-900/30 border-amber-700 text-amber-300`

---

### Phase 4.69 — Event Detail Timeslot Performance Fix (January 2026) — RESOLVED

**Goal:** Fix slow loading of event detail pages with timeslots (~3 seconds).

**Status:** Implementation complete.

**Problem:** Event detail page was fetching ALL timeslots across ALL dates for recurring events. For a weekly event with 10 slots × 13 weeks = 130 rows fetched when only 10 needed for the selected date.

**Solution:** Scope RSVP and timeslot queries by `date_key` (the selected occurrence date):
- RSVP count query now filters by `date_key` when available
- Timeslot count query now filters by `date_key` when available
- Claims query inherits the scoping through slotIds

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Scoped RSVP and timeslot queries by `date_key` |

**Performance Impact:**
- Before: ~130 rows fetched for weekly recurring events
- After: ~10 rows fetched (only for selected date)
- Expected improvement: ~3s → <1s

---

### Phase 4.68 — Unified Date Pill Row UI (January 2026) — RESOLVED

**Goal:** Unify venue-series date UI with event-detail pills for visual consistency.

**Status:** Implementation complete.

**New Component:**

| Component | Path | Purpose |
|-----------|------|---------|
| DatePillRow | `components/happenings/DatePillRow.tsx` | Shared pill row with expand/collapse toggle |

**Features:**
- 5 visible date pills when collapsed (matches event detail page)
- "+X more" button with accurate count from `totalUpcomingCount`
- "Hide dates" when expanded
- Pills are accessible `<Link>` elements
- Toggle is accessible `<button>` with `aria-expanded`

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/DatePillRow.tsx` | NEW: Shared pill row component |
| `components/happenings/SeriesCard.tsx` | Use DatePillRow instead of bullet list |

**Test Coverage:** 12 new tests in `src/__tests__/date-pill-row.test.tsx`

---

### Phase 4.67 — Venue Card Series/One-off Counts (January 2026) — RESOLVED

**Goal:** Replace generic "X happenings" badge on `/venues` cards with detailed series/one-off breakdown.

**Status:** Implementation complete.

**Badge Format:**

| Scenario | Old Badge | New Badge |
|----------|-----------|-----------|
| Recurring series only | "1 happening" | "1 series • 12 upcoming" |
| Both types | "3 happenings" | "2 series • 24 upcoming • 1 one-off" |
| One-offs only | "2 happenings" | "2 upcoming" |
| No events | "0 upcoming" | "No upcoming" |

**New Helper:**

| File | Purpose |
|------|---------|
| `lib/venue/computeVenueCounts.ts` | Reuses same logic as venue detail page |

**Key Implementation:**
- Single query for all events, client-side grouping per venue (O(1) queries)
- De-duplication by title (same scoring algorithm as detail page)
- `groupEventsAsSeriesView()` for occurrence expansion
- 90-day window (matches detail page)
- `totalUpcomingCount` from SeriesEntry gives accurate expanded occurrence counts

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/page.tsx` | Query all event fields, use `computeVenueCountsFromEvents()` |
| `components/venue/VenueCard.tsx` | Accept `counts` prop, use `formatVenueCountsBadge()` |
| `components/venue/VenueGrid.tsx` | Pass counts to VenueCard |
| `app/events/[id]/page.tsx` | Removed `maxOccurrences: 6` limit to align with venue pages |

**Test Coverage:** 18 new tests in `src/__tests__/venue-card-series-counts.test.ts`

---

### Phase 4.66 — Venue Page Count Fix + Series De-duplication (January 2026) — RESOLVED

**Goal:** Fix venue card counts showing 0 for valid events and duplicate series cards on venue detail pages.

**Status:** Implementation complete.

**Problems Fixed:**

| Issue | Root Cause | Fix |
|-------|------------|-----|
| A) `/venues` cards showed 0 upcoming | List page used `.eq("status", "active")` but detail page uses `.in("status", ["active", "needs_verification", "unverified"])` | Aligned status filter + added `is_published` check |
| B) Duplicate series on venue detail | Two DB records for same event with different completeness | De-duplicate by title, keep record with most complete data |
| C) Series dates not clickable | Already working in SeriesCard | No changes needed |

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/page.tsx` | Changed `.eq("status", "active")` to `.in("status", ["active", "needs_verification", "unverified"])` + added `.eq("is_published", true)` |
| `app/venues/[id]/page.tsx` | Added de-duplication logic before `groupEventsAsSeriesView()` - scores events by completeness (recurrence_rule=2, start_time=1) |

**De-duplication Logic:**
```typescript
// Score completeness: prefer events with recurrence_rule and start_time
const scoreEvent = (e: SeriesEvent) =>
  (e.recurrence_rule ? 2 : 0) + (e.start_time ? 1 : 0);
```

When duplicate titles exist at a venue, the event with higher score wins.

**Test Coverage:** 17 new tests in `src/__tests__/venue-page-fixes.test.ts`

**Smoke Test:**
- Visit `/venues` — Bar 404 should show "1 upcoming" (not 0)
- Visit `/venues/blazin-bite-seafood-bbq` — should show only ONE "Blazin Bite Seafood" series card

---

### Phase 4.65b — Venue Page Query Fix (January 2026) — RESOLVED

**Goal:** Fix venue detail page throwing 500 error due to non-existent columns in query.

**Problem:** Venue page query included `cover_image_card_url` and `ordinal_pattern` columns that don't exist in the events table schema, causing silent query failures.

**Root Cause:** Columns were removed/never existed but query wasn't updated.

**Fix:** Removed non-existent columns from venue page events query. Added explicit error throwing instead of silent failure.

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/[id]/page.tsx` | Removed `cover_image_card_url` from query, added error throw on query failure |

**Commits:** `ad416cb`, `ea33c57`, `e08f8a6`

---

### Phase ABC11 — Admin Venue Invite UI (January 2026) — RESOLVED

**Goal:** Add the missing admin UI for creating and managing venue invites, enabling venue outreach workflow.

**Status:** Implementation complete.

**Investigation Document:** `docs/investigation/phase-abc11-venue-outreach-workflow.md`

**Problem:** ABC8 created the invite API but no UI existed to use it. Admins had to use curl/Postman to create invites.

**UI Components (1 new):**

| Component | Path | Purpose |
|-----------|------|---------|
| VenueInviteSection | `_components/VenueInviteSection.tsx` | Create + revoke invite UI |

**Features Delivered:**

| Feature | Implementation |
|---------|----------------|
| Create Invite | Modal with email restriction, expiry selector (3/7/14/30 days) |
| One-Time URL Display | Invite URL shown once with copy button |
| Email Template | Pre-formatted email with copy button |
| Revoke Invite | Button on each pending invite with confirmation modal |
| Acceptance Notification | Admin notified when invite is accepted (ABC11c) |

**Files Modified:**

| File | Change |
|------|--------|
| `/dashboard/admin/venues/[id]/page.tsx` | Import VenueInviteSection, fetch invite creator profiles |
| `/api/venue-invites/accept/route.ts` | Added notification to invite creator |

**Test Coverage:** 38 new tests in `src/__tests__/phase-abc11-venue-invite-ui.test.ts`

**Operational Runbook:** `docs/runbooks/venue-outreach-smoke-and-migrations.md`

---

### Venue Management Track — Migration & Type Sync (January 2026)

**Issue:** Database types must include `venue_managers`, `venue_claims`, `venue_invites` for TypeScript compilation.

**Type Generation Command:**
```bash
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts
```

**Migration Sync Status (2026-01-12):**
- ✅ `20260111200000` — ABC6 add date_key columns
- ✅ `20260111210000` — ABC6 enforce constraints
- ✅ `20260112000000` — ABC8 venue claiming
- ✅ `20260112100000` — ABC10b RLS tightening

**Guardrail:** If TypeScript fails with `.from("table_name")` not found, regenerate database.types.ts using the command above. See `docs/runbooks/venue-outreach-smoke-and-migrations.md` for full troubleshooting.

---

### Phase ABC8 — Venue Claiming + Admin Approval + Invite Links (January 2026) — RESOLVED

**Goal:** Enable venue ownership claims, admin approval workflow, and invite links for multi-user venue management.

**Status:** Implementation complete.

**Investigation Document:** `docs/investigation/phase-abc8-venue-claiming.md`

**Database Tables (3 new):**

| Table | Purpose |
|-------|---------|
| `venue_managers` | Links users to venues with roles (`owner`/`manager`) |
| `venue_claims` | Tracks claim requests (pending → approved/rejected/cancelled) |
| `venue_invites` | Token-based invites with SHA-256 hashed tokens |

**API Routes (11 new):**

| Route | Purpose |
|-------|---------|
| `POST /api/venues/[id]/claim` | Submit venue claim |
| `DELETE /api/venues/[id]/claim` | Cancel pending claim |
| `GET /api/admin/venue-claims` | List pending claims (admin) |
| `POST /api/admin/venue-claims/[id]/approve` | Approve claim → grant owner role |
| `POST /api/admin/venue-claims/[id]/reject` | Reject claim with optional reason |
| `POST /api/admin/venues/[id]/invite` | Create invite link (admin) |
| `DELETE /api/admin/venues/[id]/invite/[inviteId]` | Revoke invite (admin) |
| `POST /api/venue-invites/accept` | Accept invite → grant manager role |
| `GET /api/my-venues` | List user's managed venues |
| `DELETE /api/my-venues/[id]` | Relinquish venue access |

**UI Surfaces (5 new):**

| Surface | Path |
|---------|------|
| Claim Venue Button | `components/venue/ClaimVenueButton.tsx` |
| My Venues Dashboard | `dashboard/my-venues/page.tsx` |
| Admin Venue Claims | `dashboard/admin/venue-claims/page.tsx` |
| Venue Claims Table | `dashboard/admin/venue-claims/_components/VenueClaimsTable.tsx` |
| Venue Invite Accept | `app/venue-invite/page.tsx` |

**Email Templates (2 new):**

| Template | Purpose |
|----------|---------|
| `venueClaimApproved` | Sent when admin approves claim |
| `venueClaimRejected` | Sent when admin rejects claim (includes reason) |

**Key Design Decisions:**
- Soft-delete pattern: `revoked_at` timestamp for audit trail
- Token security: SHA-256 hash stored in DB, plaintext shown once
- Grant methods: `claim` (approved), `invite` (accepted), `admin` (direct)
- Sole owner guard: Cannot relinquish if last owner

**Test Coverage:** 37 new tests in `src/__tests__/abc8-venue-claiming.test.ts`

---

### Phase ABC7 — Admin/Host Date-Awareness (January 2026) — RESOLVED

**Goal:** Make host and admin surfaces occurrence-correct by enforcing `date_key` scoping. Surfaces that were "series-blended" now properly show/act on specific occurrences.

**Rule:** Host/admin surfaces must be date-scoped; never series-blended.

**Surfaces Fixed:**

| Surface | File | Fix |
|---------|------|-----|
| RSVPCard cancel | `RSVPCard.tsx` | Pass `date_key` to DELETE request |
| My RSVPs page | `my-rsvps/page.tsx` | Include `date_key` in query, display occurrence date |
| Host RSVP API | `/api/my-events/[id]/rsvps/route.ts` | Accept `date_key` param, filter RSVPs |
| Lineup control | `/events/[id]/lineup/page.tsx` | Date selector + filter timeslots by date_key |
| TV display | `/events/[id]/display/page.tsx` | Accept `?date=` param, filter by date_key |
| My Events counts | `/dashboard/my-events/page.tsx` | Show next-occurrence RSVP count only |

**Key Changes:**
- `LineupState` interface updated to match actual DB schema: `{now_playing_timeslot_id, updated_at}` (not `current_slot_index`)
- Lineup state upsert uses composite key `(event_id, date_key)`
- Date selector UI for recurring events on host surfaces

**Investigation Document:** `docs/investigation/phase-abc7-admin-host-date-awareness.md`

---

### Phase ABC6 — Per-Occurrence RSVPs, Comments, and Timeslots (January 2026) — RESOLVED

**Goal:** Make RSVPs, comments, and timeslots apply to **specific occurrence dates** rather than the entire series. When a user RSVPs on `/events/foo?date=2026-01-18`, their RSVP should only apply to January 18th.

**Status:** Implementation complete.

**Investigation Document:** `docs/investigation/phase-abc6-per-occurrence-inventory.md`

**Scope Summary:**

| Category | Files |
|----------|-------|
| Database tables | 6 (4 primary + 2 related) |
| API routes | ~15 |
| UI components | ~17 |
| Email templates | ~11 |
| Notification logic | 3 |
| Test files | 12 |
| **Total** | **~64 files** |

**Tables in Scope:**

| Table | Rows | Needs date_key |
|-------|------|----------------|
| `event_rsvps` | 10 | Yes |
| `event_comments` | 7 | Yes |
| `event_timeslots` | 112 | Yes |
| `timeslot_claims` | 2 | No (inherits via timeslot join) |
| `guest_verifications` | 18 | **Yes** (STOP-GATE A finding) |
| `event_lineup_state` | 0 | **Yes** (STOP-GATE A finding) |

**STOP-GATE A Finding:** Two additional tables must be included:
- `guest_verifications` — Links to rsvps/comments/claims; has `event_id` but no `date_key`
- `event_lineup_state` — "Now playing" pointer needs date awareness for multi-occurrence lineup display

**Migration Plan (3 migrations):**
1. **Additive (safe):** Add `date_key TEXT` columns + indexes
2. **Backfill (idempotent):** Compute date_key using `expandOccurrencesForEvent()`
3. **Constraints (breaking):** Add NOT NULL + new unique constraints including date_key

**Awaiting approval before proceeding with Step 1 (Schema migration).**

---

### Phase ABC5 — Occurrence-aware Event Detail (Option C MVP) (January 2026)

**Goal:** Enable occurrence-specific deep-linking for recurring events without per-occurrence RSVP schema changes.

**Key Feature:** `/events/[slug]?date=YYYY-MM-DD` shows occurrence-specific details while RSVPs and comments remain series-level.

**Event Detail Page (`app/events/[id]/page.tsx`):**

| Feature | Implementation |
|---------|----------------|
| Date parameter | `?date=YYYY-MM-DD` selects specific occurrence |
| Date validation | Invalid dates fall back to next upcoming occurrence with message |
| Override support | Shows cancelled banner, override time, override notes, override flyer |
| RSVP behavior | Disabled for cancelled occurrences, series-level clarification text |
| Date pills | Now link to `/events/${slug}?date=${dateKey}` instead of `/happenings?date=` |

**SeriesCard Date Pills (`components/happenings/SeriesCard.tsx`):**

| Feature | Implementation |
|---------|----------------|
| Clickable dates | Each date in expandable list links to `/events/${id}?date=${dateKey}` |
| Hover states | Visual feedback on hover |

**Override Editor Preview (`dashboard/admin/events/[id]/overrides/`):**

| Feature | Implementation |
|---------|----------------|
| Preview link | Each occurrence row has "Preview" link to public site |
| Uses slug | Prefers event slug over UUID for URLs |

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | `searchParams`, occurrence override query, date-aware UI |
| `components/happenings/SeriesCard.tsx` | `UpcomingDatesList` links to event page with `?date=` |
| `dashboard/admin/events/[id]/overrides/_components/OccurrenceOverrideList.tsx` | Added `eventSlug` prop, Preview links |
| `dashboard/admin/events/[id]/overrides/page.tsx` | Query includes `slug`, passes to component |

**Behavior:**
- `/events/words-open-mic?date=2026-01-18` → shows Jan 18 occurrence details
- Date not in 90-day window → defaults to next occurrence with message
- Cancelled occurrence → shows banner, disables RSVP
- Override time/flyer/notes displayed when present
- RSVPs + comments remain series-level (no schema changes)

**Test Coverage:** 1624 tests passing (no new tests needed - existing tests cover components).

---

### Phase ABC4 — Venue Slugs + Series View Fix (January 2026)

**Goal:** Add friendly slugs to venues and fix venue detail pages not showing happenings.

**Venue Slugs:**

| Feature | Implementation |
|---------|----------------|
| Slug column | Added `slug` text column to venues table |
| Auto-generation | Trigger generates slug from name on insert/update |
| Collision handling | Appends `-2`, `-3`, etc. for duplicates |
| Canonical redirect | UUID access redirects to slug URL |
| Backward compatible | Both UUID and slug URLs work |

**Database Migration:** `supabase/migrations/20260111100000_add_venue_slugs.sql`

**Files Modified for Slugs:**

| File | Change |
|------|--------|
| `app/venues/page.tsx` | Query includes slug, passes to VenueGrid |
| `app/venues/[id]/page.tsx` | UUID/slug routing with canonical redirect |
| `app/events/[id]/page.tsx` | Venue link uses `slug \|\| venue_id` |
| `app/happenings/page.tsx` | Venue join includes id + slug |
| `components/venue/VenueCard.tsx` | Uses `slug \|\| id` for links |
| `components/happenings/SeriesCard.tsx` | Uses venue slug for links |
| `dashboard/admin/venues/AdminVenuesClient.tsx` | View links use `slug \|\| id` |

**Example URLs:**
- `/venues/brewery-rickoli` (friendly slug)
- `/venues/{uuid}` → redirects to `/venues/brewery-rickoli`

---

### Phase ABC4 — Event Detail Page Enhancements (January 2026)

**Goal:** Improve event detail pages with internal venue links and recurrence display with clickable date pills.

**Venue Name Internal Links:**

Changed venue names on event detail pages from external links (Google Maps) to internal links (`/venues/[slug|id]`).

| Before | After |
|--------|-------|
| Venue name linked to Google Maps | Venue name links to `/venues/[slug]` |
| External redirect | Internal navigation |
| Lost users to external site | Keeps users discovering more happenings at venue |

**Recurrence Display with Date Pills:**

Added recurrence information section to event detail pages for recurring events.

| Feature | Implementation |
|---------|----------------|
| Recurrence summary | "Every Saturday", "1st & 3rd Thursday" using `labelFromRecurrence()` |
| Next occurrences | Up to 6 clickable date pills |
| Date pill links | Each pill links to `/happenings?date=YYYY-MM-DD` |
| Pill styling | Amber/gold accent matching theme tokens |
| Non-recurring | Section hidden for one-time events |

**Example Display:**
```
Recurrence: Every Saturday
Upcoming: [Jan 18] [Jan 25] [Feb 1] [Feb 8] [Feb 15] [Feb 22]
```

Each date pill is clickable and navigates to the happenings page filtered to that date.

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Added recurrence section, venue slug fetch, internal venue link |

**Dependencies:**
- `lib/events/recurrenceContract.ts` — `interpretRecurrence()`, `labelFromRecurrence()`
- `lib/events/nextOccurrence.ts` — `expandOccurrencesForEvent()`

---

### Phase ABC4 — Venue Pages Series View Fix (January 2026)

**Goal:** Fix venue detail pages not showing happenings, implement Series View for recurring events.

**Problem:** Venue pages (`/venues/[id]`) showed "No upcoming happenings" even when events existed in the database. The query filtered by `event_date >= today`, which excluded recurring events with past anchor dates.

**Root Cause:** The recurrence model uses `event_date` as an anchor (first occurrence), not a filter. A weekly event with `event_date=2025-12-01` should still appear on future Mondays.

**Solution:**

| Change | Implementation |
|--------|----------------|
| Remove date filter | Removed `.or(\`event_date.gte.${today},event_date.is.null\`)` |
| Add occurrence expansion | Use `groupEventsAsSeriesView()` from `nextOccurrence.ts` |
| Query overrides | Fetch `occurrence_overrides` for cancellation support |
| Series rendering | Use existing `SeriesCard` component from happenings |

**UI Structure:**

```
Happenings at [Venue Name]
├── Recurring Series (shows "Every Monday" with expandable dates)
├── One-Time Events (or "Upcoming Events" if no recurring)
└── Schedule Unknown (if any)
```

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/[id]/page.tsx` | Removed date filter, added series view, uses SeriesCard |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/venue-series-view.test.ts` | 10 tests for series categorization and expansion |

**Test Coverage:** 1624 tests passing (10 new).

**Investigation Doc:** `docs/investigation/phase-abc4-venue-happenings.md` (RESOLVED)

---

### Phase ABC3 — Duplicate Venue Merge + Admin Data Quality (January 2026)

**Goal:** Merge duplicate venue records and add data quality indicators to admin table.

**Duplicate Venue Merges (4 pairs):**

| Canonical | Duplicate | Events Moved |
|-----------|-----------|--------------|
| Brewery Rickoli | (dup) | 1 → 2 total |
| Second Dawn Brewing | (dup) | 1 → 3 total |
| Rails End Beer Company | Rails End | 1 → 2 total |
| The Pearl / Mercury Cafe | Mercury Cafe | 1 → 2 total |

**Admin Venues Data Column:**
- Added "Data" column with quality indicators: `M✓ W— P✓ A✓`
- M = Maps URL, W = Website, P = Phone, A = Address (city+state)
- Tooltip on header explains abbreviations

**GOVERNANCE.md Updates:**
- Added "Database Change Rules" section
- Migrations required for policy/GRANT/schema changes
- Direct SQL allowed only for data corrections with audit logging

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/admin/venues/AdminVenuesClient.tsx` | Added Data column with quality indicators |
| `docs/GOVERNANCE.md` | Added Database Change Rules section (v1.1) |

**Audit Log:** `docs/investigation/phase-abc3-duplicate-venue-merge.md` Section 8

---

### Phase 4.65 — Venue Profile Buttons Fix (January 2026)

**Goal:** Fix "Get Directions" and "View on Maps" buttons opening the same URL, and add Website button.

**Problem 1:** When venue has `google_maps_url`, both "Get Directions" and "View on Maps" opened the same place page URL. "Get Directions" should open Google Maps in directions mode.

**Problem 2:** When venue has both `google_maps_url` AND `website_url`, only the Maps button showed. Website button was missing.

**Solution:**

| Button | Behavior |
|--------|----------|
| Get Directions | Always uses `/maps/dir/?api=1&destination=...` (directions mode) |
| View on Maps | Uses `google_maps_url` (place page with reviews, hours, photos) |
| Website | Shows when venue has `website_url` AND `google_maps_url` |

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/venue/getDirectionsUrl.ts` | Pure helper for Google Maps Directions URL |
| `__tests__/venue-directions-url.test.ts` | 13 tests for URL generation |

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/[id]/page.tsx` | Uses `getVenueDirectionsUrl()`, added Website button |

**Test Coverage:** 1604 tests passing (13 new).

---

### Phase 4.64 — Venue CSV Quote-Safe Parsing Fix (January 2026)

**Goal:** Fix venue CSV re-upload validation failure when fields contain commas.

**Bug:** Admin → Ops Console → Venues → Export CSV → re-upload same file failed with "expected 10 columns, got 11/12/14" on rows containing commas inside quoted fields (e.g., notes like "Great venue, friendly staff").

**Root Cause:** `venueCsvParser.ts` used naive `line.split(",")` which ignored RFC 4180 quoting rules. The serializer correctly quoted commas, but the parser didn't respect those quotes.

**Fix:** Added `parseCsvLine()` helper (same pattern as `eventCsvParser.ts`) that properly handles:
- Quoted fields containing commas: `"Foo, Bar"` → `Foo, Bar`
- Escaped quotes: `"He said ""hello"""` → `He said "hello"`

**Files Modified:**

| File | Change |
|------|--------|
| `lib/ops/venueCsvParser.ts` | Added `parseCsvLine()` helper, replaced `split(",")` calls |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/venue-csv-quote-safe.test.ts` | 19 tests for round-trip, quoted commas, edge cases |

**Test Coverage:** 1591 tests passing (19 new).

**Invariants Preserved:**
- Schema unchanged (10 columns in same order)
- Row numbering unchanged (1-indexed for display)
- CRLF/LF handling preserved
- Multi-line cell STOP-GATE preserved

---

### Phase 4.63 — ABC Track Completion: Ops Console Discoverability + Events→Happenings (January 2026)

**Goal:** Make Ops Console discoverable from Admin Hub and align admin terminology with "Happenings" branding.

**Changes:**

| Area | Change |
|------|--------|
| Admin Hub | Added "Operations" section with Ops Console link |
| Manage Happenings | "Bulk operations →" cross-link to `/dashboard/admin/ops/events` |
| Venue Management | "Bulk operations →" cross-link to `/dashboard/admin/ops/venues` |
| Terminology | "Events" → "Happenings" in admin UI copy (not URLs/DB/types) |
| Legacy cleanup | Deleted `/dashboard/admin/dsc-events` page (superseded by events page) |

**Files Modified:**

| File | Change |
|------|--------|
| `/dashboard/admin/page.tsx` | Operations section, Happenings terminology |
| `/dashboard/admin/events/page.tsx` | "Manage Happenings" heading + bulk ops link |
| `/dashboard/admin/events/new/page.tsx` | "Back to Happenings", "Add New Happening" |
| `/dashboard/admin/venues/AdminVenuesClient.tsx` | Bulk ops link, "venues for happenings" |
| `/dashboard/admin/ops/page.tsx` | "Happening Bulk Management" card |
| `/dashboard/admin/ops/events/page.tsx` | "Happenings Bulk Management" heading/stats |
| `/dashboard/admin/ops/overrides/page.tsx` | "← Happenings Ops" nav link |

**Deleted:**
- `/dashboard/admin/dsc-events/page.tsx` — Legacy DSC-only event list (zero code references)

**Navigation Path:**
- Admin Hub → Operations → Ops Console
- Manage Happenings → Bulk operations → Happenings Ops
- Venue Management → Bulk operations → Venue Ops

**Terminology Note:**
"Happenings" is used in user-facing copy only. URLs remain `/events/`, DB tables remain `events`, TypeScript types remain `Event*`. This is a copy-only change for brand consistency.

---

### Phase 4.62 — Ops Console v1: Events + Overrides Bulk Management (January 2026)

**Goal:** Admin-only bulk management for events and occurrence overrides via CSV export/import.

**How to Use Events Ops Console:**
1. Navigate to `/dashboard/admin/ops/events`
2. **Export:** Filter by status/type/venue/recurring, click "Download CSV"
3. **Edit:** Open CSV in Excel/Sheets, update fields (title, status, times, etc.)
4. **Preview:** Upload edited CSV, review diff before applying
5. **Apply:** Confirm changes to update database
6. **Bulk Verify:** Select events, click "Verify Selected" to mark as admin-verified

**How to Use Overrides Ops Console:**
1. Navigate to `/dashboard/admin/ops/overrides`
2. **Export:** Filter by event_id or date range, click "Download CSV"
3. **Edit/Create:** Add new rows or edit existing ones (upsert behavior)
4. **Preview:** Upload CSV, see which overrides will be created vs updated
5. **Apply:** Confirm to create new overrides and update existing ones

**Events CSV Schema (12 columns):**
```
id,title,event_type,status,is_recurring,event_date,day_of_week,start_time,end_time,venue_id,is_published,notes
```
- `notes` maps to `host_notes` database column
- No verification timestamps (verification via UI only)
- Update-only (no event creation via CSV)

**Overrides CSV Schema (6 columns):**
```
event_id,date_key,status,override_start_time,override_notes,override_cover_image_url
```
- Upsert behavior: creates new or updates existing
- Composite key: `(event_id, date_key)` identifies overrides
- No id column needed

**Files Added:**

| File | Purpose |
|------|---------|
| `docs/OPS_BACKLOG.md` | Deferred features backlog |
| `lib/ops/eventCsvParser.ts` | Event CSV parse/serialize |
| `lib/ops/eventValidation.ts` | Event row validation |
| `lib/ops/eventDiff.ts` | Event diff computation |
| `lib/ops/overrideCsvParser.ts` | Override CSV parse/serialize |
| `lib/ops/overrideValidation.ts` | Override row validation |
| `lib/ops/overrideDiff.ts` | Override diff with upsert support |
| `api/admin/ops/events/export/route.ts` | GET - Events CSV download |
| `api/admin/ops/events/preview/route.ts` | POST - Preview diff |
| `api/admin/ops/events/apply/route.ts` | POST - Apply changes |
| `api/admin/ops/events/bulk-verify/route.ts` | POST - Bulk verify/unverify |
| `api/admin/ops/overrides/export/route.ts` | GET - Overrides CSV download |
| `api/admin/ops/overrides/preview/route.ts` | POST - Preview diff (upsert) |
| `api/admin/ops/overrides/apply/route.ts` | POST - Apply changes (upsert) |
| `dashboard/admin/ops/events/page.tsx` | Events bulk management UI |
| `dashboard/admin/ops/overrides/page.tsx` | Overrides bulk management UI |

**Test Coverage:** 98 new tests (1572 total).

| Test File | Tests |
|-----------|-------|
| `ops-event-csv.test.ts` | 21 tests - Event CSV parsing |
| `ops-event-validation.test.ts` | 26 tests - Event validation |
| `ops-event-diff.test.ts` | 15 tests - Event diff computation |
| `ops-override-csv.test.ts` | 36 tests - Override CSV/validation/diff |

**Key Design Decisions:**
1. **No verification in CSV:** Verification timestamps excluded to prevent spreadsheet mistakes. Use UI bulk actions instead.
2. **Override upsert:** Creates new overrides if (event_id, date_key) not found, updates if found.
3. **Notes → host_notes mapping:** CSV uses `notes` column, maps to `host_notes` DB column.
4. **Event type validation:** Warns on unknown types (forward compatibility) but errors on invalid status.

---

### Phase 4.61 — Ops Console v1: Venue Bulk Management (January 2026)

**Goal:** Admin-only bulk management for venues via CSV export/import.

**How to Use Ops Console v1:**
1. Navigate to `/dashboard/admin/ops/venues`
2. **Export:** Click "Download CSV" to get all venues
3. **Edit:** Open CSV in Excel/Sheets, update `google_maps_url` or other fields
4. **Preview:** Upload edited CSV, review diff before applying
5. **Apply:** Confirm changes to update database

**Google Maps URL Helper:**
- Select venue missing `google_maps_url` from dropdown
- Click generated search URL to find venue on Google Maps
- Copy the place URL and paste into CSV

**Files Added:**

| File | Purpose |
|------|---------|
| `scripts/data-health.ts` | CLI health report (`cd web && npx tsx scripts/data-health.ts`) |
| `lib/ops/venueValidation.ts` | Row-level CSV validation |
| `lib/ops/venueCsvParser.ts` | CSV parse/serialize |
| `lib/ops/venueDiff.ts` | Diff computation |
| `lib/ops/googleMapsHelper.ts` | URL generation helper |
| `lib/audit/opsAudit.ts` | Audit logging for ops actions |
| `api/admin/ops/venues/export/route.ts` | GET - CSV download |
| `api/admin/ops/venues/preview/route.ts` | POST - Preview diff |
| `api/admin/ops/venues/apply/route.ts` | POST - Apply changes |
| `dashboard/admin/ops/page.tsx` | Ops Console landing |
| `dashboard/admin/ops/venues/page.tsx` | Venue bulk management UI |

**Test Coverage:** 71 new tests (1474 total).

**Constraints:**
- Update-only (no venue creation via CSV)
- Admin-only (uses `checkAdminRole()`)
- Simple CSV parser (no multi-line cells)

---

### Phase 4.60 — Get Directions Venue Name Fallback (January 2026)

**Goal:** Fix "Get Directions" to find the actual venue on Google Maps, not just the building address.

**Problem:**
- 76 of 91 venues don't have `google_maps_url` set
- Fallback searched by address only (e.g., "10040 W 26th Ave")
- Google Maps showed the building, not the venue (Tavern on 26th)

**Solution:**
- Fallback now searches "Venue Name Address" (e.g., "Tavern on 26th 10040 W 26th Ave")
- Google Maps finds the actual place with reviews, hours, photos

**Priority Order:**
1. `venue.google_maps_url` (valid http/https)
2. lat/lng (for custom locations)
3. venue name + address search
4. address-only search
5. name-only search
6. null (disabled)

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | `getGoogleMapsUrl()` now accepts `venueName` parameter, handles all edge cases |
| `app/venues/[id]/page.tsx` | Fallback URL includes venue name, handles name-only case |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-60-google-maps-fallback.test.ts` | 24 tests for URL generation priority and edge cases |

**Before/After:**
- Before: `maps.google.com/search/?query=10040+W+26th+Ave` (shows building)
- After: `maps.google.com/search/?query=Tavern+on+26th+10040+W+26th+Ave` (shows venue)

**Edge Cases Handled:**
- Name-only search when address is null
- Address-only search when name is null
- Unicode venue names (properly encoded)
- Special characters (apostrophes, ampersands)
- Custom locations use lat/lng when available

**Test Coverage:** 1403 tests passing (24 new tests).

---

### Phase 4.59 — Kindred Groups + Jam Sessions Filter Pills (January 2026)

**Goal:** Add quick-access filter pills for Kindred Songwriter Groups and new Jam Sessions event type on /happenings page.

**New Event Type:**

| Type | Label | Description | Icon |
|------|-------|-------------|------|
| `jam_session` | Jam Session | Casual music gathering for jamming and improvisation | 🎸 |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260111000002_add_jam_session_event_type.sql` | Adds `jam_session` to `event_type` PostgreSQL enum |

**New Filter Pills:**

| Pill | Event Type | Icon |
|------|------------|------|
| Kindred | `kindred_group` | HeartIcon (hand-drawn heart) |
| Jams | `jam_session` | GuitarIcon (electric guitar) |

**Filter Pills Layout:**
- Changed from 3-column grid to flexible wrap layout
- 5 pills total: Open Mics, DSC, Shows, Kindred, Jams
- Responsive: wraps naturally on narrow screens

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260111000002_add_jam_session_event_type.sql` | Enum extension |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Added HeartIcon, GuitarIcon, Kindred + Jams pills, flex wrap layout |
| `app/happenings/page.tsx` | Added `jam_session` query handling and page title |
| `types/events.ts` | Added `jam_session` to EventType union and EVENT_TYPE_CONFIG |
| `components/happenings/HappeningCard.tsx` | Added `jam_session` to EVENT_TYPE_LABELS and DEFAULT_EVENT_IMAGES |
| `components/happenings/SeriesCard.tsx` | Added `jam_session` to DEFAULT_EVENT_IMAGES |

**Event Types Now Supported (9 total):**
- `song_circle`, `workshop`, `meetup`, `showcase`, `open_mic`, `gig`, `kindred_group`, `jam_session`, `other`

**Dashboard Support:**
- Event creation form automatically includes new types via `EVENT_TYPE_CONFIG` iteration
- All dashboards use fallback pattern: `EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other`

**Test Coverage:** 1379 tests passing.

---

### Phase 4.58 — Venue Directory MVP (January 2026)

**Goal:** Public venue directory pages for discovering venues hosting happenings.

**New Routes:**

| Route | Purpose |
|-------|---------|
| `/venues` | Index page showing all venues in alphabetical grid |
| `/venues/[id]` | Detail page with venue info + happenings at venue |

**New Components:**

| Component | Path | Purpose |
|-----------|------|---------|
| VenueCard | `components/venue/VenueCard.tsx` | Card with name, location, event count, link icons |
| VenueGrid | `components/venue/VenueGrid.tsx` | Responsive grid layout (1/2/3/4 cols) |

**Features:**
- Event count badge shows upcoming happenings per venue ("0 upcoming", "1 happening", "12 happenings")
- Get Directions button (prefers `google_maps_url`, falls back to address-based Google Maps link)
- Website/phone links when available
- Accessibility notes and parking notes displayed on detail page
- HappeningCard grid for venue's upcoming events
- Uses existing `card-spotlight` surface pattern

**Security:**
- `venues.notes` field NOT exposed on public pages (admin-only)
- No new RLS needed (public SELECT already exists on venues table)

**Data:**
- 91 venues in database
- 15/91 (16%) have `google_maps_url`
- 45/91 (49%) have `website_url`

**Files Added:**

| File | Purpose |
|------|---------|
| `app/venues/page.tsx` | Index page |
| `app/venues/[id]/page.tsx` | Detail page |
| `components/venue/VenueCard.tsx` | Card component |
| `components/venue/VenueGrid.tsx` | Grid wrapper |
| `docs/investigation/venue-directory-mvp.md` | Investigation doc |

**Files Modified:**

| File | Change |
|------|--------|
| `types/index.ts` | Added `zip`, `neighborhood`, `contact_link`, `accessibility_notes`, `parking_notes` to Venue type |

**Test Coverage:** 1379 tests passing (11 new for series venue links).

**Series → Venue Cross-Linking:**
- SeriesCard venue names now link to `/venues/[id]` when `venue_id` exists
- Custom locations render as plain text (no venue_id to link)
- Uses internal `<Link>` component, not external VenueLink

**Navigation:**
- Added "Venues" to main navigation (desktop + mobile)
- Positioned after "Happenings" in nav order

**Files Modified (Cross-Linking):**

| File | Change |
|------|--------|
| `components/happenings/SeriesCard.tsx` | Venue names link to /venues/[id] |
| `components/navigation/header.tsx` | Added Venues to navLinks array |
| `__tests__/phase4-58-series-venue-links.test.ts` | 11 new tests for venue link logic |

**Deferred:**
- Search/filter on venues index
- Map view (requires lat/lng migration)
- Venue engagement v1 (claims, tags, photos) - STOP-GATE for later

---

### Phase 4.57 — Series View Sliding Day Headers (January 2026)

**Goal:** Add sticky day-of-week headers to Series view, matching the Timeline view's DateSection behavior.

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| Day grouping | Series entries grouped by `day_of_week` field |
| Sticky headers | Same styling as DateSection: `sticky top-[120px] z-20` with backdrop blur |
| Day ordering | Days ordered starting from today (e.g., if Friday, shows Fri → Sat → Sun → Mon...) |
| Collapsible sections | Each day section has chevron toggle to collapse/expand |
| One-time events | Events without recurring day grouped as "One-time" |
| Schedule Unknown | Events with incomplete schedule info shown at bottom with amber accent |

**SeriesView.tsx Restructure:**
- Added `DaySection` component with sticky header and collapse toggle
- Added `getDayOrderFromToday()` for relative day ordering
- Groups series by `day_of_week` using `React.useMemo`
- Matches DateSection styling exactly

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/SeriesView.tsx` | Complete restructure with day grouping and sticky headers |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.56 — Kindred Songwriter Groups Event Type (January 2026)

**Goal:** Add new event type for happenings hosted by other local songwriter communities (non-DSC groups).

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| New event type | `kindred_group` added to EventType union |
| Label | "Kindred Songwriter Groups" |
| Icon | 🤝 (handshake emoji) |
| Filter support | Added to HappeningsFilters TYPE_OPTIONS dropdown |
| Card labels | Added to HappeningCard and SeriesCard EVENT_TYPE_LABELS |
| Default image | Uses song-circle.svg (similar community vibe) |
| Claim CTA | Help text added: "Do you host one of these happenings? Click to claim as host" |

**Database Migration (`20260111000001_add_event_types.sql`):**
- Added `gig` to event_type enum
- Added `meetup` to event_type enum
- Added `kindred_group` to event_type enum

**Files Modified:**

| File | Change |
|------|--------|
| `types/events.ts` | Added `kindred_group` to EventType and EVENT_TYPE_CONFIG |
| `components/happenings/HappeningsFilters.tsx` | Added to TYPE_OPTIONS |
| `components/happenings/HappeningCard.tsx` | Added to EVENT_TYPE_LABELS and DEFAULT_EVENT_IMAGES |
| `components/happenings/SeriesCard.tsx` | Added to DEFAULT_EVENT_IMAGES |
| `app/happenings/page.tsx` | Added filter handling, page title, filter summary, claim CTA |
| `lib/supabase/database.types.ts` | Regenerated with new enum values |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.55 — Happenings Page UX Redesign (January 2026)

**Goal:** Transform the Happenings page from a "database GUI" feel into an inviting discovery experience for songwriters, music fans, and venues.

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| ViewModeSelector | Hero-level visual cards for Timeline/Series selection |
| Progressive disclosure | All advanced filters collapsed by default in a card |
| Quick filter cards | Compact Open Mics, DSC Happenings, Shows buttons |
| Polished search | Larger (py-3), rounded-xl, improved focus states |
| Humanized summary | "X tonight · Y this weekend · Z in next 3 months" |
| Terminology fix | Remaining "event" → "happening" changes |

**ViewModeSelector Component (new):**
- Two large cards side-by-side (Timeline vs Series)
- Visual icon + headline + 1-line description
- Active state: `card-spotlight` styling with gold glow
- Uses `--shadow-card-hover` for active state

**HappeningsFilters Redesign:**
- Quick filter cards at top (smaller than before: py-3 vs py-4)
- Search bar enhanced: py-3, rounded-xl, focus ring
- Filters collapsed by default in `<details>` element
- Filter summary in collapsed header (e.g., "Mon, Tue · Free")
- Active filter count badge on collapsed section
- Days, When, Type, Cost in organized grid when expanded

**Humanized Results Summary:**
- Default view: "X tonight · Y this weekend · Z this week · Total in next 3 months"
- Filtered views: "X happenings across Y dates (context)"

**Files Added:**

| File | Purpose |
|------|---------|
| `components/happenings/ViewModeSelector.tsx` | Hero-level view mode cards |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Redesigned with progressive disclosure |
| `components/happenings/StickyControls.tsx` | Removed inline toggle, uses ViewModeSelector |
| `app/happenings/page.tsx` | Humanized results summary, time period counts |
| `app/page.tsx` | Fixed "DSC Events" → "DSC Happenings" |
| `__tests__/happenings-filters.test.ts` | Updated for new UI structure |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.53 — Comment Editing + Guest Comment Deletion (January 2026)

**Goal:** Enable comment editing for all logged-in users and allow guests to delete their own comments via email verification.

**Comment Editing:**

| Feature | Implementation |
|---------|----------------|
| Edit endpoint | `PATCH /api/comments/[id]` for all comment types |
| Authorization | Only comment author can edit (not admin, not moderator) |
| UI | Edit button appears on hover, inline textarea with Save/Cancel |
| Indicator | "(edited)" shown next to timestamp for edited comments |
| Guest comments | Cannot be edited (no way to re-authenticate) |

**Guest Comment Deletion:**

| Feature | Implementation |
|---------|----------------|
| Request code | `POST /api/guest/comment-delete/request-code` |
| Verify code | `POST /api/guest/comment-delete/verify-code` |
| Validation | Guest must enter same email used when posting comment |
| Action | Soft-delete (`is_deleted = true`) preserves data |
| UI | Modal with email input → verification code input |

**Database Migrations:**

| Migration | Purpose |
|-----------|---------|
| `20260110200000_add_comment_edited_at.sql` | Adds `edited_at` column to all 5 comment tables |
| `20260110210000_add_delete_comment_action_type.sql` | Adds `delete_comment` to valid action types |

**Files Added:**

| File | Purpose |
|------|---------|
| `app/api/comments/[id]/route.ts` | PATCH endpoint for editing comments |
| `app/api/guest/comment-delete/request-code/route.ts` | Guest deletion verification request |
| `app/api/guest/comment-delete/verify-code/route.ts` | Guest deletion verification + soft-delete |

**Files Modified:**

| File | Change |
|------|--------|
| `components/comments/CommentThread.tsx` | Edit UI, guest delete modal, `edited_at` display |

**Comment Tables Supported:**
- `blog_comments`
- `gallery_photo_comments`
- `gallery_album_comments`
- `profile_comments`
- `event_comments`

**Permission Matrix:**

| Action | Logged-in Author | Admin | Guest (via email) |
|--------|------------------|-------|-------------------|
| Edit | Yes | No | No |
| Delete | Yes | Yes | Yes (soft-delete) |

---

### Phase 4.51j — Page Scroll Reset (January 2026)

**Goal:** Fix pages loading scrolled down instead of at the top.

**Problem:** Pages (especially profile pages like `/songwriters/[id]`) were loading with a slight scroll offset instead of starting at the top.

**Root Cause:** Browser scroll restoration combined with `scroll-behavior: smooth` could cause pages to restore a previous scroll position from navigation history.

**Solution:** Created `ScrollReset` client component that:
1. Tracks back/forward navigation via `popstate` event listener
2. Fresh navigation (clicking links): Scrolls to top
3. Back/forward buttons: Allows browser to restore previous scroll position
4. Hash anchors (e.g., `#comments`): Browser handles natively

**Files Added:**

| File | Purpose |
|------|---------|
| `components/layout/ScrollReset.tsx` | Client component to reset scroll position |

**Files Modified:**

| File | Change |
|------|--------|
| `app/layout.tsx` | Added `<ScrollReset />` to root layout |

---

### Phase 4.51i — Homepage Copy, Notification Deep-Linking, Supabase Types & Maps Fix (January 2026)

**Goal:** Homepage copy updates, notification deep-linking for all notification types, Supabase type regeneration, and Google Maps link fix.

**Homepage Copy Updates:**

| Change | Details |
|--------|---------|
| New audience segment | Added "🌀 a fan of songs and songwriters" to "Join us if you're..." section |
| Live music venue | Changed "an open mic host or venue" → "an open mic host or live music venue" |
| Grid layout | Changed from 4 to 5 columns to accommodate new item |

**Notification Deep-Linking:**

All notification types now include hash anchors so users land directly on the relevant content:

| Notification Type | Deep-Link Target |
|-------------------|------------------|
| Event RSVP | `#attendees` |
| Event Comment | `#comments` |
| Timeslot Claim | `#lineup` |
| Gallery Photo Comment | `#comments` |
| Gallery Album Comment | `#comments` |
| Blog Comment | `#comments` |
| Profile Comment | `#comments` |
| Waitlist Offer | `#rsvp` |

**Anchor IDs Added to Components:**

| Component | Anchor ID |
|-----------|-----------|
| `TimeslotSection.tsx` | `id="lineup"` |
| `RSVPSection.tsx` | `id="rsvp"` |
| `BlogComments.tsx` | `id="comments"` |
| `GalleryComments.tsx` | `id="comments"` |
| `ProfileComments.tsx` | `id="comments"` |

**Supabase Type Regeneration:**

- Regenerated `database.types.ts` with `event_watchers` table now included
- Removed all `(supabase as any)` type casts from:
  - `app/api/events/[id]/watch/route.ts`
  - `app/api/events/[id]/rsvp/route.ts`
  - `app/api/events/[id]/comments/route.ts`
  - `app/api/guest/rsvp/verify-code/route.ts`
  - `app/api/guest/event-comment/verify-code/route.ts`
  - `app/events/[id]/page.tsx`
- Updated test documentation in `phase4-51d-union-fanout-watch.test.ts`

**Google Maps Link Fix:**

Fixed "Get Directions" button not appearing when event had `venue_id` but NULL `venue_address`:

| Before | After |
|--------|-------|
| Only fetched venue if `venue_name` was NULL | Fetches venue if `venue_name` OR `venue_address` is NULL |
| Events with name but no address showed no maps link | Maps link now appears for all events with venue |

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Homepage copy updates |
| `app/events/[id]/page.tsx` | Venue fetch fix, type cast removal |
| `app/api/guest/timeslot-claim/verify-code/route.ts` | `#lineup` deep-link |
| `app/api/guest/gallery-*/verify-code/route.ts` | `#comments` deep-links |
| `app/api/guest/blog-comment/verify-code/route.ts` | `#comments` deep-links |
| `app/api/guest/profile-comment/verify-code/route.ts` | `#comments` deep-links |
| `lib/waitlistOffer.ts` | `#rsvp` deep-link |
| `components/events/TimeslotSection.tsx` | Added `id="lineup"` |
| `components/events/RSVPSection.tsx` | Added `id="rsvp"` |
| `components/blog/BlogComments.tsx` | Added `id="comments"` |
| `components/gallery/GalleryComments.tsx` | Added `id="comments"` |
| `components/comments/ProfileComments.tsx` | Added `id="comments"` |
| `lib/supabase/database.types.ts` | Regenerated with event_watchers |

---

### Phase 4.51h — Featured Blog Posts + Homepage Layout (January 2026)

**Goal:** Allow admin to feature a blog post on the homepage, creating a 4-card layout for the blog section.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Featured blog toggle | Admin can mark one blog post as "featured" (only one at a time) |
| Homepage 4-card layout | Featured post + 2 latest non-featured posts + Share Your Story CTA |
| Featured badge | ★ Featured badge displayed on featured post cards |
| Auto-unfeaturing | When featuring a post, all others are automatically unfeatured |

**Database Migration (`20260110100000_add_blog_featured.sql`):**

| Table | Changes |
|-------|---------|
| `blog_posts` | Added `is_featured` boolean column (default false) |
| Index | Added partial index on `is_featured WHERE is_featured = true` |

**Files Modified:**

| File | Change |
|------|--------|
| `app/(protected)/dashboard/admin/blog/BlogPostsTable.tsx` | Added Featured column with toggle button |
| `app/(protected)/dashboard/admin/blog/page.tsx` | Added `is_featured` to query select |
| `app/page.tsx` | Separate queries for featured + latest, 4-column grid layout |

**Homepage Blog Section Logic:**
1. Query featured blog post (if any)
2. Query latest 2 non-featured, published posts
3. Combine: featured first (if exists) + latest posts
4. Display in 4-column grid with Share Your Story CTA as final card

---

### Phase 4.51g — Guest Timeslot Claim Confirmation Emails (January 2026)

**Goal:** Send proper confirmation emails to guests who claim timeslots, and fix host notification messaging.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Guest confirmation email | Sent to guest after successful timeslot claim |
| Host notification email | Properly says "signed up for slot X" (not "left a comment") |
| Cancel link | Guest confirmation includes cancel URL |
| Slot details | Shows slot number, time, venue, event info |

**New Email Templates:**

| Template | Path | Purpose |
|----------|------|---------|
| timeslotClaimConfirmation | `lib/email/templates/timeslotClaimConfirmation.ts` | Confirmation sent to guest after claim |
| timeslotSignupHostNotification | `lib/email/templates/timeslotSignupHostNotification.ts` | Notification to host when someone claims slot |

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/guest/timeslot-claim/verify-code/route.ts` | Uses new email templates, added helper functions |

**Guest Confirmation Email Contents:**
- Performer name greeting
- Slot number and time
- Event title, date, time
- Venue name and address
- Link to event page
- Cancel booking link

**Host Notification Email Contents:**
- Performer name with "(guest)" label if applicable
- Slot number and time
- Event title
- "View Lineup" button
- Notification preference reminder

---

### Phase 4.51f — Guest Comments Everywhere + Guest Timeslot Claiming (January 2026)

**Goal:** Enable guest commenting (with email verification) on all content types: gallery photos, gallery albums, blog posts, and member profiles. Also enable guests to claim timeslots at events.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Guest gallery photo comments | Email verification → comment creation → notify uploader |
| Guest gallery album comments | Email verification → comment creation → notify album owner |
| Guest blog comments | Email verification → comment creation → notify blog author |
| Guest profile comments | Email verification → comment creation → notify profile owner |
| Guest timeslot claiming | Email verification → slot claim → notify event host |
| Reply notifications | Parent comment author notified when guest replies |
| Shared GuestCommentForm | Reusable component for all guest comment flows |

**Database Migration (`20260108100000_guest_comments_everywhere.sql`):**

| Table | Changes |
|-------|---------|
| `gallery_photo_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `user_id` nullable |
| `gallery_album_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `user_id` nullable |
| `blog_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `author_id` nullable |
| `profile_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `author_id` nullable |
| `guest_verifications` | Added `gallery_image_id`, `gallery_album_id`, `blog_post_id`, `profile_id` target columns |
| `guest_verifications` | Extended `valid_action_type` constraint to include new action types |

**New API Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `POST /api/guest/gallery-photo-comment/request-code` | Request verification for photo comment |
| `POST /api/guest/gallery-photo-comment/verify-code` | Verify & create photo comment |
| `POST /api/guest/gallery-album-comment/request-code` | Request verification for album comment |
| `POST /api/guest/gallery-album-comment/verify-code` | Verify & create album comment |
| `POST /api/guest/blog-comment/request-code` | Request verification for blog comment |
| `POST /api/guest/blog-comment/verify-code` | Verify & create blog comment |
| `POST /api/guest/profile-comment/request-code` | Request verification for profile comment |
| `POST /api/guest/profile-comment/verify-code` | Verify & create profile comment |
| `POST /api/guest/timeslot-claim/request-code` | Request verification for timeslot claim |
| `POST /api/guest/timeslot-claim/verify-code` | Verify & create timeslot claim |

**New Components:**

| Component | Path | Purpose |
|-----------|------|---------|
| GuestCommentForm | `components/comments/GuestCommentForm.tsx` | Shared guest comment UI with email verification flow |
| GuestTimeslotClaimForm | `components/events/GuestTimeslotClaimForm.tsx` | Guest timeslot claim UI with verification |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/templates/contentCommentNotification.ts` | Added "event" content type |
| `lib/email/templates/verificationCode.ts` | Added new verification purposes |
| `components/comments/CommentThread.tsx` | Guest comment support via `guestCommentType` prop |
| `components/blog/BlogComments.tsx` | Integrated GuestCommentForm for logged-out users |
| `components/events/TimeslotSection.tsx` | Guest timeslot claiming UI |

**Notification Flow:**

| Trigger | Recipient | Notification Type |
|---------|-----------|-------------------|
| Guest comments on photo | Photo uploader | `gallery_comment` |
| Guest comments on album | Album owner | `gallery_comment` |
| Guest comments on blog | Blog author | `blog_comment` |
| Guest comments on profile | Profile owner | `profile_comment` |
| Guest claims timeslot | Event host | `event_signup` |
| Guest replies to comment | Parent comment author | Same type as parent |

**Type Casting Note:**

New database columns (`gallery_image_id`, `gallery_album_id`, `blog_post_id`, `profile_id`, `guest_*` columns) are not yet in generated Supabase types. All routes use `(supabase as any)` type casts until types are regenerated.

**Build Status:** Passing. Migration must be applied with `npx supabase db push` before deploy.

---

### Phase 4.51e — Notification Management UX (January 2026)

**Goal:** Add full notification management for users who may accumulate hundreds/thousands of notifications.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Type filtering | Dropdown to filter by notification type (RSVPs, Comments, Waitlist, etc.) |
| Unread only toggle | Checkbox to show only unread notifications |
| Mark all read | Bulk action to mark all notifications as read |
| Delete read | Bulk action to delete all read notifications |
| Delete older than 30 days | Bulk action to clean up old notifications |
| Cursor pagination | Load more button with server-side pagination |
| Total/unread counts | Shows total count and unread count in header |
| Email preferences link | Direct link to `/dashboard/settings` for email preference management |
| Dashboard link | "Manage all →" link always visible in dashboard notification widget |

**Comment Notification Title Fix:**

Comment notifications now show who made the comment instead of generic "New comment on...":
- Member comments: `"{name} commented on "{event}""` or `"{name} replied to your comment"`
- Guest comments: `"{name} (guest) commented on "{event}""`

**Type Cast Fix:**

Fixed intermittent query failures for `event_watchers` table:
- Changed from `.from("event_watchers" as "events")` aggressive cast
- To `(supabase as any).from("event_watchers")` simple cast (matches working routes)

**Files Changed:**

| File | Change |
|------|--------|
| `app/api/notifications/route.ts` | Added cursor pagination, type filter, DELETE endpoint |
| `dashboard/notifications/NotificationsList.tsx` | Complete rewrite with filters, pagination, bulk actions |
| `dashboard/notifications/page.tsx` | Added initialCursor and initialTotal props |
| `dashboard/page.tsx` | "Manage all →" link always visible |
| `app/api/events/[id]/comments/route.ts` | Comment notification title shows commenter name |
| `app/api/guest/event-comment/verify-code/route.ts` | Guest comment notification title shows name |
| `app/api/guest/rsvp/verify-code/route.ts` | Fixed type cast for event_watchers query |
| `app/api/events/[id]/watch/route.ts` | Fixed type cast for event_watchers queries |

**Email Preferences Coverage:**

Verified the 3 email preference categories cover all notification types:

| Category | Templates |
|----------|-----------|
| `claim_updates` | eventClaimSubmitted, eventClaimApproved, eventClaimRejected |
| `event_updates` | eventReminder, eventUpdated, eventCancelled, rsvpConfirmation, waitlistPromotion, eventCommentNotification, rsvpHostNotification, occurrenceCancelledHost, occurrenceModifiedHost |
| `admin_notifications` | adminEventClaimNotification, contactNotification |

**Test Coverage:** All 1281 tests passing.

**Data Seeding (One-Time):**

Seeded default open mic image to 97 events without cover images:
- Image URL: Supabase signed URL (expires 2036)
- All 105 events now have `cover_image_url` set

**HappeningCard Image Fix:**

Changed Tier 2 image rendering from blurred letterbox to standard cover:
- Removed blur background effect (`filter: blur(12px) brightness(0.7)`)
- Changed `object-contain` to `object-cover` (fills card, crops if needed)
- Now consistent with Tier 1 and Tier 3 rendering

**Image Cropping Alignment (object-top):**

Added `object-top` to all image displays so cropping shows top of image (cuts bottom):
- HappeningCard: All 3 tiers (card image, cover image, default image)
- EventCard: Deprecated but updated for consistency
- ImageUpload: Preview thumbnail matches card display
- This preserves faces/heads in photos with people

**Empty Time Field Error Fix:**

Fixed "invalid input syntax for type time: ''" error when using "Use Original Image":
- PATCH `/api/my-events/[id]` now converts empty strings to null for time fields
- Affected fields: `start_time`, `end_time`
- Root cause: PostgreSQL time type cannot accept empty string ""

---

### Phase 4.51d — Union Fan-out + Admin Watch/Unwatch (January 2026)

**Goal:** Change notification fan-out from fallback pattern to union pattern, and add admin-only Watch/Unwatch button.

**Problem: Admin not receiving notifications for events they watch**

When admin was in `event_watchers` for an event that also had a `host_id` set, the admin didn't receive notifications. The fan-out pattern was `hosts OR watchers (fallback)` - watchers were only notified when no hosts existed.

**Fix:** Changed to union pattern with deduplication:
- Fan-out order: `event_hosts` ∪ `events.host_id` ∪ `event_watchers` (union with dedupe)
- All three sources are checked regardless of whether previous sources had entries
- Uses `Set<string>` to deduplicate (user in multiple categories gets ONE notification)
- Actor suppression preserved (don't notify the person who triggered the action)

**Admin Watch/Unwatch Feature:**
- New API endpoint: `GET/POST/DELETE /api/events/[id]/watch`
- GET: Check if current user is watching (returns `{ watching: boolean }`)
- POST: Add watcher (admin-only, returns 403 for non-admins)
- DELETE: Remove watcher (any authenticated user)
- New `WatchEventButton` client component
- Button appears in admin section of event detail page

**Files Changed:**

| File | Change |
|------|--------|
| `app/api/events/[id]/rsvp/route.ts` | Union fan-out for member RSVP notifications |
| `app/api/guest/rsvp/verify-code/route.ts` | Union fan-out for guest RSVP notifications |
| `app/api/events/[id]/comments/route.ts` | Union fan-out for member comment notifications |
| `app/api/guest/event-comment/verify-code/route.ts` | Union fan-out for guest comment notifications |
| `app/api/events/[id]/watch/route.ts` | NEW: Watch API endpoint (GET/POST/DELETE) |
| `components/events/WatchEventButton.tsx` | NEW: Admin-only watch toggle button |
| `app/events/[id]/page.tsx` | Watcher status query + WatchEventButton |
| `__tests__/phase4-51d-union-fanout-watch.test.ts` | 37 tests for fan-out, dedupe, watch API |

**Type Cast Note:** `event_watchers` table exists but not in generated TypeScript types. Uses `(supabase as any).from("event_watchers")` type cast in all files that query it (fixed in Phase 4.51e).

**Test Coverage:** 37 new tests.

**Commit:** `859e42f`

---

### Phase 4.51c — Guest-First CTA + Guest RSVP Notifications + Functional Notifications (January 2026)

**Goal:** Improve guest RSVP discoverability, fix missing host/watcher notifications for guest RSVPs, and add functional notification controls.

**Problem 1: Guest RSVP CTA was not discoverable**

When logged out, the prominent "RSVP Now" button redirected to `/login`, while the guest RSVP option was a small text link below that users missed.

**Fix:** Guest-first CTA pattern when logged out:
- Primary button: "RSVP as Guest" (same styling as member button)
- Secondary link: "Have an account? Log in" (subtle text below)
- When logged in: "RSVP Now" unchanged

**Problem 2: Guest RSVPs didn't notify hosts/watchers**

Guest RSVP verify-code endpoint created the RSVP but did NOT send any host/watcher notifications. Member RSVPs did.

**Fix:** Added `notifyHostsOfGuestRsvp()` to guest verify-code endpoint:
- Uses EXACT same notification type (`"event_rsvp"`) as member RSVP
- Uses EXACT same templateKey (`"rsvpHostNotification"`) as member RSVP
- Fan-out order: `event_hosts` → `events.host_id` → `event_watchers` (fallback)
- Guest name includes "(guest)" label in notification title/message

**Problem 3: RSVP and Comment notifications looked identical**

Both notification types displayed the same default bell icon (🔔), making it impossible to distinguish them at a glance.

**Fix:** Added distinct emoji icons per notification type:
- `event_rsvp` → ✅ (checkmark)
- `event_comment` → 💬 (speech bubble)
- `waitlist_promotion` → 🎉 (celebration)
- Default → 🔔 (bell)

**Problem 4: Notifications had no user controls**

Notifications auto-marked as read on mount, no way to mark all read, no way to filter read/unread, and no deep-links to specific sections.

**Fix:** Functional notification controls:
- **Click to mark read:** Notifications only mark as read when clicked (removed auto-mark on mount)
- **Mark all read:** Button to mark all unread notifications as read with optimistic UI
- **Hide read toggle:** Client-side filter to show only unread notifications
- **Deep-links:** RSVP notifications link to `#attendees`, Comment notifications link to `#comments`

**Files Changed:**

| File | Change |
|------|--------|
| `components/events/RSVPButton.tsx` | Guest-first CTA when logged out |
| `app/api/guest/rsvp/verify-code/route.ts` | Host/watcher notification logic + `#attendees` deep-link |
| `app/api/events/[id]/rsvp/route.ts` | RSVP notification link includes `#attendees` |
| `dashboard/notifications/NotificationsList.tsx` | Distinct icons, mark-on-click, mark-all, hide-read |
| `components/events/AttendeeList.tsx` | Added `id="attendees"` anchor for deep-linking |
| `__tests__/phase4-51c-guest-rsvp-discoverability.test.ts` | 17 tests for guest-first CTA |
| `__tests__/phase4-51c-guest-rsvp-notifications.test.ts` | 19 tests for notification parity |
| `__tests__/notification-icons.test.ts` | 14 tests for distinct icons |
| `__tests__/notification-interactions.test.ts` | 21 tests for functional controls |

**Test Coverage:** 71 new tests (17 CTA + 19 notifications + 14 icons + 21 interactions).

**Commits:**
- `34d8d69` — Guest-first CTA (Phase 4.51c)
- `544336c` — Guest RSVP host/watcher notifications
- `81b9fe5` — Distinct icons for RSVP vs Comment notifications
- `cc01914` — Functional notifications (mark-on-click, mark-all, hide-read, deep-links)

---

### Phase 4.51b — Guest Verification Always-On + Hotfixes (January 2026)

**Goal:** Remove feature flag gating from guest endpoints. Guest RSVP + Guest Comments work in Production by default with zero manual Vercel env vars.

**Key Change:** Guest verification is now **always enabled**. No `ENABLE_GUEST_VERIFICATION` env var required.

**Emergency Kill Switch (if needed):**
- Set `DISABLE_GUEST_VERIFICATION=true` to disable guest verification
- Returns 503 (not 404) with clear message
- Only use for emergencies - guest features are core UX

**Health Endpoint:**
- `GET /api/health/guest-verification`
- Returns: `{ enabled: true, mode: "always-on", timestamp: "..." }`
- No authentication required

**Hotfix 1: Database Constraint (commit `1002d67`)**

Production guest comments were failing with 500 error:
```
new row for relation "guest_verifications" violates check constraint "valid_action_type"
```

**Root Cause:** Original constraint only allowed `('confirm', 'cancel')` but guest comments use `action_type = 'comment'`.

**Fix:** Migration `20260107000005_fix_guest_verification_action_type.sql` expands constraint:
```sql
CHECK (action_type IS NULL OR action_type IN ('confirm', 'cancel', 'comment', 'cancel_rsvp'))
```

**Hotfix 2: Alphanumeric Verification Codes (commit `7dd7b65`)**

Users could only type 1 character in verification code input.

**Root Cause:** Input used `/\D/g` regex (digits only) but codes contain letters (e.g., `5GGRYK`).

**Fix:** Changed to `/[^A-Za-z0-9]/g` regex with auto-uppercase. Updated placeholder from `000000` to `ABC123`.

**Hotfix 3: Context-Aware Verification Emails (commit `f2a774b`)**

Guest comment verification emails incorrectly said "claim a slot" instead of "post a comment".

**Fix:** Added `purpose` parameter to `getVerificationCodeEmail()` template:
- `slot`: "claim a slot at" (default)
- `rsvp`: "RSVP to"
- `comment`: "post a comment on"

**Hotfix 4: Guest Comments Notify Watchers (commit `68ef1e7`)**

Guest comments weren't notifying event watchers (only checked hosts).

**Fix:** Added event_watchers fallback to `/api/guest/event-comment/verify-code` notification flow.

**Hotfix 5: Notification Function Broken (commit `1a6db3f`)**

ALL dashboard notifications were silently failing with "type notifications does not exist".

**Root Cause:** `create_user_notification` function had `SET search_path TO ''` (empty), so it couldn't resolve the `public.notifications` type.

**Fix:** Migration `20260108000001_fix_notification_function_search_path.sql`:
```sql
SET search_path TO 'public'  -- was ''
```

This affected ALL 5 places that create notifications:
- `sendWithPreferences.ts` (comments, RSVPs, etc.)
- `waitlistOffer.ts`
- `invitations/[id]/route.ts`
- `my-events/[id]/route.ts`
- `my-events/[id]/cohosts/route.ts`

**Files Changed:**

| File | Change |
|------|--------|
| `lib/guest-verification/config.ts` | Renamed to `isGuestVerificationDisabled()`, 503 response, relaxed rate limits |
| `app/api/guest/*/route.ts` | Updated to use kill switch (7 files) |
| `app/api/health/guest-verification/route.ts` | NEW health endpoint |
| `migrations/20260107000005_fix_guest_verification_action_type.sql` | Expanded valid_action_type constraint |
| `migrations/20260108000001_fix_notification_function_search_path.sql` | Fixed search_path |
| `components/events/EventComments.tsx` | Alphanumeric code input fix |
| `components/events/RSVPButton.tsx` | Alphanumeric code input fix |
| `lib/email/templates/verificationCode.ts` | Added `purpose` parameter |
| `app/api/guest/event-comment/request-code/route.ts` | Pass `purpose: "comment"` |
| `app/api/guest/rsvp/request-code/route.ts` | Pass `purpose: "rsvp"` |
| `app/api/guest/event-comment/verify-code/route.ts` | Added watcher fallback |
| `__tests__/phase4-51b-guest-always-on.test.ts` | 22 tests for always-on behavior |
| `docs/SMOKE-PROD.md` | Added smoke tests #13, #14, #15 |

**Test Coverage:** 22 new tests proving guest endpoints work without any env var set.

**Debugging Note:** These issues were diagnosed using direct Vercel API access (build logs, deployment status) and production database queries via psql. See "Vercel API Access" section above.

**Known Issue (Deferred):** 60 files use `supabase.auth.getSession()` which Supabase warns is insecure (reads from cookies without server verification). Should migrate to `supabase.auth.getUser()` for sensitive operations. This is a larger refactor to be planned separately.

---

### Phase 4.51a — Event Watchers (January 2026)

**Goal:** Notification backstop for unowned events using a "watcher" model.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| `event_watchers` table | Composite PK `(event_id, user_id)` |
| Auto-cleanup trigger | Removes watchers when `host_id` assigned |
| Comment notifications | Falls back to watchers if no hosts |
| RSVP notifications (NEW) | Hosts/watchers notified on RSVP |
| Email template | `rsvpHostNotification.ts` created |
| Backfill | Sami watching all 97 unowned events |

**Notification Fan-Out Order:**
1. `event_hosts` (accepted hosts)
2. `events.host_id` (legacy host)
3. `event_watchers` (fallback only when no hosts exist)

**Key Files:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260107000004_event_watchers.sql` | Schema + trigger + backfill |
| `app/api/events/[id]/comments/route.ts` | Watcher fallback for comments |
| `app/api/events/[id]/rsvp/route.ts` | Host/watcher RSVP notifications |
| `lib/email/templates/rsvpHostNotification.ts` | RSVP notification email |
| `lib/notifications/preferences.ts` | Added rsvpHostNotification mapping |
| `__tests__/phase4-51a-event-watchers.test.ts` | 25 tests |

**Test Coverage:** 25 tests covering schema, fan-out logic, auto-cleanup, and RLS policies.

---

### Phase 4.50b — Past Tab Fix (January 2026)

**Goal:** Fix Happenings "Past" tab showing 0 events.

**Root Cause:** Occurrence expansion and overrides query used hardcoded forward-looking window (`today → today+90`) regardless of `timeFilter`.

**Solution:**

| Change | Implementation |
|--------|----------------|
| Date-aware windows | Window bounds depend on timeFilter (upcoming/past/all) |
| MIN(event_date) query | Past/all modes query earliest event_date for window start |
| Progressive loading | Past mode uses chunked loading (90 days per chunk) |
| Past ordering | DESC (newest-first) instead of ASC |
| Dynamic label | `(next 90 days)` / `(past events)` / `(all time)` |
| DateJumpControl | Now supports past date selection |

**Window Bounds by Mode:**

| Mode | Window Start | Window End |
|------|--------------|------------|
| `upcoming` | today | today+90 |
| `past` | yesterday-90 (or minEventDate) | yesterday |
| `all` | minEventDate | today+90 |

**Key Files:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Window calculation, MIN query, progressive loading, ordering, label |
| `components/happenings/StickyControls.tsx` | New props: `windowStartKey`, `timeFilter` |
| `components/happenings/DateJumpControl.tsx` | Support for past date selection |
| `__tests__/phase4-50b-past-tab-fix.test.ts` | 19 new tests |

**Test Coverage:** 19 new tests covering window bounds, ordering, dynamic labels, progressive loading, and DateJumpControl.

---

### Phase 4.49b — Event Comments Everywhere (January 2026)

**Goal:** Enable comments on ALL event pages (DSC + community) with guest support and notifications.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Comments on all events | Removed DSC-only gate from `/api/events/[id]/comments` |
| Guest comment support | Email verification flow via request-code/verify-code endpoints |
| Host notifications | Dashboard + email when someone comments on their event |
| Reply notifications | Dashboard + email when someone replies to your comment |
| Threaded display | 1-level threading with reply forms inline |

**Schema Changes (Migration `20260107000002`):**

| Change | Details |
|--------|---------|
| `user_id` nullable | Guest comments have `user_id = null` |
| `guest_name` | Display name for guest commenters |
| `guest_email` | Private, used for verification |
| `guest_verified` | Whether email was verified |
| `guest_verification_id` | FK to `guest_verifications` |
| `is_deleted` | Soft delete for moderation |
| CHECK constraint | Must have `user_id` OR `(guest_name AND guest_email)` |

**Key Files:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260107000002_event_comments_guest_support.sql` | Schema changes |
| `app/api/events/[id]/comments/route.ts` | GET/POST with notifications |
| `app/api/guest/event-comment/request-code/route.ts` | Guest verification request |
| `app/api/guest/event-comment/verify-code/route.ts` | Guest verification + comment creation |
| `lib/email/templates/eventCommentNotification.ts` | Email template |
| `components/events/EventComments.tsx` | UI with threading + guest form |
| `app/events/[id]/page.tsx` | Mounted EventComments component |

**Notification Flow:**

| Trigger | Recipients | Category |
|---------|------------|----------|
| Top-level comment | Event host(s) | `event_updates` |
| Reply | Parent comment author | `event_updates` |
| Guest comments | No notifications (verification email only) | — |

**Test Coverage:** 34 new tests in `__tests__/phase4-49b-event-comments.test.ts`

---

### Phase 4.48c — AttendeeList FK Fix (January 2026)

**Goal:** Fix FK relationship hint for AttendeeList user profile lookups.

**Problem:** AttendeeList was failing to fetch user profiles due to incorrect FK hint.

**Solution:** Updated PostgREST FK hint from generic to explicit `!event_rsvps_user_id_fkey`.

---

### Phase 4.48b — Guest RSVP Support (January 2026)

**Goal:** Allow guests to RSVP to events without an account via email verification.

**Key Features:**
- Guest RSVP via email verification (6-digit code)
- Reuses `guest_verifications` table pattern
- Guest RSVPs appear in AttendeeList with "(guest)" label
- Cancel link sent via email for guest RSVPs

---

### Phase 4.47 — Performer Slots Opt-In + Value Framing (January 2026)

**Goal:** Make performer slots fully opt-in for ALL event types — no auto-enable based on event type.

**Key Decisions:**

| Decision | Implementation |
|----------|----------------|
| No auto-enable | Removed `TIMESLOT_EVENT_TYPES` constant and all references |
| Default state | ALL event types start with `has_timeslots: false` |
| Manual opt-in | Host must explicitly toggle to enable performer slots |
| Value framing | When slots are OFF, show benefits to encourage opt-in |

**What Was Removed:**
- `TIMESLOT_EVENT_TYPES` export from SlotConfigSection
- `useEffect` that auto-enabled timeslots based on eventType in EventForm
- Auto-notification UI ("Performer slots auto-enabled for Open Mic")
- `timeslotsAutoEnabled` state and `previousEventTypeRef` ref

**Value Framing Copy (when slots are OFF):**
> **Enable performer slots to:**
> - Let performers sign up in advance
> - Get automatic lineup management
> - Reduce day-of coordination
>
> *You can turn this on or off anytime.*

**Key Files:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Removed TIMESLOT_EVENT_TYPES, added value framing copy |
| `dashboard/my-events/_components/EventForm.tsx` | Removed import, useEffect, auto-notification UI |
| `__tests__/phase4-47-performer-slots-opt-in.test.ts` | 6 new tests |

**Test Coverage:** 6 new tests covering no auto-enable behavior, value framing copy, and manual opt-in requirement.

---

### Phase 4.46 — Join & Signup UX Spotlight (January 2026)

**Goal:** Make "Join & Signup" the star differentiator vs Meetup with clear RSVP + performer slots presentation.

**Changes:**

| Feature | Implementation |
|---------|----------------|
| Section header | "🎤 Join & Signup" with descriptive subtitle |
| Audience RSVP | Always visible subsection with "Always Available" badge |
| Performer Slots | Optional subsection with explicit "Optional" badge + toggle |
| Mini preview | Shows what attendees will see (RSVP + slots if enabled) |
| Custom location copy | Now explicitly says "(this event only)" everywhere |
| Venue wrong? link | Non-admin: mailto / Admin: link to `/dashboard/admin/venues` |

**Key Files:**

| File | Change |
|------|--------|
| `components/ui/VenueSelector.tsx` | Custom location dropdown text updated |
| `dashboard/my-events/_components/EventForm.tsx` | Custom location header + helper text + "Venue wrong?" link |
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Restructured as "Join & Signup" section with mini preview |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | 13 new tests |
| `docs/investigation/phase4-46-join-signup-ux-spotlight.md` | Investigation document |

**Mini Preview Shows:**
- "✓ RSVP Available (unlimited)" or "✓ RSVP Available (X spots)"
- "🎤 N performer slots (M min each)" — only when enabled

**Test Coverage:** 13 new tests covering custom location copy, venue wrong link behavior, section structure, mini preview content, and authorization.

---

### Phase 4.45b — Venue Selector UX Improvements (January 2026)

**Goal:** Improve venue dropdown UX by moving action items to top and fixing RLS mismatch.

**Problems Fixed:**

1. **Action items buried at bottom** — With 65+ venues, "Add new venue" and "Enter custom location" were at the bottom of a long scrollable list
2. **RLS mismatch** — VenueSelector allowed any user to try creating venues, but RLS blocked non-admins (silent failure)
3. **No venue issue reporting** — Users had no way to report incorrect venue data

**Solution:**

| Change | Implementation |
|--------|----------------|
| Reorder dropdown | Actions at TOP: placeholder → + Add new venue → ✎ Enter custom location → separator → venues A-Z |
| Authorization gate | `canCreateVenue` prop controls "Add new venue" visibility (admin-only) |
| Helper text | Non-admins see: "Can't find your venue? Use Custom Location for one-time or approximate locations." |
| Report link | "Report a venue issue" mailto link for non-admins |
| Microcopy | New venue form shows "Creates a reusable venue for future events" |

**Key Files:**

| File | Change |
|------|--------|
| `components/ui/VenueSelector.tsx` | Reordered dropdown, added `canCreateVenue` prop, helper text, microcopy |
| `dashboard/my-events/_components/EventForm.tsx` | Added `canCreateVenue` prop, passes to VenueSelector |
| `dashboard/my-events/new/page.tsx` | Passes `canCreateVenue={isAdmin}` |
| `dashboard/my-events/[id]/page.tsx` | Passes `canCreateVenue={isAdmin}` |
| `__tests__/venue-selector-phase445b.test.tsx` | 17 new tests for Phase 4.45b |
| `docs/investigation/phase4-45a-venue-dropdown-location-workflow.md` | Investigation document |

**Authorization Matrix:**

| Role | Can Create Venue | Can Use Custom Location |
|------|------------------|-------------------------|
| Admin | Yes | Yes |
| Approved Host | No | Yes |
| Member | No | Yes |

**Deferred (Future Phases):**
- Venue lat/lng columns (schema migration)
- Map picker UI
- Geocoding integration
- Combobox refactor (searchable dropdown)

**Test Coverage:** 17 new tests covering dropdown order, authorization, helper text visibility, and venue vs custom location distinction.

---

### Phase 4.44c — Event Form UX Improvements (January 2026)

**Goal:** Improve event creation UX with intent-first form structure and progressive disclosure.

**Changes:**

| Feature | Implementation |
|---------|----------------|
| Intent-first ordering | Form sections reordered: Type → Title → Schedule → Location → Description/Cover → Attendance → Advanced → Publish |
| Auto-timeslot notification | Inline alert below Event Type when switching to open_mic/showcase: "Performer slots enabled" |
| Progressive disclosure | Advanced Options section collapsed by default, expands on click |
| Preview draft link | Edit page shows "Preview as visitor →" for unpublished events |

**Key Files:**

| File | Change |
|------|--------|
| `EventForm.tsx` | Restructured section order, added `showAdvanced` state, auto-timeslot detection |
| `dashboard/my-events/[id]/page.tsx` | Added "Preview as visitor" link for draft events |
| `__tests__/event-form-ux-phase444c.test.tsx` | 17 new tests for form UX contract |
| `docs/SMOKE-PROD.md` | Added Phase 4.44c smoke test section |

**Advanced Section Contents:**
- Timezone
- Cost (is_free, ticket_price)
- External Signup URL
- Age Policy
- DSC Toggle (for approved hosts only)
- Host Notes

**Test Coverage:** 17 new tests covering form order, auto-timeslot logic, advanced collapse, and preview link visibility.

---

### Phase 4.43c/d — RSVP for All Public Events (January 2026) — CLOSED

**Goal:** Enable RSVP for ALL public events, not just DSC events.

**Problem:** RSVPSection and AttendeeList were gated by `is_dsc_event`. All seeded/community open mics have `is_dsc_event=false`, so RSVP never appeared for them. Additionally, `/open-mics/[slug]` had no RSVP UI at all.

**Solution (Phase 4.43c):** Removed `is_dsc_event` gates:
- RSVPSection now renders for any `canRSVP` event (published, not cancelled, not past)
- AttendeeList renders for all events (component handles empty state internally)
- RSVP API accepts RSVPs for all public events

**Solution (Phase 4.43d):** All events redirect from `/open-mics/[slug]` to `/events/[id]`:
- `/open-mics/[slug]` serves as the slug entrypoint for legacy URLs and SEO
- `/events/[id]` is the canonical detail page with RSVP, attendee list, etc.

**Key Changes:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Removed `is_dsc_event` gate from RSVPSection (line 678) and AttendeeList (line 749) |
| `app/api/events/[id]/rsvp/route.ts` | Removed `is_dsc_event` restriction from RSVP API |
| `app/open-mics/[slug]/page.tsx` | Simplified to redirect-only (~300 lines removed) |
| `__tests__/phase4-43-rsvp-always.test.ts` | 13 new tests for Phase 4.43c |
| `__tests__/open-mics-redirect.test.ts` | 12 new tests for redirect behavior |

**What Remains DSC-Only:**
- HostControls (host management features)
- TimeslotSection (performer signup slots)
- "No signup method" warning banner

**Verification:**
- Visit `/events/words-open-mic` → RSVP button visible for community open mic
- Visit `/open-mics/words-open-mic` → redirects to `/events/words-open-mic`
- All 979 tests passing

---

### Hotfix: Signup Flow Broken (January 2026)

**Goal:** Fix both Google OAuth and email signup silently failing with "no action taken" behavior.

**Root Causes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| CSP blocking OAuth | `form-action 'self'` blocked redirects to Supabase/Google | Added Supabase + Google domains to form-action |
| Silent failures | No try/catch in auth functions; exceptions swallowed | Added error handling + user-visible error messages |
| **Missing DB function** | `generate_profile_slug` function not in production DB | Migration not applied; added `SECURITY DEFINER` to migration |

**Changes:**

| File | Change |
|------|--------|
| `next.config.ts` | Added `https://*.supabase.co https://*.supabase.in https://accounts.google.com` to CSP form-action |
| `lib/auth/google.ts` | Added try/catch, returns `{ ok, error }` result |
| `lib/auth/signUp.ts` | Added try/catch for exception handling |
| `lib/auth/magic.ts` | Added try/catch for exception handling |
| `app/signup/page.tsx` | Google button now displays errors to user |
| `app/login/page.tsx` | Google button now displays errors to user |
| `app/auth/callback/route.ts` | Added OAuth error param handling + debug logging |
| `migrations/20260103000001_add_profile_slug.sql` | Added `SECURITY DEFINER` to functions for auth context |

**Database Fix Applied:**

The profile slug migration was never applied to production. The trigger on `profiles` table called `generate_profile_slug()` which didn't exist, causing "Database error saving new user" on every signup attempt.

**Critical:** Functions called by auth triggers MUST use `SECURITY DEFINER` to run with elevated permissions.

```sql
-- Required pattern for functions called by auth triggers:
CREATE FUNCTION public.my_function(...)
RETURNS ... AS $$ ... $$
LANGUAGE plpgsql SECURITY DEFINER;
```

**Verification:** Lint 0 warnings, all 924 tests passing.

---

### Phase 4.43 — RSVP Always + Event Form UX (January 2026)

**Goal:** RSVP always available for DSC events + UI improvements to event creation form.

**RSVP System Changes:**
- RSVP = audience planning to attend (NOT performer signup)
- RSVP always available for public, non-cancelled DSC events
- Capacity is optional (`null` = unlimited RSVP)
- RSVP and timeslots can coexist on same event

**Event Form UX Changes:**

| Component | Change |
|-----------|--------|
| Required fields | Red label text + "*Required" suffix |
| Signup Mode | Card-style radio buttons with descriptions |
| Venue dropdown | Integrated "Enter custom location..." option |
| Defaults | Open Mic/Showcase auto-select Performance Slots |

**Key Files:**

| File | Purpose |
|------|---------|
| `EventForm.tsx` | Required indicators, venue dropdown integration |
| `SlotConfigSection.tsx` | Card-style radio options for signup mode |
| `VenueSelector.tsx` | Integrated custom location option |
| `RSVPSection.tsx` | Updated RSVP availability logic |
| `AttendeeList.tsx` | New component for displaying attendees |

**Test Coverage:** 43 new tests for RSVP coexistence scenarios.

---

### Phase 4.42l — User Draft Delete (January 2026)

**Goal:** Allow users to permanently delete their own draft events from the My Events dashboard.

**Changes:**

| Component | Change |
|-----------|--------|
| API | `DELETE /api/my-events/[id]?hard=true` permanently deletes draft events |
| Guardrails | Returns 409 if event has RSVPs or timeslot claims |
| Published events | Returns 400 — must use soft-cancel instead |
| UI Modal | "Delete this draft?" with permanent deletion warning |
| Button | Trash icon with "Delete draft" tooltip |
| Optimistic update | Event removed from list immediately on delete |

**Behavior Matrix:**

| Event State | Delete Action | Result |
|-------------|---------------|--------|
| Draft (unpublished) | Hard delete | Permanently removed from DB |
| Published | Soft cancel | Moved to Cancelled section |
| Has RSVPs | Blocked | 409 Conflict |
| Has timeslot claims | Blocked | 409 Conflict |

**Key Files:**

| File | Purpose |
|------|---------|
| `app/api/my-events/[id]/route.ts` | DELETE endpoint with ?hard=true support |
| `MyEventsFilteredList.tsx` | DeleteDraftModal + trash icon button |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/draft-delete.test.ts` | 27 tests - API contract, UI, permissions, edge cases |

---

### Phase 4.42k — Event Creation System Fixes (January 2026)

**Goal:** Fix the complete event creation → listing → series management flow with 6 targeted fixes.

**Fixes Implemented:**

| Fix | Issue | Solution |
|-----|-------|----------|
| A1b | New events showed "unconfirmed" even though user created them | Auto-set `last_verified_at` on publish (community events auto-confirm) |
| B1 | "Missing details" banner appeared for complete events | Removed `is_free` from missing details check (cost is optional) |
| D2 | Monday series displayed as Sunday (timezone bug) | Replaced `toISOString().split("T")[0]` with MT-safe `T12:00:00Z` pattern |
| C3 | Series panel disappeared after creation | Added `series_id` to SeriesEditingNotice + "Other events in series" links |
| Banner | "Imported from external source" shown for user-created events | Source-aware copy: shows "imported" only for `source=import` |
| Form | Silent HTML5 validation (user saw nothing on submit) | Added `noValidate` + custom error summary with field list |

**Key Changes:**

| File | Change |
|------|--------|
| `app/api/my-events/route.ts` | Added `last_verified_at: publishedAt` to auto-confirm; imported MT-safe `generateSeriesDates` |
| `lib/events/missingDetails.ts` | Removed `is_free` null check from missing details |
| `app/events/[id]/page.tsx` | Source-aware banner copy for unconfirmed events |
| `app/events/[id]/display/page.tsx` | Fixed date parsing with `T12:00:00Z` pattern |
| `MyEventsFilteredList.tsx` | Fixed date parsing with `T12:00:00Z` pattern |
| `api/search/route.ts` | Added `T12:00:00Z` suffix to date parsing |
| `components/events/SeriesEditingNotice.tsx` | Added `series_id` detection + series siblings list |
| `dashboard/my-events/[id]/page.tsx` | Fetches series siblings, passes to SeriesEditingNotice |
| `EventForm.tsx` | Added `noValidate` + comprehensive validation with error summary |

**Date Handling Contract:**

The canonical pattern for parsing date-only strings is now:
```typescript
new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
  day: "numeric",
  timeZone: "America/Denver"
})
```

This ensures the calendar date is preserved regardless of user's local timezone.

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/phase4-42k-event-creation-fixes.test.ts` | 35 tests - all fixes |
| `__tests__/missing-details.test.ts` | Updated for B1 decision |
| `components/__tests__/missing-details-chip.test.tsx` | Updated for B1 decision |

---

### Phase 4.42e — Event Creation UX + Post-Create 404 Fix (January 2026)

**Goal:** Fix post-create 404 errors and ensure weekday/date alignment in series preview.

**Problems Fixed:**

1. **Post-Create 404** — After creating a community event, navigating to edit page showed 404
   - Root cause: Edit page query filtered by `is_dsc_event = true`, excluding community events
   - Fix: Removed filter, added `isEventOwner` authorization check

2. **Weekday/Date Mismatch** — Day of Week and series preview dates could disagree
   - Root cause: `getNextDayOfWeek` used local time instead of Mountain Time
   - Fix: Created `formDateHelpers.ts` with MT-aware date utilities

3. **Layout Issue** — "Create Event Series" panel was far from schedule controls
   - Fix: Moved section directly under Day of Week / Start Time / End Time

**Key Changes:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/page.tsx` | Removed `is_dsc_event` filter, added `isEventOwner` check |
| `lib/events/formDateHelpers.ts` | New Mountain Time date helpers |
| `dashboard/my-events/_components/EventForm.tsx` | Bi-directional weekday/date sync, layout improvements |

**New Date Helpers (`formDateHelpers.ts`):**
- `getNextDayOfWeekMT(dayName)` — Next occurrence of weekday from today in MT
- `weekdayNameFromDateMT(dateKey)` — Derive weekday name from date in MT
- `weekdayIndexFromDateMT(dateKey)` — Weekday index (0-6) in MT
- `snapDateToWeekdayMT(dateKey, targetDayIndex)` — Snap date to target weekday
- `generateSeriesDates(startDate, count)` — Generate weekly series dates

**Bi-directional Sync:**
- Day of Week change → First Event Date snaps to that weekday
- First Event Date change → Day of Week updates to match

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/event-creation-ux.test.ts` | 43 tests - date helpers, authorization, sync behavior |

---

### Phase 4.42d — Series Creation RLS Fix (January 2026)

**Goal:** Fix "Create Event Series" failing with RLS policy violation error.

**Root Cause:**
- Event INSERT in `/api/my-events` did NOT include `host_id`
- RLS policy `host_manage_own_events` requires `(auth.uid() = host_id)` on INSERT
- Result: All series creation failed with `new row violates row-level security policy for table "events"`

**Solution: Unified Insert Builder**

Created `buildEventInsert()` helper function that ALWAYS sets `host_id`:
- `host_id: userId` is set as the FIRST field (critical for RLS)
- Same builder used for both single events and series
- Ensures consistent RLS compliance across all event creation paths

**Key Changes:**

| File | Change |
|------|--------|
| `app/api/my-events/route.ts` | Added `buildEventInsert()` helper, replaced inline insert |

**Fix Pattern:**
```typescript
// BEFORE: Missing host_id caused RLS violation
.insert({
  title: body.title,
  event_type: body.event_type,
  // ... NO host_id!
})

// AFTER: host_id is always set
const insertPayload = buildEventInsert({
  userId: session.user.id,  // Critical for RLS
  body,
  ...
});
.insert(insertPayload)
```

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/series-creation-rls.test.ts` | 11 tests - host_id consistency, series fields, RLS compliance |

---

### Phase 4.42c — Recurrence Unification Fix (January 2026)

**Goal:** Fix critical bug where recurring events with `event_date` only showed one occurrence.

**Root Cause:**
- `expandOccurrencesForEvent()` short-circuited when `event_date` was set
- Labels used `day_of_week` ("Every Monday") but generator used `event_date` (single Tuesday)
- Result: Label said "Every Monday" but only one Tuesday showed in happenings

**Solution: Unified Recurrence Contract**

Created `recurrenceContract.ts` as the SINGLE source of truth:
- Both generator (`nextOccurrence.ts`) and label path (`recurrenceHumanizer.ts`) consume this
- `event_date` now defines the START of a series, not the ONLY date
- Recurring events ALWAYS expand to multiple occurrences

**Key Invariants (Enforced):**
1. Labels MUST match what the generator produces
2. `day_of_week` is authoritative for recurrence pattern
3. `event_date` is the anchor point, not the short-circuit

**Key Files:**

| File | Purpose |
|------|---------|
| `lib/events/recurrenceContract.ts` | Unified recurrence interpretation (NEW) |
| `lib/events/nextOccurrence.ts` | Generator now uses shared contract |
| `lib/recurrenceHumanizer.ts` | Labels now use shared contract |

**Functions Added:**
- `interpretRecurrence(event)` → Normalized recurrence object
- `labelFromRecurrence(rec)` → Human-readable label
- `shouldExpandToMultiple(rec)` → Invariant check
- `assertRecurrenceInvariant()` → Dev/test warning on violations

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/recurrence-unification.test.ts` | 24 tests - contract, expansion, label-generator consistency |

**Before/After:**
```
BEFORE: event_date="2026-01-06" (Tuesday), day_of_week="Monday", recurrence_rule="weekly"
        → Label: "Every Monday"
        → Generator: 1 occurrence (Jan 6 - Tuesday)

AFTER:  Same data
        → Label: "Every Monday"
        → Generator: 12 occurrences (all Mondays starting Jan 12)
```

**Documentation:**
- `docs/recurrence/RECURRENCE-CONTRACT.md` — Full recurrence system contract
- `docs/recurrence/RECURRENCE-TEST-MATRIX.md` — Test coverage matrix

---

### Phase 4.41 — Admin Verification Queue UX (January 2026)

**Goal:** Fast, safe admin workflow to verify or delete events before launch.

**Improved Admin Queue Page (`/dashboard/admin/open-mics`):**
- Default filter: Unconfirmed events (need admin verification)
- High-signal filters: status (unconfirmed/confirmed/cancelled), date (upcoming/past/all), venue, search
- Row-level quick actions: Verify (one-click), Cancel (confirm dialog), Delete (guardrails)
- Inline context: event title + public link, venue, schedule, time, verification pill

**Hard Delete Guardrails:**
- Delete blocked if event has RSVPs (409 Conflict with reason)
- Delete blocked if event has timeslot claims
- Confirm dialog with explicit warning before deletion
- Button disabled with tooltip when blocked

**Key Files:**

| File | Purpose |
|------|---------|
| `components/admin/VerificationQueueTable.tsx` | Client component with filters and actions |
| `app/api/admin/open-mics/[id]/route.ts` | DELETE endpoint with guardrails |
| `app/api/admin/open-mics/[id]/status/route.ts` | POST endpoint for status updates |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/admin-verification-queue.test.ts` | 18 tests - filter logic, verify/cancel/delete behavior |

---

### Phase 4.40 — Everything Starts Unconfirmed (January 2026)

**Simplified Verification Logic:**
- ALL events now default to "Unconfirmed" until an admin explicitly verifies them
- Verification is purely based on `last_verified_at` field:
  - `status === 'cancelled'` → Cancelled
  - `last_verified_at IS NOT NULL` → Confirmed
  - Everything else → Unconfirmed
- Removed source-based logic (no more special handling for "import"/"admin" sources)
- This ensures consistent behavior: no event shows as Confirmed unless admin verified it

**One-Time Reset Script:**
- Added `web/scripts/reset-event-verification.ts`
- Clears `last_verified_at` and `verified_by` for all events
- **Executed 2026-01-04:** Reset 19 verified events to Unconfirmed
- Usage: `cd web && npx tsx scripts/reset-event-verification.ts`

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/events/verification.ts` | Simplified: cancelled → confirmed (if verified) → unconfirmed |
| `web/scripts/reset-event-verification.ts` | One-time admin script to reset all verifications |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 32 tests (rewritten for Phase 4.40 logic) |

---

### Phase 4.39 — Lockdown Fixes: Signup Banners + Verification Logic (January 2026)

**Signup Banner False-Positive Fix:**
- Fixed 6 queries in event detail page that used route param (slug) instead of `event.id` (UUID)
- This caused false "No sign-up method configured" banners when accessing events via slug URLs
- Affected queries: event_hosts (x2), event_timeslots, event_rsvps, gallery_images, event_claims

**Seeded Events Verification Logic:**
- Seeded events (source=import/admin) now remain "Unconfirmed" even if claimed by a host
- Only become "Confirmed" when `last_verified_at` is explicitly set by admin
- Prevents imported data from appearing verified just because someone claimed it
- Reason text: "Claimed event awaiting admin verification" for claimed seeded events

**Detail Page Verification Pills:**
- Added always-visible verification badges to both event detail pages
- `/events/[id]`: Badge in row with event type and DSC badges
- `/open-mics/[slug]`: Badge row above title with "Open Mic" type badge
- Uses same theme tokens as HappeningCard (green/amber/red pills)

**Slug Audit Utility:**
- New admin script: `web/scripts/slug-audit.ts`
- Reports: NULL slugs in events/profiles, duplicate slugs
- Usage: `cd web && npx tsx scripts/slug-audit.ts`

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/events/[id]/page.tsx` | Fixed 6 queries + verification pill |
| `web/src/app/open-mics/[slug]/page.tsx` | Verification state + pill |
| `web/src/lib/events/verification.ts` | Seeded+claimed stays unconfirmed |
| `web/scripts/slug-audit.ts` | Admin slug audit utility |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 32 tests (+8 new for Phase 4.39) |

---

### Phase 4.38 — Happenings UX + Slug Routing + Avatar Fixes (January 2026)

**Happenings Filter UX:**
- Removed sticky positioning from filter controls (was `sticky top-16`)
- Filters now scroll with content, freeing vertical screen space
- Added `BackToTop` floating button (appears after scrolling 400px)

**Canonical Slug Redirects:**
- Events: UUID access (`/events/{uuid}`) redirects to `/events/{slug}` when slug exists
- Songwriters: UUID access redirects to `/songwriters/{slug}` when slug exists
- Studios: UUID access redirects to `/studios/{slug}` when slug exists
- Backward compatible: both UUID and slug URLs continue to work

**Always-Visible Verification Pills:**
- HappeningCard now shows verification status in chips row (always visible, not just overlay)
- Green "Confirmed" pill with checkmark for verified events
- Amber "Unconfirmed" pill for seeded/imported events
- Red "Cancelled" pill for cancelled events
- Added `success` and `danger` chip variants

**Avatar Cropping Fix:**
- `SongwriterAvatar`: Added `object-top` to prevent head/face cropping
- `MemberCard`: Added `object-top` for member avatar images

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/components/happenings/StickyControls.tsx` | Non-sticky filters |
| `web/src/components/happenings/BackToTop.tsx` | Floating back-to-top button |
| `web/src/components/happenings/HappeningCard.tsx` | Verification pills in chips row |
| `web/src/app/events/[id]/page.tsx` | Canonical slug redirect |
| `web/src/app/songwriters/[id]/page.tsx` | Canonical slug redirect |
| `web/src/app/studios/[id]/page.tsx` | Canonical slug redirect |
| `web/src/components/songwriters/SongwriterAvatar.tsx` | object-top fix |
| `web/src/components/members/MemberCard.tsx` | object-top fix |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/slug-routing.test.ts` | 15 tests - UUID detection, verification states, URL patterns |

---

### Phase 4.37 — Verification Status UX + Speed Insights (January 2026)

**Verification State Helper:**
- Created `getPublicVerificationState()` helper for consistent verification logic
- Returns `confirmed` | `unconfirmed` | `cancelled` state
- Logic: cancelled status → cancelled; needs_verification/unverified → unconfirmed; unclaimed + seeded + not verified → unconfirmed; else confirmed

**Card Badge Updates:**
- Changed "Schedule TBD" → "Unconfirmed" in HappeningCard and CompactListItem
- Seeded events clearly marked as "may still be happening but not verified"

**Event Detail Verification Block:**
- Added verification block showing Cancelled (red), Unconfirmed (amber), Confirmed (green)
- Always shows green block for confirmed events (even without verification date)
- Admin users see "Manage status" link

**Submit Update Form:**
- Added status suggestion dropdown: Confirmed / Unconfirmed / Cancelled
- Stored as `field: "suggested_status"` in event_update_suggestions table

**Publish Checkbox Wording:**
- Changed from "I confirm this event is real and happening" → "Ready to publish"
- Removes implication that events might be fake

**Vercel Speed Insights:**
- Added `@vercel/speed-insights` package for performance monitoring
- SpeedInsights component added to root layout

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/events/verification.ts` | Verification state helper |
| `web/src/app/events/[id]/page.tsx` | Detail page verification block |
| `web/src/components/happenings/HappeningCard.tsx` | Card badge updates |
| `web/src/components/events/EventSuggestionForm.tsx` | Status suggestion field |
| `web/src/app/layout.tsx` | SpeedInsights component |
| `docs/investigation/phase4-37-seeded-verification-status-system.md` | Investigation doc |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 26 tests - verification logic + detail page block |

---

### Phase 4.36 — Publish Confirmation + Attendee Update Notifications (January 2026)

**Publish Confirmation Gate:**
- Hosts must check "Ready to publish" checkbox before publishing (updated wording in 4.37)
- Applies to new events going from draft → published
- Inline validation error if checkbox unchecked when toggling publish ON
- Helps prevent accidental publication of incomplete events

**Attendee Update Notifications:**
- When major fields change on published events, all signed-up users receive notifications
- Dashboard notification always created (canonical)
- Email sent via `eventUpdated` template, respecting user preferences
- Major fields that trigger notifications: `event_date`, `start_time`, `end_time`, `venue_id`, `location_mode`, `day_of_week`

**Skip Conditions (No Notification):**
- First publish (no attendees yet)
- Cancellation (handled by DELETE handler)
- Non-major changes (title, description, host_notes, etc.)
- Draft event changes (not published)

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | Publish confirmation checkbox UI |
| `web/src/app/api/my-events/[id]/route.ts` | API gate + notification trigger |
| `web/src/lib/notifications/eventUpdated.ts` | Attendee enumeration + preference-gated sending |
| `docs/investigation/phase4-36-publish-confirm-and-attendee-updates.md` | Investigation doc |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/publish-confirmation-and-updates.test.ts` | 33 tests - publish gate + notification logic |

---

### Phase 4.35 — Email Signature + SEO-Friendly Slugs (January 2026)

**Email Signature Update:**
- Changed from "— Denver Songwriters Collective" to "— From Sami Serrag on Behalf of the Denver Songwriters Collective"
- Sami's name links to `/songwriters/sami-serrag`
- Updated both HTML and plain text email formats

**Profile Slugs:**
- Added `slug` column to `profiles` table
- URLs now use readable slugs: `/songwriters/sami-serrag` instead of UUIDs
- Auto-generated from `full_name` (e.g., "Sami Serrag" → "sami-serrag")
- Collision handling: appends `-2`, `-3`, etc. for duplicates
- Trigger auto-generates slug on insert or when name changes
- Backward compatible: both UUID and slug lookups supported

**Event Slugs Cleaned:**
- Event slugs now use title only (no UUID suffix)
- Example: `/events/open-mic-night` instead of `/events/open-mic-night-a407c8e5...`
- Same collision handling and auto-generation trigger

**Complete Slug Coverage (All User-Facing Links):**

All user-facing links now use the `slug || id` pattern for backward compatibility:

| Category | Files Updated |
|----------|---------------|
| Profile cards | `SongwriterCard`, `MemberCard`, `StudioCard` |
| Event cards | `HappeningCard`, `EventCard`, `RSVPCard`, `MissingDetailsChip` |
| Dashboard | `CreatedSuccessBanner`, `my-events/[id]/page.tsx` |
| Email templates | All 8 event-related templates (rsvpConfirmation, eventReminder, eventUpdated, waitlistPromotion, occurrenceCancelledHost, occurrenceModifiedHost, eventClaimApproved, adminEventClaimNotification) |
| API routes | `/api/events/[id]/rsvp`, `waitlistOffer.ts` (fetch slug for emails/notifications) |
| Admin pages | `ClaimsTable` (event and profile links) |
| URL helpers | `lib/events/urls.ts` |

**Intentionally Using UUIDs:**
- API endpoints (data operations need stable IDs)
- Admin dashboard routes (`/dashboard/admin/events/...`)
- Host control pages (`/events/.../lineup`, `/events/.../display`)

**Database Migrations:**
- `supabase/migrations/20260103000001_add_profile_slug.sql` — Profile slug column + trigger
- `supabase/migrations/20260103000002_clean_event_slugs.sql` — Event slug cleanup + trigger

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/email/render.ts` | Email signature with Sami link |
| `web/src/lib/events/urls.ts` | Centralized URL helper with slug support |
| `web/src/app/songwriters/[id]/page.tsx` | UUID + slug lookup support |
| `web/src/app/events/[id]/page.tsx` | UUID + slug lookup support |
| `web/src/app/studios/[id]/page.tsx` | UUID + slug lookup support |

---

### Phase 4.32–4.34 — UX Fixes, Host Guardrails, Smoke Suite (January 2026)

**Phase 4.32: Host/Admin No-Signup Warning**
- `hasSignupLane()` helper in `/events/[id]/page.tsx` detects missing signup configuration
- Warning banner shows for hosts/admins when:
  - `has_timeslots=true` but no timeslot rows exist
  - `has_timeslots=false` and `capacity=null`
- "Fix Sign-up" button links to dashboard edit page
- Banner NOT visible to public viewers

**Phase 4.33: Cancelled UX Refinement (My Events Dashboard)**
- Removed "Cancelled" as primary tab in MyEventsFilteredList
- Cancelled events now in collapsible disclosure section below Live/Drafts
- Collapsed by default, expands on click
- Muted styling with strikethrough for cancelled titles

**UI Contrast Fixes:**
- Primary button uses `--color-text-on-accent` (theme-aware, was `--color-bg-secondary`)
- Added `--pill-bg-success`, `--pill-fg-success`, `--pill-border-success` tokens
- "X spots left" chip uses theme-aware success tokens
- RSVPCard confirmed badge uses theme-aware tokens
- Fixes readability in Sunrise (light) theme

**Phase 4.34: Production Smoke Suite**
- `docs/SMOKE-PROD.md` — Checklist for production verification
- `scripts/smoke-prod.sh` — Automated curl-based smoke tests

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/events/[id]/page.tsx` | hasSignupLane() + no-signup banner |
| `web/src/app/(protected)/dashboard/my-events/_components/MyEventsFilteredList.tsx` | Cancelled disclosure |
| `web/src/app/themes/presets.css` | Success pill tokens |
| `web/src/components/ui/button.tsx` | Theme-aware primary button text |
| `docs/SMOKE-PROD.md` | Production smoke checklist |
| `scripts/smoke-prod.sh` | Automated smoke tests |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/signup-lane-detection.test.ts` | 16 tests - hasSignupLane logic + banner visibility |
| `__tests__/cancelled-ux-refinement.test.ts` | 9 tests - Cancelled disclosure behavior |

---

### Phase 4.33 — Email Template UX Improvements (January 2026)

**Visual Redesign:**
- Navy blue header (`#1e3a5f`) with bright blue accents (`#2563eb`)
- Logo image in email header (hosted on Supabase storage)
- Centralized `EMAIL_COLORS` constant for consistent theming
- Helper functions for reusable email components

**Copy Updates:**
- Host approval email: "Create DSC official events" (clarifies host privileges)
- Newsletter welcome: Button now links to `/happenings` (not `/happenings?type=open_mic`)
- Event cancellation emails: "Browse Happenings" button (not "Find Another Open Mic")

**New Email Helper Functions (`render.ts`):**
- `eventCard(eventTitle, eventUrl)` — Card-style link with event name and arrow
- `rsvpsDashboardLink()` — "View all your RSVPs →" link to dashboard

**Event-Related Emails Now Include:**
- Event name as clickable card link to event detail page
- RSVPs dashboard link for easy access to all user's RSVPs
- Both HTML and plain text versions updated

**Templates Updated:**
- `rsvpConfirmation.ts` — Confirmed and waitlist variants
- `eventReminder.ts` — Tonight/tomorrow reminders
- `eventUpdated.ts` — Event detail changes
- `eventCancelled.ts` — Full event cancellations
- `waitlistPromotion.ts` — Spot opened notifications
- `occurrenceCancelledHost.ts` — Single occurrence cancellations
- `occurrenceModifiedHost.ts` — Single occurrence modifications
- `hostApproval.ts` — Host approval copy update
- `newsletterWelcome.ts` — Button and link updates

**Preview Script:**
- `scripts/preview-all-emails.ts` — Generates HTML previews for all 23 templates
- Run: `npx tsx scripts/preview-all-emails.ts`
- Open: `scripts/email-previews/index.html`

---

### Phase 4.32 — Trust-Based Content Model (January 2026)

**Philosophy:** We trust our members. Content goes live immediately without admin approval. Admins retain the ability to hide content if needed.

**Events:**
- Any member can create events (no host approval required)
- Only approved hosts see "Is this a DSC Event" toggle
- Non-DSC events are community events, not officially endorsed
- Events publish immediately when creator toggles "Published"

**Gallery:**
- Photos appear immediately in the gallery on upload
- Admins can hide photos that violate community guidelines

**Blog:**
- Posts go live immediately when published
- No approval queue - direct publishing for all members
- Admins can hide posts if needed

**Key Implementation:**
- `is_approved: true` set automatically on all content creation
- `canCreateDSC` prop controls DSC toggle visibility in EventForm
- Gallery upload toast: "uploaded successfully!" (not "pending review")
- Blog form: "Publish now" (not "Submit for publication")

---

### Phase 4.25 — Email Preferences (January 2026)

**Features Delivered:**

- **Per-user email preferences** — Users can toggle email delivery for claim updates, event updates, and admin alerts
- **Dashboard notifications canonical** — Preferences only gate emails; dashboard notifications always appear
- **Settings UI** — Toggle switches at `/dashboard/settings` with inline confirmation
- **Admin toggle visibility** — Admin alerts toggle only renders for users with `role='admin'`

**Design Decision:**

Email preferences gate delivery only. Dashboard notifications remain the canonical record. Users who disable emails still see all notifications in their dashboard. This ensures no missed information while respecting communication preferences.

**Database Migration:**

- `supabase/migrations/20260101400000_notification_preferences.sql` — Per-user preference toggles

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/notifications/preferences.ts` | Preference helpers + category mapping |
| `web/src/lib/email/sendWithPreferences.ts` | Preference-aware email sending |
| `web/src/app/(protected)/dashboard/settings/page.tsx` | Settings UI with toggles |

**Email Category Mapping:**

| Category | Templates |
|----------|-----------|
| `claim_updates` | eventClaimSubmitted, eventClaimApproved, eventClaimRejected |
| `event_updates` | eventReminder, eventUpdated, eventCancelled, occurrenceCancelledHost, occurrenceModifiedHost, rsvpConfirmation, waitlistPromotion |
| `admin_notifications` | adminEventClaimNotification, contactNotification |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/notification-preferences.test.ts` | Default preferences, category mapping, completeness checks |

---

### Phase 4.22 — Editing + Ownership UX (January 2026)

**Features Delivered:**

- **Series Editor Notice (4.22.1)** — `SeriesEditingNotice` component shows recurrence summary + "changes affect all future occurrences" messaging on event edit pages
- **Occurrence Override Editor (4.22.2)** — Admin UI at `/dashboard/admin/events/[id]/overrides` to cancel/modify single occurrences without changing series
- **Event Claim Flow (4.22.3)** — Users can claim unclaimed events (host_id IS NULL); admins approve/reject at `/dashboard/admin/claims`

**Database Migrations:**

- `supabase/migrations/20260101200000_occurrence_overrides.sql` — Per-date override table
- `supabase/migrations/20260101300000_event_claims.sql` — Event ownership claims table

**Key Components:**

| Component | Path |
|-----------|------|
| SeriesEditingNotice | `web/src/components/events/SeriesEditingNotice.tsx` |
| OccurrenceOverrideList | `web/src/app/(protected)/dashboard/admin/events/[id]/overrides/_components/OccurrenceOverrideList.tsx` |
| OccurrenceOverrideModal | `web/src/app/(protected)/dashboard/admin/events/[id]/overrides/_components/OccurrenceOverrideModal.tsx` |
| ClaimEventButton | `web/src/components/events/ClaimEventButton.tsx` |
| ClaimsTable | `web/src/app/(protected)/dashboard/admin/claims/_components/ClaimsTable.tsx` |

**Key Pages:**

| Route | Purpose |
|-------|---------|
| `/dashboard/admin/events/[id]/overrides` | Admin override editor for recurring events |
| `/dashboard/admin/claims` | Admin review of event ownership claims |

**Test Coverage (21+ tests added):**

| Test File | Coverage |
|-----------|----------|
| `__tests__/occurrence-overrides.test.ts` | Override merge logic, cancelled filtering |
| `__tests__/event-claims.test.ts` | Claim visibility, duplicate prevention, approval/rejection flow |

---

### Gallery + Comments Track — CLOSED (Phase 4.30, January 2026)

> **Track Closed: 2026-01-01**
>
> This track is complete. All features shipped, tests passing, docs updated.

**Features Delivered:**

- **Album-first gallery architecture** — Photos belong to albums; no orphan uploads
- **Album visibility** — `is_published` + `is_hidden` (never `is_approved` in user-facing queries)
- **Photo/album comments** — `gallery_photo_comments` and `gallery_album_comments` tables
- **Threaded comments (1-level)** — `parent_id` references on all comment tables
- **Owner moderation** — `is_hidden` / `hidden_by` columns; entity owner + admin can hide
- **Soft-delete by author** — `is_deleted` column; author/admin can soft-delete own comments
- **Profile comments** — New `profile_comments` table for songwriter/studio profiles
- **Shared CommentThread component** — Reusable component for all comment surfaces
- **Weekly digest with kill switch** — `ENABLE_WEEKLY_DIGEST` env var
- **Copy freeze guardrails** — No approval/metrics/urgency language in user-facing copy

**Database Migration:**

- `supabase/migrations/20260101100000_threaded_comments_and_profile_comments.sql`
- Additive-only (safe rollout): all `ADD COLUMN IF NOT EXISTS` with defaults
- New table: `profile_comments` with RLS policies

**Test Coverage (39+ tests added):**

| Test File | Coverage |
|-----------|----------|
| `__tests__/threaded-comments.test.ts` | Threading, moderation, profile comments |
| `__tests__/gallery-photo-comments.test.ts` | Comments-as-likes model, no gamification |
| `__tests__/gallery-copy-freeze.test.ts` | No approval/metrics/urgency language |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | RLS policy coverage |

**Key Components:**

| Component | Path |
|-----------|------|
| CommentThread | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |

**Investigation Doc:** `docs/investigation/comments-phase3-threading.md`

---

### v2.0 Visual System (December 2025)

Scan-first, image-forward card design. See PRODUCT_NORTH_STAR.md v2.0.

**Phase 4.6 Premium Card Polish:**
- `card-spotlight` surface (MemberCard recipe)
- Shadow token stack (`--shadow-card`, `--shadow-card-hover`)
- Poster zoom on hover (`scale-[1.02]`)
- MemberCard pill-style chips
- "Missing details" as warning badge

**Phase 4.5 Vertical PosterCard:**
- Vertical layout (poster top, content bottom)
- 4:3 aspect ratio poster media
- Responsive grid (1 col / 2 col / 3 col)
- 3-tier image rendering (card → blurred → placeholder)

**Phase 4.3-4.4 Readability:**
- Typography fixes (14px minimum)
- Sunrise theme contrast fixes
- TONIGHT/TOMORROW temporal emphasis

**Phase 4.14-4.16 Lint Cleanup:**
- Lint warnings: 29 → 0
- `next/image` conversions for public avatars, thumbnails, HappeningCard
- Documented eslint suppressions for intentional `<img>` (ReactCrop, blob URLs, user uploads)

**Phase 4.18 Recurrence Expansion + Date Jump:**
- Multi-ordinal recurrence support ("2nd/3rd", "1st & 3rd", `BYDAY=1TH,3TH`)
- 90-day rolling window occurrence expansion
- Weekly events show all future occurrences (~13 entries)
- Monthly ordinal events show 3-4 occurrences per window
- DateJumpControl for jumping to specific dates
- "Schedule unknown" section for uncomputable events
- Beta warning banner prominent at top of /happenings

**Phase 4.19 Happenings UX Pass:**
- DateJumpControl presets: Today, Tomorrow, This Weekend, Pick a date
- Synchronized Month/Day/Year dropdowns with 90-day window constraint
- Denser cards: 3:2 aspect ratio (was 4:3), reduced padding/spacing
- StickyControls wrapper with backdrop blur (sticks below nav)
- DateSection with collapsible date groups (chevron toggle)
- BetaBanner dismissible per session (localStorage)
- Results summary: event/date counts with filter breakdown

**Phase 4.20 Gallery UX Final Lock (December 2025):**
- Explicit Publish/Unpublish button for draft albums (discoverability fix)
- "New album" button moved below dropdown to prevent overlap
- Inline status feedback (no toasts) for publish/unpublish actions
- Empty-state guidance for albums without photos
- Owner context for "Hidden by admin" status badge
- Bulk comment moderation (hide/unhide all) in AlbumManager
- Admin audit trail logging (`lib/audit/moderationAudit.ts`)
- Weekly digest kill switch via `ENABLE_WEEKLY_DIGEST` env var
- Copy freeze tests (no approval/metrics/urgency language in user-facing copy)
- **Bug fix:** Album detail page now shows images for new albums (query mismatch fix)
  - Was filtering by `is_approved=true`, now uses `is_published/is_hidden` to match gallery listing

**Phase 4.21 Occurrence Overrides for Recurring Events (January 2026):**
- Per-occurrence override system without persisting occurrences
- New `occurrence_overrides` table:
  - `event_id` — Reference to the recurring series
  - `date_key` — YYYY-MM-DD (Denver-canonical)
  - `status` — `normal` or `cancelled`
  - `override_start_time` — Optional time change
  - `override_cover_image_url` — Optional flyer override
  - `override_notes` — Optional occurrence-specific notes
- Overrides apply only to the specific occurrence date
- Recurring events remain single canonical records (no DB row per date)
- Overrides are evaluated during occurrence expansion in `nextOccurrence.ts`
- Cancelled occurrences:
  - Hidden by default on `/happenings`
  - Revealed via "Show cancelled" toggle in StickyControls
  - Visually de-emphasized with CANCELLED badge and red accent
- Override flyer and notes take precedence when present
- RLS: public read, admin-only write
- **Database Migration:** `supabase/migrations/20260101200000_occurrence_overrides.sql`
- **Test Coverage:** 17 new tests in `__tests__/occurrence-overrides.test.ts`

### Key Gallery Components

| Component | Path |
|-----------|------|
| AlbumManager | `web/src/app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx` |
| UserGalleryUpload | `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx` |
| Gallery listing | `web/src/app/gallery/page.tsx` |
| Album detail | `web/src/app/gallery/[slug]/page.tsx` |
| Moderation audit | `web/src/lib/audit/moderationAudit.ts` |
| Feature flags | `web/src/lib/featureFlags.ts` |

### Logging System (December 2025)
- Admin logs at `/dashboard/admin/logs`
- Error boundaries wired to appLogger
- Server + client logging support

---

## Deferred Backlog

See full backlog in previous CLAUDE.md version or `docs/known-issues.md`.

### P0 (Critical)
- None currently identified

### P1 (Fix Soon)
- API rate limiting missing
- Empty `alt=""` on user avatars (9 occurrences across 7 components) — accessibility concern

### P2 (Nice to Fix)
- Typography token docs drift
- Loading.tsx coverage gaps
- Duplicate VenueSelector components
- ~~53 unnecessary `as any` casts in profile page~~ — RESOLVED

### Known UX Follow-ups (All Resolved)
- ~~**A) City always visible on timeline cards + series rows**~~ — Fixed in Phase 5.04/5.06 (`getVenueCityState()` helper)
- ~~**B) "Signup time" field restored on create/edit forms everywhere**~~ — Fixed in Phase 5.04 (EventForm includes `signup_time`)
- ~~**C) Venue Google Maps + Get Directions links shown on event occurrences**~~ — Fixed in Phase 5.06/5.07 (override venue support)

### Future: Phase 4.38 — Hard Delete Admin Tools
**Investigation completed in:** `docs/investigation/phase4-37-seeded-verification-status-system.md` (Section 6)

Event hard delete is safe—all FKs use CASCADE or SET NULL:
- `event_rsvps`, `event_timeslots`, `timeslot_claims`, `occurrence_overrides`, `event_claims`, `event_update_suggestions`, `change_reports`, `favorites`, `event_hosts`, `event_comments`, `guest_verifications` — CASCADE
- `gallery_albums`, `monthly_highlights` — SET NULL (orphans album / removes highlight)

Venue hard delete requires check:
- Before delete: Check for events referencing `venue_id`
- If events exist: Block delete or cascade-nullify `venue_id`
- Add admin confirmation: "X events reference this venue"

---

## Test Files

All tests live in `web/src/` and run via `npm run test -- --run`.

| File | Tests |
|------|-------|
| `__tests__/card-variants.test.tsx` | Card variant behavior |
| `__tests__/navigation-links.test.ts` | Canonical route enforcement |
| `__tests__/happenings-filters.test.ts` | Filter logic |
| `lib/events/__tests__/nextOccurrence.test.ts` | Occurrence computation (61 tests) |
| `__tests__/utils/datetime.test.ts` | Datetime utilities |
| `components/__tests__/no-notes-leak.test.tsx` | Raw dump regression |
| `app/.../event-update-suggestions/page.test.tsx` | Suggestions page |
| `lib/guest-verification/*.test.ts` | Guest verification |
| `lib/email/email.test.ts` | Email templates |
| `app/api/guest/*.test.ts` | Guest API endpoints |
| `__tests__/gallery-photo-comments.test.ts` | Gallery photo comments |
| `__tests__/gallery-album-management.test.ts` | Album management (25 tests) |
| `__tests__/gallery-copy-freeze.test.ts` | Copy freeze (no approval/metrics language) |
| `__tests__/threaded-comments.test.ts` | Threaded comments + profile comments |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | Comment RLS policies |
| `__tests__/occurrence-overrides.test.ts` | Occurrence override model (17 tests) |
| `__tests__/signup-lane-detection.test.ts` | Signup lane detection + banner visibility (16 tests) |
| `__tests__/cancelled-ux-refinement.test.ts` | Cancelled disclosure behavior (9 tests) |
| `__tests__/verification-state.test.ts` | Verification state helper + detail page block (26 tests) |
| `__tests__/slug-routing.test.ts` | Slug routing + verification pills (15 tests) |
| `__tests__/series-creation-rls.test.ts` | Series creation RLS fix (11 tests) |
| `__tests__/recurrence-unification.test.ts` | Recurrence contract + label-generator consistency (24 tests) |
| `__tests__/event-creation-ux.test.ts` | Event creation UX, 404 fix, date helpers (43 tests) |
| `__tests__/venue-selector-phase445b.test.tsx` | Venue selector UX, authorization, dropdown order (17 tests) |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | Join & Signup section, mini preview, custom location (13 tests) |
| `__tests__/phase4-49b-event-comments.test.ts` | Event comments everywhere, guest support, notifications (34 tests) |
| `__tests__/notification-icons.test.ts` | Distinct notification icons by type (14 tests) |
| `__tests__/notification-interactions.test.ts` | Notification controls: mark-on-click, mark-all, hide-read, deep-links (21 tests) |
| `__tests__/venue-page-fixes.test.ts` | Venue page count filters + de-duplication logic (17 tests) |
| `__tests__/edit-form-series-controls.test.ts` | Edit form ordinal parsing, recurrence rebuild, series mode detection, max_occurrences (59 tests) |
| `__tests__/phase4-98-host-cohost-equality.test.ts` | Host/cohost equality, auto-promotion, claim notifications (45 tests) |
| `__tests__/event-management-tabs.test.ts` | Event management tabs, per-occurrence filtering, guest display (30 tests) |
| `__tests__/phase5-14b-dashboard-and-rsvp-fixes.test.ts` | 3-tab dashboard, RSVP reactivation, tab UX (47 tests) |
| `lib/featureFlags.test.ts` | Feature flags |
| `__tests__/gtm-3-editorial-and-newsletter-unsubscribe.test.ts` | GTM-3: editorial layer, newsletter unsubscribe, token security, template rendering (130 tests) |

### Archived Tests

Legacy test suite archived at `docs/archived/tests-legacy-schema/`. These tests reference an older "Open Mic Drop" schema (`event_slots`, `performer_id`, etc.) incompatible with current DSC schema (`event_timeslots`, `timeslot_claims`, `member_id`).

**Do NOT run archived tests against current database.**

---

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=
UNSUBSCRIBE_SECRET=          # GTM-2: HMAC key for signed unsubscribe URLs
```

---

**Last updated:** February 2026
