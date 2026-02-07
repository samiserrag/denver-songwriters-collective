# Phase 7B - Community Invite Growth Loop (STOP-GATE Investigation)

**Status:** EXECUTED (Phase 7B.1 Complete)  
**Author:** Codex (Architect)  
**Date:** February 7, 2026  
**Related context:** Phase 7A complete; next-priority decision between invite/share growth loop vs external media embeds  
**Checked against:** `docs/GOVERNANCE.md`, `docs/BACKLOG.md`, `CLAUDE.md`, `docs/CONTRACTS.md`

> Investigation was approved by Sami for 7B.1 execution scope (share-first, no server-sent invite emails). Implementation is now complete.

---

## 1) Objective

Decide and scope the next tract for growth:

1. Community invite/share loop (member invites friends to join DSC, including digest + on-site CTAs)
2. External media embeds (YouTube/Spotify/Bandcamp/Apple Music playlist/video support)

This STOP-GATE recommends order, risks, and execution constraints.

---

## 2) Findings Summary

- The product already has many signup CTAs, but no dedicated member referral/invite workflow.
- Weekly digest templates have strong browse CTAs, but no "invite a friend" CTA.
- Infrastructure exists for sending email (`sendEmail`) and for token-based entity invites (`event_invites`, `venue_invites`), but not member referral invites.
- Backlog already tracks media embeds as open, currently P2.

Recommendation: execute invite/share growth loop first, then embeds.

---

## 3) Evidence Map (Exact Paths)

### A) Weekly digest surfaces exist, no invite-friend CTA

- `web/src/lib/email/templates/weeklyHappeningsDigest.ts:524` (happenings nudge link)
- `web/src/lib/email/templates/weeklyHappeningsDigest.ts:560` (primary "Browse All Happenings" CTA block)
- `web/src/lib/email/templates/weeklyHappeningsDigest.ts:644` (text-mode happenings nudge)
- `web/src/lib/email/templates/weeklyOpenMicsDigest.ts:209` (open mics CTA block)
- `web/src/lib/email/templates/weeklyOpenMicsDigest.ts:266` (text-mode browse CTA)

### B) High-traffic CTA surfaces currently point to browse/signup, not friend-invite

- `web/src/components/navigation/header.tsx:109` (desktop Sign up CTA)
- `web/src/components/navigation/mobile-menu.tsx:142` (mobile Sign up CTA)
- `web/src/app/page.tsx:403` (homepage hero CTA to happenings)
- `web/src/app/page.tsx:423` (Join us link to signup)
- `web/src/app/page.tsx:958` (early contributors CTA)
- `web/src/app/happenings/page.tsx:636` (community add/correction CTA row)
- `web/src/components/navigation/footer.tsx:67` (footer stay connected area)

### C) Invite infrastructure is entity-scoped (host/admin), not member-referral

- `web/src/app/api/my-events/[id]/invite/route.ts:46` (create event invite API)
- `web/src/app/api/my-events/[id]/invite/route.ts:123` (invite URL generation)
- `web/src/app/event-invite/page.tsx:203` (event invite acceptance UX)
- `web/src/app/venue-invite/page.tsx:175` (venue invite acceptance UX)
- `web/src/lib/supabase/database.types.ts:676` (`event_invites`)
- `web/src/lib/supabase/database.types.ts:3032` (`venue_invites`)

### D) Existing "invite someone new" flow is manual off-platform email compose

- `web/src/app/(protected)/dashboard/my-events/_components/CoHostManager.tsx:187`
- `web/src/app/(protected)/dashboard/my-events/_components/CoHostManager.tsx:205`

### E) Email sending + newsletter subscriber infrastructure exists

- `web/src/lib/email/mailer.ts:57` (`sendEmail`)
- `web/src/lib/email/mailer.ts:65` (minimal rate limit: 1 min cache per email+template, process-local)
- `web/src/app/api/newsletter/route.ts:5` (newsletter subscribe API)
- `web/src/lib/supabase/database.types.ts:2088` (`newsletter_subscribers` table)

### F) Embeds are already a documented backlog item

- `docs/BACKLOG.md:422` (artist/venue media embeds section)
- `docs/BACKLOG.md:429` (songwriter/venue embed scope)
- `docs/BACKLOG.md:432` (embed limits)

---

## 4) Problem Definition

Current state does not support the requested growth loop:

- Members cannot invite songwriter/open-mic friends via first-class product flow.
- No "invite friends" CTA system is present in digest or core navigation surfaces.
- No referral attribution contract exists to measure invite-to-signup conversion.

Embeds are valuable, but they are profile richness features. Invite/share is more direct growth infrastructure.

---

## 5) Scope Options

### Option A - Share-first (no platform-sent invite email in v1)

- Add "Invite Friends" CTA surfaces
- Provide copy-link, `mailto:`, and optional share intent
- Route to signup with referral params
- Capture attribution only (no outbound email from DSC)

Pros: lowest abuse risk, fastest ship, immediate growth loop.  
Cons: less polished than in-app email send.

### Option B - Full member invite email system

- Invite form with recipient emails + custom message
- Server-sent invite emails "on behalf of" inviter
- Token + invite status + acceptance tracking tables/routes

Pros: strongest UX.  
Cons: higher abuse, moderation, and deliverability risk; larger tract.

### Option C - Phased hybrid (recommended)

- Phase 7B.1: Option A (ship quickly)
- Phase 7B.2: add managed email invites after guardrails are proven

---

## 6) Classification

### Blocking vs Non-blocking

