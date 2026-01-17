# Deferred High-Priority Features

> **DEPRECATED** — This document has been merged into [docs/BACKLOG.md](./BACKLOG.md).
> See the "Member Pages" section in the canonical backlog for current status.
>
> *Deprecated: 2026-01-16*

---

> ~~**Status:** Documentation-only. These features are high priority but blocked until ABC track completes.~~
>
> ~~**ABC Track:** Data Health + Events Ops Console + Host Messaging~~

---

## 🎤 Member Profile Enhancements (High Priority, Post-ABC)

**Goal:** Make member profiles feel alive, useful, and worth returning to — without turning them into full websites. Profiles should support discovery, collaboration, and off-platform activity.

---

### 1. Upcoming Performances (Member-Managed)

Members can add external performance links (URL + date + venue name).

- These appear under "Upcoming Performances" even if the event is not hosted on DSC
- Supports Bandsintown / venue pages / Eventbrite / custom URLs
- Prevents empty "Check back soon" sections

**Notes:**
- Read-only for other users
- No event creation or calendar logic required
- Purely profile-level metadata

---

### 2. Profile Updates / Announcements

Lightweight "Updates" or "Announcements" section.

- Short text posts (e.g. "New single out", "Looking for bassist", "Tour dates added")
- Chronological, newest first
- Optional visibility controls (public / members only)

---

### 3. Collaboration Messaging

Allow members to signal openness to collaboration.

- Optional "Message for collaboration" CTA
- Clear boundary: not a full DM system, just structured outreach
- Anti-spam protections required (rate limit / opt-in)

---

### 4. Profile Gallery + Media Control

Members can upload multiple images.

- Select:
  - Profile image (avatar)
  - Cover image (profile header)
- Gallery images appear on profile page
- Reuse existing image upload infrastructure where possible

---

### 5. Embedded Media (Spotify / YouTube)

Allow embedding:

- Spotify artist/playlist
- YouTube video or channel
- URL-based embeds (no OAuth in v1)
- One or two embeds max per profile to avoid clutter

---

## 🔐 Permissions & Scope Guardrails

- Profile owner controls their content
- Admin override for moderation
- No monetization, tipping, or analytics in this phase
- No venue management or event creation tied to profiles (yet)

---

## 🔄 Dependencies

Requires:
- Stable Events Ops Console ✅ (Phase 4.62)
- Host → Attendee messaging live (pending)
- Reduced "unconfirmed" noise on public event pages (pending)

---

## 🚫 Explicitly Out of Scope (for this phase)

- Full DM inbox
- Booking requests
- Venue claims
- Profile monetization
- Social feed / likes / follows

---

## Status

| Feature | Priority | Status |
|---------|----------|--------|
| Upcoming Performances | High | Deferred (Post-ABC) |
| Profile Updates | High | Deferred (Post-ABC) |
| Collaboration Messaging | High | Deferred (Post-ABC) |
| Profile Gallery | Medium | Deferred (Post-ABC) |
| Embedded Media | Medium | Deferred (Post-ABC) |

---

*Last updated: January 2026*
