# Denver Songwriters Collective

## Product North Star & System Truths (Canonical)

**Status:** LOCKED (living document — changes require explicit version bump)  
**Version:** 1.0  
**Last Updated:** December 2025  
**Audience:** Humans, repo agents, browser agents, future contributors

> **This document is canonical. If something conflicts, this wins.**

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

---

## 3. UX North Star

### 3.1 What We Are Building

* A **music venue calendar**
* A **flyer wall**
* A **community bulletin board**

### 3.2 What We Are NOT Building

* ❌ SaaS dashboards
* ❌ CRM tables
* ❌ Admin-first layouts
* ❌ Engagement farming
* ❌ Popularity contests

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

### 6.1 Structural Rules

* **List-only**
* **Calendar-forward**
* **Scan-first**
* No grid
* No cards pretending to be posters

### 6.2 HappeningCard Contract (Canonical)

**Max:** 3 lines  
**Min:** 2 lines (edge case only)

#### Line 1 — Temporal Anchor

* Date is the loudest element
* `TONIGHT` / `TOMORROW` take priority over formatted date
* Title is secondary (semi-bold)
* `Details →` always present (right-aligned), unless ended

#### Line 2 — Decision Facts (Always Visible)

Order is fixed:

```
Time · Signup · Location · Cost · Age · ☆
```

| Field | If Present | If Missing |
|-------|------------|------------|
| Time | Show time range | Never missing |
| Signup | `Sign-up 6:30` | `Sign-up: NA` |
| Location | `Bar 404, Denver` | `Online` if online-only |
| Cost | `Free` or `$10` | `—` (em dash) |
| Age | `18+` or `21+` | Omit unless required |
| Favorite | `☆` | Always shown |

#### Line 3 — Context (Conditional)

* Event type (always shown, italic)
* `DSC Presents` if applicable
* Availability **only** if capacity-based

### 6.3 DSC Badge

* **Text:** `DSC Presents` (not "DSC" alone — that's jargon)
* **Meaning:** Provenance/curation, not branding
* **Style:** Italic, muted warm tone
* **Location:** Line 3 only

### 6.4 Temporal Emphasis (TONIGHT / TOMORROW)

| Condition | Date Text | Left Border | Text Color |
|-----------|-----------|-------------|------------|
| Today | `TONIGHT` | Warm gold (#c9a66b) | Warm gold (#c9a66b) |
| Tomorrow | `TOMORROW` | Warm gold (#c9a66b) | Warm gold (#c9a66b) |
| Future | `FRI JAN 10` | Warm tan (#d4a574) | Dark gray (#44403c) |
| Past | Formatted date | Muted tan | Muted |

**Rule:** No icons, no animations. Temporal emphasis is the *only* ambient "alive" signal.

### 6.5 Past Event Treatment

* `Details →` replaced with `Ended`
* Entire row at **0.7 opacity**
* Still clickable (for recap/history)
* No availability shown

### 6.6 Cost Display Rules

| Situation | Display |
|-----------|---------|
| Free event | `Free` |
| Paid event | `$10` (actual amount) |
| Unknown | `—` (em dash, not "TBD" or "NA") |

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

> Phase 4+: Show availability only (spots/slots remaining). No "X going"/popularity counts until we explicitly choose a social-proof direction.

---

## 8. Visual Balance Rules

### 8.1 Horizontal Balance

* Avoid "everything left, nothing center/right"
* Use the full width humans already have
* Visual weight should feel **intentional**, not accidental

### 8.2 Density

* Dense vertically is good
* Cramped horizontally is bad
* White space must *help reading*, not waste space

### 8.3 Card Visual Treatment

| Element | Value |
|---------|-------|
| Left border | 3px solid warm tan (#d4a574) |
| Left border (tonight/tomorrow) | 3px solid warm gold (#c9a66b) |
| Border radius | 0 10px 10px 0 |
| Hover background | Warm cream (#fef9f3) |
| Hover border | Warm gold (#c9a66b) |
| Hover transform | translateX(2px) |
| Page background | Warm off-white (#fffbf7) |

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

### Display Rules

| Field | If Missing |
|-------|------------|
| Signup time | `Sign-up: NA` |
| Cost | `—` |
| Age | Omit |
| Availability | Omit |
| Venue (online) | `Online` |

### Philosophy

* Show `NA` / `—` consistently for decision-critical fields
* Use "Missing details" as a **soft CTA** to encourage updates
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
5. Supporting docs (CONTRACTS.md, specs)

### Document Hierarchy

| Document | Purpose | Updates |
|----------|---------|---------|
| PRODUCT_NORTH_STAR.md | Philosophy & UX laws | Rarely |
| CLAUDE.md | Repo operations & file locations | Every push |
| CONTRACTS.md | Component contracts | When components change |
| Supporting docs | Historical/implementation detail | As needed |

---

## 14. Final Test

If the product ever feels like:

* A SaaS dashboard
* A CRM table
* An admin tool
* A growth experiment

…we have drifted.

**Re-center on:**

> "Would this feel good pinned to a coffee shop wall?"

---

**END — Canonical System Truth v1.0**