| ID | Finding | Severity | Why |
|---|---|---|---|
| B1 | No referral attribution contract | **Blocking** | Cannot validate growth impact of new CTAs |
| B2 | No abuse controls for user-initiated outbound invite email | **Blocking** for Option B | Could damage sender reputation and trust |
| B3 | Missing invite CTA copy/placement consistency | Non-blocking | UX inconsistency, but not data integrity |
| B4 | Embeds not implemented on profiles/events | Non-blocking for this tract | Valuable but separate objective |

### Correctness vs Cosmetic

| ID | Finding | Category |
|---|---|---|
| C1 | No invite attribution model | **Correctness** |
| C2 | No guarded member invite-email path | **Correctness** |
| C3 | No invite CTA across digest/site surfaces | Cosmetic + conversion |

---

## 7) Risks

1. **Email abuse risk (Option B):** broad invite-email send without durable limits/audit can be exploited.
2. **Attribution blind spots:** if referral params are not persisted at signup, growth gains are unmeasurable.
3. **Cross-surface drift:** digest CTA copy and site CTA copy may diverge without a small contract.
4. **Scope bleed:** embeds can silently creep into this tract and delay growth loop delivery.

---

## 8) Recommended Plan (No Execution Yet)

### 7B.1 (recommended first)

- Define a minimal referral contract (`ref`, `src`) for signup links
- Add invite CTA entry points:
  - header/mobile (logged-in)
  - homepage community sections
  - happenings page community CTA block
  - weekly digest HTML + text templates
- Add analytics/event logging for click-through and completed signup attribution

### 7B.2 (follow-up)

- Add in-app member invite email flow with:
  - strict per-user/day limits
  - domain and velocity checks
  - invite audit trail
  - blocklist/moderation hooks

### Separate future tract

- External embeds (YouTube/Spotify/Bandcamp/Apple Music), since already documented in `docs/BACKLOG.md`.

---

## 9) Test and Docs Plan

If approved for execution:

- API tests: referral param validation and persistence path
- UI tests: invite CTA visibility/links across approved surfaces
- Digest tests: HTML + text include invite CTA and referral links
- Contract update: add Invite Growth Loop section to `docs/CONTRACTS.md`
- Backlog update: add/raise explicit invite-share item priority in `docs/BACKLOG.md`

---

## 10) Do-Nothing Alternative

Keep current state:

- Pros: no implementation risk
- Cons: no structured community invite loop, weak growth compounding, no attribution for "word-of-mouth" growth

---

## 11) Subordinate Architect Critique (Self-applied)

### Assumptions

1. Growth impact is currently more valuable than profile richness polish.
2. Invite/share can ship without changing core event logic.
3. Digest and on-site CTA consistency matters for trust and conversion.

### Required Risks (format)

Finding: Invite email can be abused without durable limits.  
Evidence: `web/src/lib/email/mailer.ts:65` (process-local memory cache only).  
Impact: potential spam complaints and SMTP reputation damage.  
Suggested delta: keep 7B.1 share-first; gate 7B.2 on DB-backed rate limits + audit table.  
Confidence: 0.95

Finding: Existing invite systems are entity-specific, not member referrals.  
Evidence: `web/src/lib/supabase/database.types.ts:676`, `web/src/lib/supabase/database.types.ts:3032`.  
Impact: cannot reuse directly for community growth invites without model changes.  
Suggested delta: create separate member referral contract, do not overload event/venue invite tables.  
Confidence: 0.92

Finding: Digest currently nudges browsing only, not inviting.  
Evidence: `web/src/lib/email/templates/weeklyHappeningsDigest.ts:524`, `web/src/lib/email/templates/weeklyOpenMicsDigest.ts:209`.  
Impact: missed growth channel in high-intent weekly touchpoint.  
Suggested delta: add invite CTA in both HTML and text digest templates in same tract as site CTAs.  
Confidence: 0.93

### Required Deltas

1. Add explicit referral attribution acceptance criteria before UI edits.
2. Treat outbound invite-email as a second phase with separate stop-gate if chosen.

---

## 12) Approval Questions

1. Approve ordering: **Phase 7B invite/share first**, embeds second?
2. Approve phased approach: **7B.1 share-first now**, 7B.2 managed email invites later?
3. Approve CTA insertion surfaces for 7B.1:
   - weekly digest templates (happenings + open mics)
   - header/mobile (logged-in)
   - homepage/happenings community sections
4. Approve adding this item to canonical backlog as P1/P2 growth item during execution docs update?

---

## Execution Addendum (February 7, 2026)

### Scope executed

- Share-first invite flow shipped (`/dashboard/invite`):
  - copy link
  - `mailto:`
  - native share intent (when supported)
- No platform-sent invite emails added.
- Referral attribution captured end-to-end via `ref`, `via`, `src` and persisted on profile onboarding completion.
- Approved CTA surfaces updated:
  - header (logged-in)
  - mobile nav (logged-in)
  - homepage community sections
  - happenings community CTA block
  - weekly digest templates (happenings + open mics)

### Schema + contract updates

- Added migration: `supabase/migrations/20260207110000_add_profile_referral_attribution.sql`
- Added profile attribution fields:
  - `referred_by_profile_id`
  - `referral_via`
  - `referral_source`
  - `referral_captured_at`
- Updated contracts: `docs/CONTRACTS.md` (Phase 7B.1 invite/referral contract)
- Updated backlog:
  - `docs/BACKLOG.md`
  - `docs/backlog/post-gtm-3-1-active-backlog.md`

### Verification

- Lint: PASS
- Tests: PASS (`3807/3807`)
- Build: attempted twice; process hung in this environment during `next build` "Creating an optimized production build" and was terminated.
