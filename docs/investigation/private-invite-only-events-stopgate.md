# Investigation: Private Invite-Only Events

**Author:** Claude Opus 4.6 (Repo Agent)
**Date:** 2026-02-17
**Status:** APPROVED — PR1 (leak fixes) and PR2 (schema + RLS) shipped and applied. PR3–PR6 pending.
**Governance:** Per `00-governance-and-safety.md` — investigation-only, no code changes

---

## Executive Summary

Private invite-only events require hardening **14 identified read surfaces** that currently assume all events are public. The current RLS policy on `events` is `FOR SELECT USING (true)` — every row is visible to everyone, including `anon`. There is no `visibility` column on the `events` table today.

The existing `event_invites` table (Phase 4.94) handles host/cohost invitation tokens but is scoped to role assignment, not attendance visibility. A new system is needed for attendee-level invite gating.

**Core risk:** The `public_read_events` RLS policy is the single largest blast radius change. Every query path that touches `events` will be affected when this policy becomes conditional. This must be rolled out with extreme care and comprehensive negative tests.

---

## 1. Evidence Map: All Event Read Surfaces

### VERIFIED — 14 surfaces audited

| # | Surface | File | Visibility Filter Today | Public? | Leakage Risk |
|---|---------|------|------------------------|---------|-------------|
| 1 | `/happenings` listing | `app/happenings/page.tsx` | `is_published=true` + `status IN DISCOVERY_STATUS_FILTER` | Yes | HIGH — no visibility column check |
| 2 | `/events/[id]` detail | `app/events/[id]/page.tsx` | `is_published=true` (draft: host/admin only) | Yes | HIGH — slug/UUID direct access |
| 3 | OG image generation | `app/og/event/[id]/route.tsx` | **None** | Yes | HIGH — metadata leaks title, venue, date |
| 4 | Search API | `app/api/search/route.ts` | Open mics: `status='active'`; Others: **no status filter** | Yes | HIGH — full-text search returns private events |
| 5 | Weekly happenings digest | `lib/digest/weeklyHappenings.ts` | `is_published=true` + `status='active'` | No (email) | MEDIUM — sent to all digest subscribers |
| 6 | Weekly open mics digest | `lib/email/templates/weeklyOpenMicsDigest.ts` | `event_type='open_mic'` + `status='active'` | No (email) | LOW — private open mics unlikely but possible |
| 7 | Embed widget | `app/embed/events/[id]/route.ts` | `is_published=true` | Yes | HIGH — guessable slug returns full HTML |
| 8 | RSVP API | `app/api/events/[id]/rsvp/route.ts` | `is_published=true` | Yes* | MEDIUM — confirms event existence |
| 9 | Comments API | `app/api/events/[id]/comments/route.ts` | `is_published=true` | Yes | MEDIUM — confirms event existence |
| 10 | Lineup/timeslots | `app/api/events/[id]/lineup/` | `is_published=true` | Yes | MEDIUM |
| 11 | Event reminder emails | `lib/email/templates/eventReminder.ts` | `is_published=true` | No (email) | LOW — sent only to RSVPed users |
| 12 | Event update emails | `lib/email/templates/eventUpdated.ts` | `is_published=true` | No (email) | LOW — sent to watchers |
| 13 | Admin dashboard | `dashboard/admin/events/page.tsx` | None (admin sees all) | No | N/A — correct behavior |
| 14 | Admin export | `api/admin/ops/events/export/route.ts` | None (admin) | No | N/A — correct behavior |

### PRE-EXISTING ISSUES (not caused by this feature, but must be fixed as part of it)

1. **OG image route** (`/og/event/[id]`) has NO `is_published` check — leaks draft event metadata today.
2. **Search API** for non-open-mic events has NO `status` filter — leaks cancelled/draft events today.

### VERIFIED ABSENT

- **No sitemap generation** exists for events (confirmed via codebase search).
- **No RSS/Atom feed** exists for events.
- **No public API** beyond the surfaces listed above.

---

## 2. Proposed Schema and Policy Model

### 2A. Event Visibility Model

**Add column to `events` table:**

```sql
ALTER TABLE events
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'invite_only'));
```

**Why not a separate table?** Visibility is a core property of an event, queried on every SELECT. A column avoids an extra JOIN on every read path and can be indexed directly. Only two values are needed now; the CHECK constraint can be extended later.

**Why not `private`?** "Private" is ambiguous. `invite_only` is self-documenting and matches the user mental model. If a third mode is needed later (e.g., `members_only`, `unlisted`), it can be added to the CHECK constraint.

### 2B. Attendee Invite Model

**New table: `event_attendee_invites`**

