# Weekly Personalized Digest — GTM North Star Strategy

**Status:** DRAFT — AWAITING STOP-GATE APPROVAL
**Version:** 0.1
**Created:** January 2026
**Author:** Repo Agent
**Audience:** Product owner, repo agents, future contributors

---

## Executive Summary

The **Weekly Personalized Digest** is the #1 growth engine for DSC. Unlike generic email blasts or social media, a personalized weekly email delivers high-value, locally-relevant information directly to songwriters, hosts, and fans — creating a sustainable, trust-based acquisition and retention channel.

This document defines the North Star vision, current state audit, phased implementation plan, and success metrics for making the Weekly Personalized Digest the centerpiece of DSC's growth strategy.

---

## 1. Why the Weekly Digest is the #1 Growth Engine

### 1.1 The Hypothesis

> **If we send a weekly, personalized digest of happenings tailored to each user's preferences (location, event types, favorite venues), we will achieve higher open rates, more event attendance, and stronger word-of-mouth growth than any other channel.**

### 1.2 Competitive Advantages

| Advantage | Description |
|-----------|-------------|
| **Direct Relationship** | Email bypasses algorithm changes, platform deprecation, and social media noise |
| **Personalization** | Filtered by user's location, event type preferences, and past behavior |
| **Zero CAC** | No ad spend required; organic list growth via value delivery |
| **Trust Signal** | Regular, useful emails build relationship and brand trust |
| **Shareable** | "Forward to a friend" enables organic reach expansion |
| **Measurable** | Open rates, clicks, and RSVP conversions are directly trackable |

### 1.3 Why NOT Other Channels (As Primary)

| Channel | Limitation |
|---------|------------|
| Social media | Algorithm-dependent, attention fragmented, no personalization |
| SEO | Good for discovery, not retention or personalization |
| Paid ads | Expensive, stops working when budget stops |
| Push notifications | Lower engagement than email, requires app |

**Conclusion:** Email is the only channel that combines personalization, direct delivery, zero CAC, and measurability.

---

## 2. Current State Audit

### 2.1 Existing Email Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Email Transport | ✅ Complete | Fastmail SMTP via `lib/email/mailer.ts` |
| Template System | ✅ Complete | 21+ templates in `lib/email/templates/` |
| Template Registry | ✅ Complete | `lib/email/registry.ts` with type safety |
| Email Style Guide | ✅ Complete | `docs/emails/EMAIL_STYLE_GUIDE.md` |
| Email Inventory | ✅ Complete | `docs/emails/EMAIL_INVENTORY.md` |

### 2.2 Existing Digest Infrastructure (Phase 1.5)

| Component | Status | Notes |
|-----------|--------|-------|
| Weekly Open Mics Digest | ✅ Shipped | `lib/digest/weeklyOpenMics.ts` |
| Cron Job | ✅ Configured | `vercel.json` — Sunday 8:00 PM Denver |
| Kill Switch | ✅ Implemented | `ENABLE_WEEKLY_DIGEST` env var |
| Recipient Filtering | ✅ Working | `email_event_updates` preference respected |
| Event Expansion | ✅ Working | Uses `expandOccurrencesForEvent()` |

**Current Limitations (Phase 1.5 MVP):**
- No personalization — all recipients get identical email
- Open mics only — no other event types
- No location filtering — Denver-wide
- No saved filter presets — no user preferences stored
- No web version — email only

### 2.3 Existing Subscriber/Preference Tables

| Table | Purpose | Used For Digest? |
|-------|---------|------------------|
| `newsletter_subscribers` | Anonymous email collection (homepage/footer forms) | ❌ Not yet |
| `notification_preferences` | Per-user email toggles (event_updates, etc.) | ✅ Yes |
| `profiles` | User accounts with email | ✅ Yes (via `email_event_updates`) |

**Key Insight:** Two separate subscriber pools exist:
1. **Anonymous subscribers** — `newsletter_subscribers` table (no account)
2. **Registered users** — `profiles` table (with account, uses `notification_preferences`)

Phase 1.5 only sends to registered users with `email_event_updates` enabled.

### 2.4 Existing UX Placements

| Location | CTA | Target |
|----------|-----|--------|
| Homepage ("Stay in the Loop") | Email input + "Join the DSC Newsletter" | `newsletter_subscribers` |
| Footer ("Stay Connected") | Email input + "Join" | `newsletter_subscribers` |
| Dashboard Settings | Email preference toggles | `notification_preferences` |
| Happenings Page | View mode selector (Timeline/Series/Map) | None (no save) |
| Happenings Filters | Type, Days, Location filters | None (no save) |

**Gap:** Happenings filter preferences are NOT saved. Users must re-apply filters every visit.

---

## 3. North Star Vision — Weekly Personalized Digest

### 3.1 User Experience Goals

