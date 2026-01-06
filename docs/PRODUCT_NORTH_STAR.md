# Denver Songwriters Collective

## Product North Star & System Truths (Canonical)

**Status:** LOCKED (living document — changes require explicit version bump)
**Version:** 2.0
**Last Updated:** December 2025
**Audience:** Humans, repo agents, browser agents, future contributors

> **This document is canonical. If something conflicts, this wins.**

---

### Version History

| Version | Date | Summary |
|---------|------|---------|
| v1.x | Nov 2025 | Text-first, list-only event discovery |
| v2.0 | Dec 2025 | Image-forward, scan-first, poster-constrained cards |

**v2.0 Rationale:** Text-only rows failed the "legitimacy test" in user feedback and did not convey event quality, intent, or credibility at a glance. Poster-based cards give events presence and visual weight.

---

## 1. Purpose (Why DSC Exists)

Denver Songwriters Collective is a **real-world music community platform**, not a content feed and not a SaaS tool.

The product exists to answer, **at a glance**, for real humans:

* *Do I need to leave my house?*
* *Do I need money?*
* *Can I play, or just attend?*
* *Is this happening tonight?*
* *Is this welcoming and worth my time?*

If the UI fails to answer those in **5 seconds**, it has failed.

---

## 2. Non-Negotiable Product Philosophy

These are **system laws**, not preferences.

### 2.1 Completionist Standard

* No half measures
* Correctness before polish
* No silent failures
* No shipping known confusion "for later"

### 2.2 One Truth per Layer

* DB schema = source of truth
* API enforces invariants
* UI reflects reality, never guesses
* No duplicated logic across layers

### 2.3 Reality Beats Reasoning

* Browser verification > theoretical correctness
* Fonts, spacing, contrast must be verified in production
* Assumptions without UI proof are invalid

### 2.4 Stop-Gate Governance

* All non-trivial changes require investigation before execution
* Evidence required; speculation forbidden
* Sami approval required before any execution prompt
* Root-cause fixes only; no band-aids

See [docs/GOVERNANCE.md](./GOVERNANCE.md) for the full workflow.

---

## 3. UX North Star

### 3.1 What We Are Building

* A **music venue calendar**
* A **flyer wall**
* A **community bulletin board**

### 3.2 What We Are NOT Building

* SaaS dashboards
* CRM tables
* Admin-first layouts
* Engagement farming
* Popularity contests

---

## 4. Meetup.com as Baseline (Explicit)

Meetup's **current redesign** is the **UX benchmark**.

We assume:

* They A/B tested typography, spacing, and contrast extensively
* Their defaults are *proven* for accessibility and scannability

### Allowed deviations:

* Songwriter-specific language
* Timeslot booking
* TV display mode
* Warmer tone
* Less greed, more trust

### Disallowed deviations:

* Smaller fonts "for density"
* Excessive left alignment with empty space elsewhere
* Corporate SaaS visual patterns
* Over-clever minimalism

**Rule:**

> If Meetup solved a UX problem well, we borrow the solution unless we have a **clear, tested reason not to**.

---

## 5. Typography & Readability Rules (Hard Requirements)

### 5.1 Accessibility Baseline

* Assume **bad eyes**
* Assume **no glasses**
* Assume **glare**
* Assume **older musicians**

### 5.2 Font Size Minimums

| Content Type | Minimum Size |
|--------------|--------------|
| Primary anchors (date, title) | 16px |
| Secondary info (time, venue, cost) | 14px |
| Tertiary info (type, badges) | 14px |
| Helper text (forms only) | 12px |

**Rule:** Nothing below 14px in discovery views. Ever.

### 5.3 Contrast

* All text must pass **WCAG AA** in:
  * Night theme
  * Sunrise / light theme
* No low-contrast "aesthetic" text
* Decorative subtlety must never reduce legibility

---

## 6. Event Discovery: `/happenings`

### 6.1 Structural Rules (v2.0)

> **DEPRECATED (v1):** "List-only", "No grid", "No cards pretending to be posters"
> These principles are retired as of v2.0.