```sql
CREATE TABLE event_attendee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Invite target (one of these must be non-null)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  CONSTRAINT invite_target CHECK (user_id IS NOT NULL OR email IS NOT NULL),

  -- Token for email-based access (stored as SHA-256 hash)
  token_hash TEXT UNIQUE,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),

  -- Prevent duplicate invites
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, email)
);
```

**Why a separate table from `event_invites`?** The existing `event_invites` table is for host/cohost role assignment (Phase 4.94). Attendee invites have different semantics: they control visibility, not role. Mixing them would couple two distinct access control planes.

### 2C. Token/Invite Lifecycle

| Action | Actor | Effect |
|--------|-------|--------|
| Create invite (member) | Host or admin | Inserts row with `user_id`, status=`pending` |
| Create invite (non-member) | Host or admin | Inserts row with `email` + `token_hash`, status=`pending` |
| Accept (member) | Invited user | Sets `accepted_at`, status=`accepted` |
| Accept (non-member) | Token holder | Validates token, sets `accepted_at`, status=`accepted`; if user signs up, backfills `user_id` |
| Decline | Invitee | Sets status=`declined` |
| Revoke | Host or admin | Sets `revoked_at`, `revoked_by`, status=`revoked`; immediately hides event |
| Expire | System/cron | Invites past `expires_at` treated as expired on read (no cron needed) |

**Token flow for non-members:**
1. Host creates invite with email
2. System generates crypto-random token, stores SHA-256 hash, sends plaintext in email link
3. Link format: `/events/[slug]?invite=TOKEN`
4. On visit: API validates token hash, creates session or cookie-based access
5. If recipient signs up, their `user_id` is backfilled into the invite row

---

## 3. RLS Contract Matrix

### 3A. `events` Table — Updated `public_read_events` Policy

**Replace current policy** (`USING (true)`) with:

```sql
CREATE POLICY "public_read_events" ON events
  FOR SELECT TO anon, authenticated
  USING (
    -- Public events: visible to everyone
    visibility = 'public'
    OR
    -- Invite-only events: visible to host
    host_id = auth.uid()
    OR
    -- Invite-only events: visible to co-hosts
    EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = events.id
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
    OR
    -- Invite-only events: visible to accepted invitees
    EXISTS (
      SELECT 1 FROM event_attendee_invites
      WHERE event_attendee_invites.event_id = events.id
      AND event_attendee_invites.user_id = auth.uid()
      AND event_attendee_invites.status = 'accepted'
    )
    OR
    -- Admins see everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### 3B. Full RLS Matrix

| Role | `events` SELECT | `events` INSERT/UPDATE/DELETE | `event_attendee_invites` SELECT | `event_attendee_invites` INSERT | `event_attendee_invites` UPDATE | `event_attendee_invites` DELETE |
|------|----------------|------------------------------|-------------------------------|-------------------------------|-------------------------------|-------------------------------|
| `anon` | Public events only | Deny | Deny | Deny | Deny | Deny |
| `authenticated` (no relation) | Public events only | Per existing policy | Own invites only | Deny | Deny | Deny |
| Accepted invitee | Public + invited events | Deny | Own invites only | Deny | Own invite (accept/decline) | Deny |
| Host | Public + own events | Own events | Invites for own events | Create for own events | Revoke for own events | Deny (soft-delete via revoke) |
| Co-host | Public + co-hosted events | Co-hosted events | Invites for co-hosted events | TBD (approval question) | Deny | Deny |
| Admin | All events | All events | All invites | All invites | All invites | All invites |

### 3C. `event_attendee_invites` RLS Policies

```sql
-- Admins: full access
CREATE POLICY "admins_manage_attendee_invites" ON event_attendee_invites
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Hosts: manage invites for their events
CREATE POLICY "host_manage_attendee_invites" ON event_attendee_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id AND events.host_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id AND events.host_id = auth.uid())
  );

-- Invitees: read own invites, update own status
CREATE POLICY "invitee_read_own" ON event_attendee_invites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "invitee_respond" ON event_attendee_invites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 3D. Non-Member Token Access

Non-member (email-only) invitees cannot use RLS since they have no `auth.uid()`. Token validation and event data fetch for non-members MUST use the **service role** in an API route, similar to the existing `event_invites` acceptance pattern:

1. API route receives `?invite=TOKEN`
2. Service role looks up `token_hash = SHA256(TOKEN)`
3. If valid and not expired/revoked, returns event data
4. Sets a signed cookie or session to allow subsequent page loads

---

## 4. Threat Model and Abuse Controls

### 4A. Threat Matrix

