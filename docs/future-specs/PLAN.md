# Dual-Track Product Strategy

**Status:** Locked
**Last Updated:** December 2024

---

## Overview

This project follows a **dual-track strategy** to maximize learning while minimizing risk. We build one codebase that serves two distinct products with different goals, audiences, and feature sets.

| Track | Product | Goal |
|-------|---------|------|
| **A** | Denver Songwriters Collective (DSC) | Full community hub for Denver musicians |
| **B** | Open Mic Manager (white-label) | Focused host-first product for any venue |

**Metaphor:**
- DSC = Kitchen sink (everything a music community needs)
- White-label = Knife (one sharp tool that does one thing perfectly)

---

## Track A: Denver Songwriters Collective

### Vision
A comprehensive community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

### Design Principles
1. **Explore-first, identity-last** — Users can browse everything before signing up
2. **No forced signup** — Core value accessible without account
3. **No passwords** — Email-only verification for actions
4. **Progressive identity** — Build trust over time, not at the door

### Feature Scope
- Open mic directory with map view
- Event calendar (DSC happenings, community events)
- Timeslot system with live lineup
- Member profiles (songwriters, hosts, studios)
- Community blog
- Photo gallery with albums
- Spotlight features
- RSVP system with waitlist
- Studio booking

### Identity Model
| Action | Requirement |
|--------|-------------|
| Browse events/profiles | None |
| View live lineup | None |
| Claim/cancel slot | Verified email |
| RSVP to event | Verified email |
| Create profile | Email + name |
| Host events | Approved account |
| Admin actions | Admin account |

---

## Track B: Open Mic Manager (White-Label)

### Vision
A focused, opinionated product for open mic hosts and venue managers. Does one thing extremely well: live lineup management.

### Design Principles
1. **Host-first** — Built for the person running the show
2. **Opinionated defaults** — Less configuration, more action
3. **Minimal surface area** — Only what's needed, nothing extra
4. **Mobile-first** — Works on the phone in your pocket

### Killer Feature (Non-Negotiable)
**Live Lineup + Up Next system** — The core value proposition. Everything else is secondary.

### MVP Features (Strict)
- Event creation
- Slot configuration
- Live lineup management
- Up Next display view
- Claim / cancel slots
- Waitlist with auto-promotion
- Email notifications
- Display mode (TV / tablet)
- Mobile-first UI

### Explicitly NOT in MVP
- Community profiles
- Blog
- Gallery
- Discovery across events
- Social features
- AI features
- Multi-venue dashboards
- Analytics

### Identity Model
| Action | Requirement |
|--------|-------------|
| View lineup | None |
| Claim/cancel slot | Verified email |
| Host controls | Account |
| Performer profiles | Not in MVP |

---

## Shared Core vs Divergence Layer

### Shared Core (Both Products)
These components are identical across both tracks:

| Component | Description |
|-----------|-------------|
| `event_timeslots` | Slot storage and timing |
| `timeslot_claims` | Claims with status tracking |
| `guest_verifications` | Email-only identity |
| `event_lineup_state` | Now Playing persistence |
| Waitlist logic | Auto-promotion on cancellation |
| Display components | LineupDisplay, NowPlayingPanel, UpNextPanel |
| Email verification | Codes + magic links |

### Divergence Layer (Product-Specific)
These components differ between tracks:

| Aspect | DSC | White-Label |
|--------|-----|-------------|
| Branding | DSC logo, colors, copy | Configurable per deployment |
| UI density | Full navigation, rich pages | Minimal, focused screens |
| Feature flags | All features enabled | MVP features only |
| Admin scope | Full admin dashboard | Host-only controls |
| Profiles | Rich member profiles | None (email only) |
| Discovery | Cross-event browsing | Single-event focus |

### Architecture
- **Single database** — Shared schema, feature flags for separation
- **Single codebase** — Environment variables control product mode
- **Shared packages** — Core logic extracted to shared modules
- **Divergent routes** — Different page structures per product

---

## Execution Order

The following order is explicit and numbered. Do not skip steps.

### 1. Guest-first + email-only flows in DSC
Build Progressive Identity infrastructure:
- Email verification for slot claims
- Magic links for offer confirmation
- No passwords, no forced accounts

### 2. Denver adoption of Live Lineup / Up Next
Deploy timeslot system to real Denver events:
- TV display at venues
- Host controls for now playing
- Real-world validation

### 3. Validate host reliance (behavior, not signups)
Measure success by:
- Are hosts using the system every week?
- Are performers claiming slots?
- Is the display being used at venues?

NOT by:
- Number of accounts created
- Profile completeness
- Social engagement

### 4. Extract white-label MVP from stable core
Once DSC flows are proven:
- Identify shared core components
- Create feature flag layer
- Build minimal host-focused UI

### 5. Strip everything except killer feature
For white-label MVP:
- Remove profiles, blog, gallery
- Remove discovery features
- Remove social features
- Keep ONLY: events, slots, claims, display

### 6. Quiet launch
- Deploy to 1-2 pilot venues outside Denver
- Gather feedback from hosts
- Iterate on host experience
- Expand gradually

---

## Success Metrics

### Track A (DSC)
- Weekly active hosts using timeslots
- Slots claimed per event
- Display usage at venues
- Community growth (secondary)

### Track B (White-Label)
- Host retention (weekly usage)
- Time to first event created
- Performer claim rate
- Host NPS

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Over-engineering shared core | Build for DSC first, extract later |
| White-label diverges too far | Strict MVP scope, no feature creep |
| DSC becomes too complex | Progressive identity keeps friction low |
| Hosts don't adopt timeslots | Validate with real events before scaling |

---

## Document References

| Document | Purpose |
|----------|---------|
| [progressive-identity.md](./specs/progressive-identity.md) | Email-only identity spec |
| [white-label-mvp.md](./specs/white-label-mvp.md) | White-label product spec |
| [v0.4.0.md](./releases/v0.4.0.md) | Timeslot system release notes |
| [quality-gates.md](./quality-gates.md) | Build/test requirements |