**v2.0 Principles:**

* **Scan-first, not text-first** — Images communicate faster than text
* **Posters are mandatory media** — Constrained into cards for fast visual parsing
* **Grid layouts are permitted** — Only when cards are image-forward and aspect-constrained
* **MemberCard is the reference quality bar** — Surface, shadow, density

For the normative visual scanning and pill hierarchy system, see `docs/theme-system.md`.

### 6.2 Scan Order (v2.0)

Users scan event cards in this order:

1. **Poster image** — Visual anchor, legitimacy signal
2. **Event title** — What is this?
3. **Date / time** — When is this?
4. **Event type indicators** — Open mic? Showcase? DSC event?

Text-only metadata (venue, cost, age) is supporting context, not primary.

### 6.3 HappeningCard Contract (v2.0)

> **Enforceable contract:** See [docs/CONTRACTS.md](./CONTRACTS.md) §Card Components for testable rules.

**Layout:** Vertical poster card (not horizontal row)

**Structure:**
* **Top:** 4:3 aspect poster media with overlays (date badge, favorite star, status)
* **Bottom:** Content stack (title, meta line, chips)

**Poster Tiers:**
1. `cover_image_card_url` — Optimized 4:3 thumbnail (object-cover)
2. `cover_image_url` — Full poster with blurred background (object-contain)
3. Gradient placeholder with music note icon (designed, not empty)

**Grid Layout:**
* Mobile: 1 column
* Tablet (md): 2 columns
* Desktop (lg): 3 columns

### 6.4 Decision Facts (Always Visible)

Order is fixed in meta line:

```
Time · Venue · Cost
```

| Field | If Present | If Missing |
|-------|------------|------------|
| Time | Show time | `NA` |
| Venue | Venue name | `Online` if online-only, `NA` otherwise |
| Cost | `Free` or `$10` | `NA` |

### 6.5 Chips Row

Event type, age, signup, DSC badge, availability — as pills below meta line.

| Field | Display |
|-------|---------|
| Event type | Always shown |
| Age | `18+` or `21+` when applicable |
| Signup | `Sign-up: 6:30 PM` or `Sign-up: Online` when applicable |
| DSC | `DSC` chip for DSC events |
| Availability | `40 spots` when capacity-based |
| Missing details | Warning badge (not underlined link) |

### 6.6 DSC Badge

* **Text:** `DSC` (chip format)
* **Meaning:** Provenance/curation, not branding
* **Style:** Accent-muted background, text-primary

### 6.7 Temporal Emphasis (TONIGHT / TOMORROW)

Date badge overlay on poster:

| Condition | Badge Text | Badge Color |
|-----------|------------|-------------|
| Today | `TONIGHT` | Accent primary |
| Tomorrow | `TOMORROW` | Accent primary |
| Future | `SAT JAN 10` | White |
| Past | Formatted date | White/muted |

**Rule:** No icons, no animations. Temporal emphasis through color and position.

### 6.8 Past Event Treatment

* Status badge: `Ended`
* Entire card at **0.7 opacity**
* Still clickable (for recap/history)
* No availability shown

### 6.9 Cost Display Rules

| Situation | Display |
|-----------|---------|
| Free event | `Free` |
| Paid event | `$10` (actual amount) |
| Unknown | `NA` |

---

## 6.10 Recurrence & Real-World Flexibility

Recurring events are modeled as single canonical records.
Individual dates are derived at render time within a rolling window.

Real-world exceptions (cancellations, special nights, alternate flyers)
are handled via per-occurrence overrides, not by duplicating events.

This preserves:
- Scan-first clarity
- Accurate future listings
- Efficient editing of recurring series
- Human flexibility without data corruption

---

## 7. Availability vs Social Proof (Locked)

### Allowed:

* `4 spots available`
* `2 slots open`

### Forbidden:

* "12 going"
* Popularity badges
* Avatars
* Engagement metrics
* "Trending"

**Why:**
Scarcity helps decisions. Popularity games destroy trust.

**Lock statement:**

> Show availability only (spots/slots remaining). No "X going"/popularity counts until we explicitly choose a social-proof direction.