> **"Every Sunday evening, I get an email with exactly the open mics and events I care about — filtered by my location, my favorite days, and my preferred event types. I can click any event to see details. I can also view this digest on the web if I miss the email."**

### 3.2 Personalization Dimensions

| Dimension | Example | Priority |
|-----------|---------|----------|
| **Event Type** | Open mics only, or include showcases, kindred groups, jams | P1 |
| **Location** | Within 10 miles of ZIP 80202, or city "Denver" | P1 |
| **Day of Week** | Only show events on Mon/Wed/Fri | P2 |
| **Cost** | Free only, or all events | P2 |
| **Venues** | Favorite venues highlighted | P3 |

### 3.3 Key Features (Phased)

| Feature | Phase | Description |
|---------|-------|-------------|
| Open mics digest (no personalization) | GTM-0 (Done) | Phase 1.5 shipped |
| All event types in digest | GTM-1 | Expand beyond open_mic |
| Saved filter presets | GTM-2 | User saves preferences → digest uses them |
| Location-based filtering | GTM-2 | ZIP/city/radius in digest |
| Web version of digest | GTM-3 | `/digest/weekly` page mirrors email |
| Anonymous subscriber digests | GTM-4 | Send to `newsletter_subscribers` with defaults |
| Digest preview before signup | GTM-5 | Show sample digest to convert signups |

### 3.4 The "Digest Everywhere" Principle

> **Anywhere a user can filter happenings, they should be able to save those filters as their digest preferences.**

Implementation: "Save as my digest" button on `/happenings` filters.

### 3.5 Email Philosophy

The weekly digest is **community infrastructure**, not marketing. It exists to connect songwriters with stages, sessions, and each other. Every design decision flows from this:

1. **Auto opt-in is intentional and permanent.** New members receive the digest by default. This is not a temporary policy or a shortcut — it is the correct default because the digest is free, useful, and community-supporting. This default holds unless reversed by an explicit policy decision from Sami.

2. **One-click reversible opt-out is a hard requirement.** Every digest email must include an unsubscribe link that works without login, takes effect immediately, and uses warm language with zero guilt. This is non-negotiable for trust and deliverability.

3. **Opt-back-in must be obvious and trivial.** The unsubscribe confirmation page and the dashboard settings must make it effortless to re-enable. No waiting period, no friction, no "are you sure?" gates.

4. **Emails invite correction and participation.** The digest footer should invite recipients to reply with corrections ("Something wrong? Reply to this email."). This turns passive readers into active contributors and improves data quality.

5. **Dark patterns are prohibited.** No deceptive unsubscribe flows, forced retention, guilt-based copy ("We'll miss you!"), or buried opt-out links. See CLAUDE.md governance for the binding rule.

### 3.6 Control Hierarchy

The digest system has three control layers, in precedence order:

| Priority | Layer | Purpose | Who Controls |
|----------|-------|---------|--------------|
| 1 (highest) | Env var kill switch | Emergency stop (e.g., broken template, spam incident) | Deploy config (Vercel) |
| 2 | DB-backed `digest_settings` table | Primary operational control — enable/disable via admin panel | Admin via UI |
| 3 | Idempotency guard (`digest_send_log`) | Prevents duplicates regardless of how send is triggered | Automatic |

**Normal operation:** Env var absent → DB toggle controls → idempotency prevents repeats.
**Emergency:** Set env var to `"false"` → all sends blocked regardless of DB state.

The env var is an escape hatch, not the primary control. Once the DB toggle is operational, the env var should be removed from Vercel and only re-added in emergencies.

---

## 4. Data Model Implications

### 4.1 New Table: `digest_preferences`

```sql
CREATE TABLE digest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event type preferences (array of event types to include)
  event_types TEXT[] DEFAULT ARRAY['open_mic'],

  -- Location preferences
  zip_code TEXT,
  city TEXT,
  radius_miles INTEGER DEFAULT 10,

  -- Day preferences (0=Sun, 1=Mon, ... 6=Sat)
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],

  -- Cost preferences
  free_only BOOLEAN DEFAULT FALSE,

  -- Favorite venues (optional)
  favorite_venue_ids UUID[],

  -- Digest delivery
  digest_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user lookup
CREATE UNIQUE INDEX digest_preferences_user_id_idx ON digest_preferences(user_id);
```

**Note:** This table is SEPARATE from `notification_preferences` (which controls email delivery on/off). This table controls WHAT content appears in the digest.

### 4.2 Migration Path

| Phase | Migration |
|-------|-----------|
| GTM-2 | Create `digest_preferences` table |
| GTM-2 | Add UI to save preferences from `/happenings` filters |
| GTM-2 | Modify `getUpcomingOpenMics()` to accept preferences |
| GTM-3 | Add `/digest/weekly` web page |
| GTM-4 | Add `newsletter_digest_enabled` column to `newsletter_subscribers` |

