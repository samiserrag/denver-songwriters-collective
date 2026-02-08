# White-Label MVP Spec

**Product Name:** Open Mic Manager (working title)
**Status:** Planning
**Created:** December 2024

---

## Overview

Open Mic Manager is a focused, opinionated product for open mic hosts and venue managers. It does one thing extremely well: **live lineup management**.

This is Track B of the dual-track strategy. It extracts the proven core from The Colorado Songwriters Collective and strips away everything that isn't essential for running an open mic night.

---

## Core User

**Primary:** Open mic hosts and venue managers

**Persona:**
- Runs 1-3 open mics per week
- Uses phone during the event
- Needs to see who's next at a glance
- Wants performers to sign up without hassle
- May display lineup on venue TV

**NOT the target user:**
- Community builders (use DSC)
- Festival organizers (too complex)
- Casual attendees (they just view)

---

## Killer Feature (Non-Negotiable)

### Live Lineup + Up Next System

This is the core value proposition. Everything else is secondary.

**What it does:**
1. Host creates slots for the night
2. Performers claim slots via email verification
3. Host controls "Now Playing" from their phone
4. Venue TV shows live lineup with auto-refresh
5. Waitlist auto-promotes when someone cancels

**Why it wins:**
- No sign-up sheet to manage
- No verbal announcements of who's next
- Performers know exactly when they're on
- Venue looks professional with TV display

---

## MVP Features (Strict)

### Must Have

| Feature | Description |
|---------|-------------|
| Event creation | Host creates an open mic with date/time |
| Slot configuration | Set number of slots, duration, start time |
| Live lineup | Real-time view of all slots and claims |
| Up Next display | TV-optimized view for venues |
| Claim slot | Performer claims with email verification |
| Cancel claim | Performer cancels via magic link |
| Waitlist | Automatic when slots are full |
| Auto-promotion | Next waitlist person gets offered slot |
| Email notifications | Verification codes, offer notifications |
| Display mode | Fullscreen TV/tablet view |
| Mobile-first UI | Works on host's phone |

### Host Controls

| Control | Description |
|---------|-------------|
| Set Now Playing | Mark current performer |
| Previous/Next | Navigate through lineup |
| Clear Now Playing | Reset to no current performer |
| Mark No-Show | Remove performer, promote waitlist |
| Mark Performed | Record successful performance |
| Add Walk-Up | Add guest name without verification |

---

## Explicitly NOT in MVP

The following features exist in DSC but are **not included** in the white-label MVP:

| Feature | Why Excluded |
|---------|--------------|
| Community profiles | Adds complexity, not needed for lineup |
| Blog | Content management is separate product |
| Gallery | Photo management is separate product |
| Discovery across events | Single-event focus for MVP |
| Social features | Not core to lineup management |
| AI features | Future enhancement, not MVP |
| Multi-venue dashboards | Single-host focus for MVP |
| Analytics | Future enhancement |
| RSVP system | Different use case than slot claims |
| Studio booking | DSC-specific feature |
| Member directory | Requires profile system |

---

## Identity Model

| Action | Requirement | Implementation |
|--------|-------------|----------------|
| View lineup | None | Public page |
| Claim slot | Verified email | 6-digit code |
| Cancel claim | Verified email | Magic link |
| Confirm offer | Verified email | Magic link |
| Host controls | Account | Supabase auth |
| Admin actions | Not in MVP | - |

### No Passwords for Performers

Performers never create accounts or passwords. They:
1. Enter name + email
2. Receive 6-digit code
3. Enter code to verify
4. Done

This is the same Progressive Identity system used in DSC.

### Host Accounts

Hosts need accounts to:
- Create events
- Manage lineup during event
- Access their events list

Host signup is simple:
1. Email + password
2. Verify email
3. Create first event

No approval process (unlike DSC host applications).

---

## Architecture

### Shared Core with DSC

These components are identical:

```
Shared:
├── event_timeslots (table)
├── timeslot_claims (table)
├── guest_verifications (table)
├── event_lineup_state (table)
├── Waitlist logic (RPC functions)
├── LineupDisplay (component)
├── NowPlayingPanel (component)
├── UpNextPanel (component)
├── QRProfileBadge (component) - disabled for guests
├── Email verification flow
└── Magic link handling
```

### Divergence Layer

These components differ:

```
White-Label Specific:
├── Minimal navigation (no header menu)
├── Host-focused dashboard
├── Simplified event creation
├── No profile pages
├── No community features
├── Feature flags: profiles=off, blog=off, gallery=off
└── Custom branding per deployment
```

### Database Strategy

- **Single database schema** — Both products share tables
- **Feature flags** — Control which features are active
- **RLS policies** — Same security model
- **No data duplication** — Shared core is truly shared

### Deployment

Each white-label instance:
- Gets its own Vercel deployment
- Points to shared Supabase (or own instance)
- Has environment variables for branding
- Uses feature flags to disable DSC features

---

## UI Principles

### Mobile-First

- Primary use is host on phone during event
- Touch-friendly buttons (min 44px)
- Single-column layouts
- No hover states required

### Minimal Chrome

- No header navigation menu
- No footer
- Just the content needed for the task
- Logo in corner (configurable)

### Fast Actions

- One tap to set Now Playing
- Swipe or tap for Previous/Next
- Large, obvious buttons
- No confirmation dialogs for non-destructive actions

---

## Screen Inventory (MVP)

| Screen | Purpose | Auth |
|--------|---------|------|
| `/` | Landing page / login | None |
| `/events/new` | Create event | Host |
| `/events/[id]` | Event detail + lineup | Public |
| `/events/[id]/manage` | Host controls | Host |
| `/events/[id]/display` | TV display | None |
| `/my-events` | Host's event list | Host |
| `/claim` | Guest claim flow | None + email |
| `/action` | Confirm/cancel via magic link | Token |

---

## Branding Configuration

Each deployment can customize:

```typescript
// Environment variables
BRAND_NAME="Venue Name Open Mic"
BRAND_LOGO_URL="https://..."
BRAND_PRIMARY_COLOR="#..."
BRAND_SECONDARY_COLOR="#..."
```

Future: Admin UI to configure branding without code changes.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to first event | <5 minutes |
| Host weekly retention | >60% |
| Slots claimed per event | >50% of available |
| No-show rate | <20% |
| Display usage | >50% of events |

---

## Launch Plan

### Phase 1: Extract from DSC
- Identify shared components
- Create feature flag layer
- Build minimal host UI

### Phase 2: Pilot
- 1-2 venues outside Denver
- Weekly feedback sessions
- Iterate on host experience

### Phase 3: Quiet Launch
- Invite-only signups
- Focus on host acquisition
- No public marketing yet

### Phase 4: Public Launch
- Landing page
- Self-serve signup
- Documentation

---

## Open Questions

1. **Pricing model?**
   - Free tier with limits?
   - Per-event pricing?
   - Monthly subscription?
   - Decision: Defer until pilot feedback

2. **Multi-host support?**
   - Can multiple people manage same event?
   - Decision: Single host for MVP, multi-host later

3. **Event templates?**
   - Save settings for recurring events?
   - Decision: Future enhancement

4. **SMS notifications?**
   - Higher engagement than email
   - Higher cost
   - Decision: Email for MVP, SMS as upgrade

---

## References

- [PLAN.md](../PLAN.md) - Dual-track strategy
- [progressive-identity.md](./progressive-identity.md) - Email verification spec
- [v0.4.0.md](../releases/v0.4.0.md) - Timeslot system release notes