| Threat | Severity | Likelihood | Mitigation |
|--------|----------|------------|------------|
| **Guessable event slugs** — attacker tries `/events/birthday-party-2026` | HIGH | HIGH | RLS blocks SELECT; 404 response (not 403, to avoid confirming existence) |
| **Token brute-force** — attacker tries random invite tokens | HIGH | LOW | 256-bit crypto-random tokens; rate-limit `/events/[id]?invite=` to 10/min/IP |
| **Token replay** — stolen token reused | MEDIUM | MEDIUM | Token is single-use for acceptance; after acceptance, access is via `user_id` |
| **Metadata leakage via OG** — bot crawls `/og/event/[slug]` | HIGH | HIGH | OG route must check visibility + auth; return generic fallback for private events |
| **Search index leakage** — private event indexed by search API | HIGH | HIGH | Search query must filter `visibility = 'public'` |
| **Digest email leakage** — private event sent to all subscribers | HIGH | MEDIUM | Digest query must filter `visibility = 'public'` |
| **Embed widget leakage** — embed URL shared publicly | MEDIUM | MEDIUM | Embed route must check visibility; return 404 for private events |
| **Scraping via enumeration** — iterate UUIDs | LOW | LOW | UUIDs are v4 (122 bits entropy); rate limiting on API |
| **Revoked invitee retains cached data** — browser cache | LOW | MEDIUM | Standard cache-control headers; no special mitigation needed |
| **Host impersonation** — attacker claims host_id | LOW | LOW | host_id set by server from auth.uid(), never from client |
| **Invite spam** — host sends thousands of invites | MEDIUM | LOW | Rate-limit invite creation (e.g., 50/event/day); admin audit log |

### 4B. Key Abuse Controls

1. **404 not 403**: Private events return 404 to non-invitees (prevents confirming existence)
2. **Token entropy**: 256-bit crypto-random, SHA-256 hashed at rest
3. **Token expiry**: 30-day default, configurable by host
4. **Rate limiting**: Invite token validation endpoint rate-limited per IP
5. **Invite caps**: Max 200 attendee invites per event (configurable by admin)
6. **Audit trail**: All invite create/accept/revoke actions logged with actor + timestamp
7. **No enumeration**: RLS ensures `SELECT` returns zero rows, not an error

---

## 5. Minimal-Risk Implementation Sequence

### PR 1: Schema + RLS Foundation (Migration Only)

**Scope:** Database changes only. No UI, no API route changes.

```
Migration: Add `visibility` column to `events` (default 'public')
Migration: Create `event_attendee_invites` table with RLS
Migration: Replace `public_read_events` policy with visibility-aware policy
```

**Rollback:** Drop column, drop table, restore original policy. All in a single rollback migration.

**Risk:** LOW — default `'public'` means all existing events are unaffected. New RLS policy returns the same results as before for all existing data.

**Verification:**
- `SELECT count(*) FROM events` returns same count as before for anon
- All existing tests pass without modification
- Admin can still see all events

### PR 2: Fix Pre-existing Leaks

**Scope:** Fix the two pre-existing issues discovered during investigation.

1. Add `is_published` check to OG image route (`/og/event/[id]`)
2. Add `status` filter to search API for non-open-mic events

**Rollback:** Revert the two file changes.

**Risk:** LOW — these are bug fixes, not new features. Could be merged independently/before PR 1.

### PR 3: Host UI for Creating Invite-Only Events

**Scope:** Event creation/edit form gets a visibility toggle.

1. Add visibility selector to event form (public / invite-only)
2. When `invite_only` selected, show invite management panel
3. Host can add invitees by email or member search
4. API route for creating `event_attendee_invites` rows
5. Email notification sent to invitees (new template in `EMAIL_CATEGORY_MAP`)

**Rollback:** Remove UI components; visibility column stays but is always `'public'`.

**Risk:** MEDIUM — new UI surface, new email template, new API route.

### PR 4: Read Surface Hardening

**Scope:** Update all 14 read surfaces to respect `visibility`.

1. `/happenings` — add `visibility = 'public'` to discovery query
2. `/events/[id]` — RLS handles filtering, but add 404 response for non-visible
3. `/og/event/[id]` — return generic OG image for private events
4. `/api/search` — add `visibility = 'public'` filter
5. Digest queries — add `visibility = 'public'` filter
6. Embed route — return 404 for private events
7. RSVP/comment/lineup APIs — add visibility check before allowing interaction

**Rollback:** Remove visibility checks from queries (RLS still provides baseline protection).

**Risk:** MEDIUM-HIGH — touches many files. Must be tested against every surface.

### PR 5: Non-Member Token Flow

**Scope:** Email-invite-link acceptance for non-authenticated users.

1. Token generation + email sending
2. `/events/[slug]?invite=TOKEN` validation API (service role)
3. Cookie/session-based access for non-members
4. Token-to-user backfill on signup