---

## 8. Visual Balance Rules

### 8.1 Horizontal Balance

* Grid layout uses full width
* Cards fill available space proportionally
* Visual weight feels **intentional**, not accidental

### 8.2 Density

* Dense vertically is good
* Cramped horizontally is bad
* White space must *help reading*, not waste space

### 8.3 Card Visual Treatment (v2.0)

| Element | Value |
|---------|-------|
| Surface class | `card-spotlight` |
| Shadow (base) | `--shadow-card` |
| Shadow (hover) | `--shadow-card-hover` |
| Border radius | `var(--radius-2xl)` via card-spotlight |
| Poster aspect | 4:3 |
| Poster hover | `scale-[1.02]` (subtle zoom) |
| Border accent | Tonight/Tomorrow get accent border |

> **Implementation note:** All card implementations must use the `card-spotlight` class for consistent surface treatment across themes.

---

## 9. Event Creation UX (Everyone, Not Just Admins)

### 9.1 Mental Model Clarity

Users must immediately understand:

* RSVP vs Timeslot
* Why each exists
* When to choose which

No hidden toggles. No implied behavior.

### 9.2 Required vs Optional

* Every required field marked with asterisk (*)
* Optional fields explicitly labeled "(optional)"
* No guessing

### 9.3 Live Preview (Required)

Event creation must show:

* **Card preview** (how it appears on /happenings)
* **Detail header preview** (title, date, location)

This prevents:

* Surprise layouts
* Misconfigured events
* Admin cleanup later

---

## 10. Missing Data as a Feature

Missing info is not hidden.

> **Enforceable contract:** See [docs/CONTRACTS.md](./CONTRACTS.md) §Contract: Missing Data Rendering for testable rules. The standard missing value is **NA**.

### Display Rules

| Field | If Missing |
|-------|------------|
| Time | `NA` |
| Venue | `NA` |
| Cost | `NA` |
| Age | Omit |
| Availability | Omit |
| Venue (online) | `Online` |
| Critical fields | Warning badge: "Missing details" |

### Philosophy

* Show `NA` consistently for decision-critical fields
* Use "Missing details" badge as a **visual indicator** for incomplete events
* Transparency > polish
* Community repair > admin cleanup

---

## 11. Identity & Trust

* No gatekeeping
* One person can be:
  * Songwriter
  * Host
  * Studio
  * Fan
* **Roles** = authorization (member, admin)
* **Identity flags** = discovery (songwriter, host, studio)

Never mix them again.

---

## 12. Copy & Tone

**DSC sounds like:**

* A calm host
* A friendly stage manager
* Someone who's done this before and isn't stressed

**DSC does NOT sound like:**

* A startup pitch
* A corporate platform
* A hype machine

**Rule:**

> Write like a calm, friendly host who wants people to show up this week — not like a brand trying to impress them.

See `docs/copy-tone-guide.md` for full guidelines.

---

## 13. Agents & Documentation Alignment

### Canonical Order of Truth

1. **This document** (PRODUCT_NORTH_STAR.md)
2. Database schema
3. API invariants
4. Production UI (browser-verified)
5. Supporting docs (`docs/CONTRACTS.md`, specs)

### Document Hierarchy

| Document | Purpose | Updates |
|----------|---------|---------|
| `docs/PRODUCT_NORTH_STAR.md` | Philosophy & UX laws | Rarely |
| `CLAUDE.md` | Repo operations & file locations | Every push |
| `docs/CONTRACTS.md` | Enforceable UI/data contracts | When components change |
| `docs/theme-system.md` | Tokens & visual system | When styling changes |
| Supporting docs | Historical/implementation detail | As needed |

> For enforceable UI contracts, see [docs/CONTRACTS.md](./CONTRACTS.md).

---

## 14. Final Test

If the product ever feels like:

* A SaaS dashboard
* A CRM table
* An admin tool
* A growth experiment

...we have drifted.

**Re-center on:**

> "Would this feel good pinned to a coffee shop wall?"

---

**END — Canonical System Truth v2.0**
