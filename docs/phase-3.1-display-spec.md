# Phase 3.1 — Event Card & Detail Display Spec (LOCKED)

**Denver Songwriters Collective**

**Status:** FINAL DESIGN CONTRACT
**Applies to:** All event types (open mics, DSC events, user-created events)
**Scope:** UI / presentation only (schema already complete)

---

## 1. Purpose

Define a **scan-first, art-respecting, human-centered** event display system that:

* helps people decide in ~3 seconds
* never lies or assumes
* never forces creators to reformat art
* works on mobile, desktop, and TV
* avoids corporate sameness without devolving into chaos

---

## 2. Design Principles (LOCKED)

1. **Collapse by default — scan first, dive second**
2. **Cards feel like flyers — not SaaS rectangles**
3. **Information density is a feature — no wasted pixels**
4. **Typography is the personality engine**
5. **No deception — unknown is better than wrong**

---

## 3. Event Types Covered

This spec applies uniformly to:

* Generic open mics
* DSC open mics
* DSC events (showcases, workshops, song circles)
* User-created non-DSC events (gigs, meetups, etc.)

All creators get the same tools.
Customization is in **content**, not in breaking layout rules.

---

## 4. Always-Visible Fields (Card Level)

### 4.1 Open Mics (Generic + DSC)

Always visible on cards:

* Event title
* Venue name
* City, State
* Start time (AM / PM)
* **Signup mode**
  * In-person
  * Online
  * Both
* **Signup time**
  * Shown if in-person signup
* **Cost**
  * If `is_free = true` → "Free"
  * If `is_free = false` → `cost_label`
  * If `is_free = NULL` → show nothing
* Frequency + **next date**
* Verification status:
  * "Verified by host" (if claimed)
  * OR "Last verified: [date] by [admin/system]"

Optional (if available):

* Neighborhood (e.g., "Cap Hill")

---

### 4.2 Non-Open-Mic Events (DSC + User Events)

Always visible on cards:

* Event title
* Venue name **or** "Online"
* City, State
* Start time (AM / PM)
* Doors open time (if applicable)
* **Location mode** (venue / online / hybrid)
* **Cost** (same rules as above)
* **Signup / RSVP indicator**
* Frequency + **next date**
* Verification status

---

## 4.5 Null / Unknown Handling Contract (CRITICAL)

Fields with `NULL` values are **unknown**, not assumed.

| Field               | If NULL | Display                |
| ------------------- | ------- | ---------------------- |
| is_free             | Unknown | Show nothing           |
| cost_label          | Unknown | Show nothing           |
| signup_mode         | Unknown | Show nothing           |
| signup_time         | Unknown | Show nothing           |
| age_policy          | Unknown | "Check venue policies" |
| neighborhood        | Unknown | Show city only         |
| parking_notes       | Unknown | Omit section           |
| accessibility_notes | Unknown | Omit section           |

**Rule:**
Never show "TBD," "N/A," or filler text.
Silence is better than lying.

---

## 5. Age Policy Rules (LOCKED)

* **DSC events:**
  Always 18+.
  Shown on **detail pages and signup pages**.
* **Generic open mics / user events:**
  * If `age_policy` exists → show it
  * Else → "Check venue policies"
* No site-wide age enforcement yet.

> **Deferred (explicit):**
> One-time 18+ confirmation checkbox at account creation (future phase).

---

## 6. Poster / Image Rendering Contract (CRITICAL)

### Global Rule

**Users are never required to crop, resize, or redesign images. Ever.**

---

### 6.1 Cards (List View)

* Poster is **decorative**
* Bounded container
* `object-fit: contain`
* Letterboxing allowed
* Poster shrinks as needed to preserve card rhythm
* Card height controlled by text, not image

---

### 6.2 Detail Pages (Desktop + Mobile)

* Poster is **primary**
* Rendered full width
* Natural height (`height: auto`)
* No cropping
* No overlays
* No forced aspect ratio
* All text content renders **below** the poster

**Mental model:**
The poster invites. The text explains.

---

### 6.3 TV Display

* Poster hidden by default
* Text-only layout prioritized for distance readability
* Optional TV-specific image support may be added later
* No reliance on posters for essential information

---

## 7. Series & Recurrence Display

* Do **not** rely on weekday-only grouping
* Use **date-based lists**
* For series with online signup:
  * Show **up to 2 months** of future dates
  * Each date is its own signup target
* Avoid infinite / unbounded lists

---

## 8. Detail Page Content (Standardized)

Detail pages always include:

* Large event title
* Large date + start time
* Poster (per Section 6)
* Venue name + city/state
* Google Maps link
* Venue website link
* Venue phone number (or omitted if unknown)
* Host name (linked to DSC profile if available)
* Co-hosts (linked if available)
* Doors open time (for non-open mics)
* Time slot length (e.g., "15 min" or "Unknown")
* Description (public)
* **Accessibility notes** (if available)
* **Parking notes** (if available)
* **Online URL** (if online/hybrid)
* **Source badge** (community / venue / admin)
* Notes (hidden; admin/host only)

---

## 9. Host Claiming & Verification

* Hosts may **claim** generic events/open mics
* Claims require admin approval
* Once claimed:
  * Card shows **"Verified by host"**
  * No last-verified date required
  * Host is responsible for accuracy
* Unclaimed events show verification metadata

---

## 10. Anti-Patterns (DO NOT IMPLEMENT)

* ❌ Assuming free or all-ages
* ❌ Forcing poster cropping
* ❌ Corporate "everything looks the same" cards
* ❌ Hiding decision-critical info behind clicks
* ❌ Default values that misrepresent reality
* ❌ Designing only for desktop

---

## 11. Phase Boundaries

**This spec covers Phase 3.1 only.**

Out of scope:

* Ticketing systems
* Monetization logic
* TV poster optimization
* Age enforcement
* Analytics / marketing tools

---

## 12. Final Principle

> This platform exists to get people **out of their houses and into rooms together**.

If a choice improves clarity, trust, or real-world connection, it wins.
If it optimizes efficiency at the cost of humanity, it loses.