### 4.3 Existing Table Changes

| Table | Change | Phase |
|-------|--------|-------|
| `notification_preferences` | None (delivery toggle stays here) | — |
| `newsletter_subscribers` | Add `digest_enabled` column | GTM-4 |

---

## 5. UX Placements — Proposed

### 5.1 Digest Preferences UI

| Location | Component | Action |
|----------|-----------|--------|
| `/dashboard/settings` | "Digest Preferences" section | Edit event types, location, days |
| `/happenings` filters | "Save as my digest →" button | Save current filters as digest prefs |
| `/happenings` header | "📬 Get this as an email" banner (if not subscribed) | Link to signup/settings |

### 5.2 Digest Web Version

| Route | Purpose |
|-------|---------|
| `/digest/weekly` | Web version of the weekly digest (same content as email) |
| `/digest/weekly?preview=true` | Public preview for signup conversion |

### 5.3 Copy Principles

| Context | Copy Style |
|---------|------------|
| Signup CTAs | Value-first: "Get personalized open mic updates every Sunday" |
| Preferences UI | Clear, no jargon: "What types of events do you want?" |
| Email subject | Personalized: "🎤 5 Open Mics This Week in Denver (Your Digest)" |

---

## 6. Implementation Phase Plan

### GTM-1: Expand to All Event Types (2-3 days)

**Goal:** Digest includes all event types, not just open mics.

**Changes:**
- Rename `weeklyOpenMicsDigest` → `weeklyHappeningsDigest` (or keep both)
- Query all event types (use `.overlaps("event_type", types)` — `event_type` is now `text[]`)
- Update email template subject/copy
- Update cron job

**Risk:** Larger email = lower engagement? Monitor open rates.

### GTM-2: Saved Filter Presets + Personalized Digest (5-7 days)

**Goal:** Users can save filter preferences; digest uses those preferences.

**Changes:**
- Create `digest_preferences` table (migration)
- Add "Digest Preferences" section to `/dashboard/settings`
- Add "Save as my digest" button to `/happenings` filters
- Modify digest query to use per-user preferences
- Handle default preferences (all events, all locations)

**Risk:** Migration complexity; ensure backward compatibility with Phase 1.5 recipients.

### GTM-3: Web Version of Digest (2-3 days)

**Goal:** Users can view their digest on the web (if they miss the email).

**Changes:**
- Create `/digest/weekly` page (SSR with user preferences)
- Add "View on web" link in email footer
- Add public preview mode for non-logged-in users

**Risk:** Minimal; reuses existing digest data fetching.

### GTM-4: Anonymous Subscriber Digests (3-4 days)

**Goal:** Send digest to `newsletter_subscribers` (no account required).

**Changes:**
- Add `digest_enabled` column to `newsletter_subscribers`
- Create digest with sensible defaults (all Denver, all event types)
- Separate cron job or batch in existing job
- Add unsubscribe link specific to anonymous subscribers

**Risk:** Deliverability; no double opt-in currently. Consider adding verification email.

### GTM-5: Digest Preview for Signup Conversion (2-3 days)

**Goal:** Show a sample digest to convince visitors to sign up.

**Changes:**
- Create `/digest/preview` page (public, uses defaults)
- Add CTA: "Get this every Sunday" → signup flow
- A/B test placement on homepage

**Risk:** Minimal; primarily a conversion optimization.

---

## 7. Success Metrics

### 7.1 North Star Metric

> **Weekly Active Digest Readers (WADR):** Users who open the digest email OR visit `/digest/weekly` in a given week.

### 7.2 Supporting Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Email open rate | >40% | Mailgun/Fastmail analytics |
| Click-through rate | >15% | Link tracking |
| RSVP conversion | >5% of clickers | `/api/events/[id]/rsvp` attribution |
| Digest subscriber growth | +10% MoM | `newsletter_subscribers` count |
| Unsubscribe rate | <1% | Unsubscribe link clicks |

### 7.3 Anti-Metrics (What We Don't Optimize)

| Anti-Metric | Why |
|-------------|-----|
| Email send volume | Spammy; focus on quality |
| Social shares | Vanity; focus on direct value |
| Time spent in email | Emails should be quick to scan |

---

## 8. Edge Cases and Risks

### 8.1 Edge Cases

| Case | Handling |
|------|----------|
| User has no preferences saved | Use defaults (all Denver, all event types) |
| User's ZIP has no events | Show nearest events + "Expand your search" CTA |
| User unsubscribes from event_updates | No digest sent (respects preference) |
| Cron job fails | Retry logic; alert admin |
| Email bounces | Mark email invalid; suggest update |

### 8.2 Risks

