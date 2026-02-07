# Active Backlog (Post GTM-3.1)

> **Created:** February 2026
> **Purpose:** Capture high-priority product and UX backlog items discussed but not yet documented.
> **Scope:** Non-email, non-GTM-3.1 items only.

---

## Backlog Items

### 1. Homepage vs Happenings "Tonight" List Consistency

**Problem Statement:**
The "Tonight's Happenings" section on the homepage does not always match the events shown on the `/happenings` page when filtered by the same time window. Users may see different events depending on which surface they visit.

**Affected Surfaces:**
- Homepage (`app/page.tsx`) — "Tonight's Happenings" section
- Happenings page (`app/happenings/page.tsx`) — Timeline view with date filters

**Why It Matters:**
- **User trust:** Inconsistent results across surfaces erodes confidence in the platform's accuracy
- **Confusion:** Users may wonder why an event appears in one place but not another
- **Data integrity perception:** Even if both queries are technically correct, divergence feels like a bug

**Status:** Unstarted / Needs Investigation

**Notes:**
Requires audit of filtering logic, time window calculations, occurrence expansion, and query differences between the two surfaces.

---

### 2. Mobile Event Card Truncation & Metadata Loss

**Problem Statement:**
On mobile devices, event cards may truncate or entirely omit secondary metadata such as city, state, venue details, and signup information. Card height and layout constraints on small screens cause information loss.

**Affected Surfaces:**
- HappeningCard (`components/happenings/HappeningCard.tsx`)
- SeriesCard (`components/happenings/SeriesCard.tsx`)
- Homepage event sections
- Any card-based event display on viewports < 768px

**Why It Matters:**
- **Primary device class:** Mobile is the dominant access method for many users
- **Discoverability:** Missing location info makes it harder to find relevant local events
- **Usability regression:** Information that appears on desktop should be accessible on mobile

**Status:** Unstarted / Needs Investigation

**Notes:**
Requires responsive design audit of card components. May need layout adjustments, font sizing review, or progressive disclosure patterns for constrained viewports.

---

### 3. Cross-Surface Consistency Rules

**Problem Statement:**
The same entities (events, venues, members) render differently across various surfaces with no explicit consistency rules documented. This leads to fragmented UX and makes regressions harder to detect.

**Affected Surfaces:**
- Homepage sections
- Happenings page (Timeline, Series, Map views)
- Email digest (weekly happenings)
- Admin preview/send UI
- Event detail pages
- Mobile vs desktop variants of all above

**Why It Matters:**
- **Fragmented UX:** Users experience the same data presented inconsistently
- **Regression risk:** Changes to one surface may not propagate to others
- **Maintenance burden:** No single source of truth for "how should an event card look"
- **Testing gaps:** Hard to write comprehensive tests without explicit contracts

**Status:** Unstarted / Needs Investigation

**Notes:**
May require creating a cross-surface consistency contract document that defines:
- Required fields per entity type per surface
- Fallback behavior when data is missing
- Visual hierarchy rules (what shows first, what can be truncated)

---

### 4. Community Invite / Referral Growth Loop

**Problem Statement:**
Growth currently depends on passive discovery. Members need a direct, low-friction way to invite songwriter and open-mic friends and attribute signups back to the referral source.

**Phase Split (Approved):**
- **Phase 7B.1 (current):** Share-first (copy link, `mailto:`, native share, attribution capture)
- **Phase 7B.2 (future):** Managed invite email (server-sent), separate STOP-GATE required

**Priority:** **P1 Growth Infrastructure**

**Status:** In Progress (Phase 7B.1 execution)

**Guardrails:**
- No server-sent invite emails in 7B.1
- Referral params must be persisted and queryable
- Digest + site CTA copy should remain consistent
- Embeds remain a separate tract

---

## Explicitly Out of Scope

The following items are **not part of this backlog** and should not be reopened:

1. **GTM-3.1 Email Digest functionality** — CLOSED and COMPLETE as of February 2026
2. **Editorial URL resolution** — Resolved in Phase 5-17/5-18
3. **Featured ordering and formatting** — Resolved in Phase 5-18
4. **Newsletter unsubscribe flow** — Resolved in GTM-3

No email-related backlog remains unless explicitly reopened by a future GTM phase with new scope.

For GTM-3.1 closure details, see:
- `docs/investigation/phase5-18-gtm-3-1-email-featured-section-and-formatting-stopgate.md`
- `docs/gtm/gtm-3-editorial-and-newsletter-unsubscribe-investigation.md`
- `CLAUDE.md` → "GTM-3.1 Documentation Closeout (February 2026)"

---

## Cross-References

- **UX Principles:** `docs/DSC_UX_PRINCIPLES.md`
- **Product Philosophy:** `docs/PRODUCT_NORTH_STAR.md`
- **Deferred Backlog:** `CLAUDE.md` → "Deferred Backlog" section
- **GTM History:** `docs/gtm/` directory

---

*This document captures backlog items for future investigation. It does not propose solutions or make architectural decisions.*