**Rollback:** Disable token validation endpoint; non-member invites become non-functional but member invites still work.

**Risk:** MEDIUM — introduces cookie-based auth path alongside Supabase auth.

### PR 6: CI/Test Expansion

**Scope:** Negative privilege-escalation tests + no-leakage tests.

Tests to add:
- `anon` cannot SELECT invite-only events
- `authenticated` (non-invitee) cannot SELECT invite-only events
- Invitee CAN SELECT after acceptance
- Revoked invitee CANNOT SELECT
- Search API returns zero results for private events
- OG route returns generic image for private events
- Embed route returns 404 for private events
- Digest does not include private events
- Host can see own private events
- Admin can see all private events
- Token brute-force returns 404 (not 403)
- Expired token returns 404

**Rollback:** N/A (tests only).

**Risk:** LOW.

---

## 6. Assumptions, Unknowns, and Verification Status

### VERIFIED

- [x] 14 read surfaces identified and audited
- [x] Current RLS policy is `USING (true)` — fully open SELECT
- [x] No sitemap or RSS feed exists for events
- [x] Existing `event_invites` table is for host/cohost roles, not attendee visibility
- [x] `guest_verifications` pattern exists for email-based non-member access
- [x] `DISCOVERY_STATUS_FILTER` is centralized in `tonightContract.ts`
- [x] Two pre-existing leaks found (OG route, search API)

### UNKNOWN — Require Sami Decision

1. **Can co-hosts create attendee invites?** Or only the primary host + admins?
2. **Should invite-only events appear in the host's public profile?** (e.g., "Sami is hosting 3 events" — does that count private ones?)
3. **Max invites per event?** Suggested: 200 default, admin-adjustable.
4. **Non-member token access duration?** Suggested: 24-hour cookie after token validation.
5. **Should non-member invitees be able to RSVP?** Current RSVP system supports guest RSVPs — should private events use the same flow?
6. **Email template category?** Suggested: new `event_invites` category in `EMAIL_CATEGORY_MAP`.

### ASSUMPTIONS (will proceed with unless overridden)

1. Default visibility is `'public'` — no existing events change behavior.
2. Only two visibility modes needed now: `public` and `invite_only`.
3. Invite expiry is soft (checked on read, no cron job needed).
4. Admin always sees all events regardless of visibility.
5. Private events still use the same `/events/[slug]` URL pattern.
6. `event_attendee_invites` is separate from `event_invites` (different access plane).

---

## 7. Risk Matrix Summary

| Risk | Severity | Likelihood | Status |
|------|----------|------------|--------|
| RLS policy change breaks existing queries | HIGH | LOW | Mitigated by default `'public'` |
| Private events leak through search | HIGH | HIGH | Blocked until PR 4 |
| Private events leak through OG metadata | HIGH | HIGH | Blocked until PR 4 (PR 2 fixes pre-existing) |
| Private events leak through digest emails | HIGH | MEDIUM | Blocked until PR 4 |
| Token brute-force | HIGH | LOW | Mitigated by 256-bit entropy + rate limiting |
| Performance degradation from RLS subqueries | MEDIUM | MEDIUM | Index on `event_attendee_invites(event_id, user_id)` + benchmark |
| Cookie-based auth conflicts with Supabase auth | MEDIUM | LOW | Isolated to non-member path only |

---

## 8. Approval Questions (Explicit Yes/No Gate Items)

**Sami must answer these before implementation begins:**

1. **APPROVE schema?** Add `visibility TEXT DEFAULT 'public'` to `events` table + new `event_attendee_invites` table?

2. **APPROVE RLS change?** Replace `USING (true)` with visibility-aware policy on `events`? This is the highest-risk change.

3. **APPROVE PR sequence?** 6-PR rollout as described (schema → fix leaks → host UI → surface hardening → token flow → tests)?

4. **Co-host invite permissions?** Can co-hosts create attendee invites, or only host + admin?

5. **Non-member token cookie duration?** 24 hours suggested.

6. **Max invites per event?** 200 suggested.

7. **APPROVE fixing pre-existing leaks** (OG route + search API) as PR 2, independent of the private events feature?

---

## 9. Execution Log

| PR | Status | Commit | Notes |
|----|--------|--------|-------|
| PR1: Leak hotfixes | ✅ Shipped | `46237526` | OG route + search API filters + 8 tests |
| PR2: Schema + RLS | ✅ Shipped + Applied | `fc182da7` | Migration applied via Mode B; 92/92 events = `public`; 40 tests |
| PR3: Host/admin invite UI/API | Pending | — | — |
| PR4: Read-surface hardening | Pending | — | — |
| PR5: Non-member token flow | Pending | — | — |
| PR6: CI guardrail expansion | Pending | — | — |