| Risk | Mitigation |
|------|------------|
| Low engagement | Start with open mics (proven), expand gradually |
| Spam complaints | Clear unsubscribe; only send to opted-in |
| Deliverability issues | Use established SMTP; warm up sending |
| Personalization complexity | Start simple (location + type); add dimensions later |
| Data migration breaks existing | Additive-only migrations; backward compatibility |

---

## 9. Test Plan (Future Phases)

### GTM-1 Tests
- [ ] Digest includes all event types (not just open_mic)
- [ ] Email subject reflects event type diversity
- [ ] Cron job handles larger payload

### GTM-2 Tests
- [ ] `digest_preferences` table created with correct schema
- [ ] User can save preferences from `/happenings`
- [ ] User can edit preferences in `/dashboard/settings`
- [ ] Digest respects saved preferences
- [ ] Default preferences work for users without saved prefs

### GTM-3 Tests
- [ ] `/digest/weekly` renders correctly for logged-in user
- [ ] `/digest/weekly?preview=true` renders for anonymous user
- [ ] "View on web" link in email works

### GTM-4 Tests
- [ ] Anonymous subscribers receive digest
- [ ] Unsubscribe link works for anonymous subscribers
- [ ] `digest_enabled` column controls delivery

### GTM-5 Tests
- [ ] Preview page shows sample digest
- [ ] Signup CTA links to correct flow
- [ ] Preview uses sensible defaults

---

## 10. Documentation Updates Required

### To Update on Approval

| Document | Update |
|----------|--------|
| `CLAUDE.md` | Add GTM-x phase entries to Recent Changes |
| `docs/emails/EMAIL_INVENTORY.md` | Add `weeklyHappeningsDigest` template |
| `docs/PRODUCT_NORTH_STAR.md` | Reference digest as growth channel (if approved) |
| `docs/emails/EMAIL_STYLE_GUIDE.md` | Add digest-specific guidance |

### New Documents to Create

| Document | Purpose |
|----------|---------|
| `docs/gtm/digest-implementation-plan.md` | Detailed technical spec for GTM-1/2/3/4/5 |
| `docs/gtm/digest-metrics-dashboard.md` | How to track success metrics |

---

## 11. Related Documents

- `docs/PRODUCT_NORTH_STAR.md` — Product philosophy
- `docs/emails/EMAIL_INVENTORY.md` — All email templates
- `docs/emails/EMAIL_STYLE_GUIDE.md` — Email voice/tone
- `docs/investigation/phase-weekly-open-mics-email-stopgate.md` — Phase 1.5 implementation
- `CLAUDE.md` — Repo operations (cron config, file locations)

---

## STOP-GATE Report

### Files Created/Modified (This Phase — Docs Only)

| File | Action | Purpose |
|------|--------|---------|
| `docs/gtm/weekly-personalized-digest-north-star.md` | Created | This strategy document |

### UX Placements Identified (Future Phases)

| Route | Component | Purpose | Phase |
|-------|-----------|---------|-------|
| `/dashboard/settings` | DigestPreferencesSection | Edit digest filters | GTM-2 |
| `/happenings` | "Save as my digest" button | Convert filters to preferences | GTM-2 |
| `/happenings` | "📬 Get this as email" banner | Signup prompt | GTM-2 |
| `/digest/weekly` | WeeklyDigestPage | Web version of email | GTM-3 |
| `/digest/preview` | DigestPreviewPage | Public sample for conversion | GTM-5 |

### Data Model Implications

| Table | Change | Phase |
|-------|--------|-------|
| `digest_preferences` | **New table** — user digest filter preferences | GTM-2 |
| `newsletter_subscribers` | Add `digest_enabled` column | GTM-4 |

### Implementation Phases Summary

| Phase | Scope | Effort |
|-------|-------|--------|
| GTM-1 | All event types in digest | 2-3 days |
| GTM-2 | Saved filter presets + personalized digest | 5-7 days |
| GTM-3 | Web version of digest | 2-3 days |
| GTM-4 | Anonymous subscriber digests | 3-4 days |
| GTM-5 | Digest preview for conversion | 2-3 days |

### Edge Cases and Risks

- **Empty digest** — Show "No events match your filters" + CTA to expand
- **Deliverability** — Monitor bounce rates; consider double opt-in for anonymous
- **Migration safety** — Additive-only; backward compatible with Phase 1.5

### Test Plan Reference

See Section 9 for phase-specific test coverage requirements.

---

**STOP — AWAITING APPROVAL**

This document contains strategy and planning only. No code changes, migrations, or architecture changes have been made. Approval required before proceeding to GTM-1 implementation.

**Questions for Approval:**
1. Is the phased approach (GTM-1 through GTM-5) acceptable?
2. Should GTM-1 (all event types) proceed immediately?
3. Is the `digest_preferences` table schema acceptable?
4. Any concerns about anonymous subscriber digests (GTM-4)?
