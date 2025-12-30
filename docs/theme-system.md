# Theme System Style Guide

This document describes the CSS custom property (CSS variable) based theme system used throughout the Denver Songwriters Collective web application.

## Overview

The theme system uses CSS custom properties defined in two files:
- `web/src/app/globals.css` - Base token definitions (default theme)
- `web/src/app/themes/presets.css` - Theme preset overrides

Themes are applied via a `data-theme` attribute on the `<html>` element.

## Available Theme Presets

| Preset | Type | Description |
|--------|------|-------------|
| `default` | Dark | Original DSC gold accent on dark background |
| `sunset` | Light | Warm orange/amber tones on cream background |
| `night` | Dark | Warm gold accent on dark background |
| `ocean` | Light | Blue accent on light background |
| `forest` | Light | Green accent on light background |
| `rose` | Light | Red/pink accent on light background |
| `midnight` | Dark | Violet accent on dark background |
| `cyberpunk` | Dark | Teal/cyan accent on dark background |

## Color Tokens

### Background Colors

| Token | Usage |
|-------|-------|
| `--color-background` | Main page background |
| `--color-bg-surface` | Card/panel backgrounds |
| `--color-bg-surface-elevated` | Elevated surfaces (modals, dropdowns) |
| `--color-bg-hover` | Hover state backgrounds |
| `--color-bg-footer` | Footer background (stays dark on all themes) |
| `--color-bg-input` | Form input backgrounds |

### Text Colors

| Token | Usage |
|-------|-------|
| `--color-text-primary` | Primary body text |
| `--color-text-secondary` | Secondary/muted text |
| `--color-text-tertiary` | Tertiary/placeholder text |
| `--color-text-accent` | Accent-colored text (headings, links) |
| `--color-text-on-accent` | Text on accent-colored backgrounds |
| `--color-text-inverse` | Inverse text (light on dark or vice versa) |

### Accent Colors

| Token | Usage |
|-------|-------|
| `--color-accent-primary` | Primary accent color (buttons, highlights) |
| `--color-accent-hover` | Accent hover state |
| `--color-accent-muted` | Muted/subtle accent |

### Border Colors

| Token | Usage |
|-------|-------|
| `--color-border` | Default borders |
| `--color-border-accent` | Accent-colored borders |
| `--color-border-input` | Form input borders |

### Link Colors

| Token | Usage |
|-------|-------|
| `--color-link` | Default link color |
| `--color-link-hover` | Link hover color |

### Form Colors

| Token | Usage |
|-------|-------|
| `--color-bg-input` | Input background |
| `--color-border-input` | Input border |
| `--color-placeholder` | Placeholder text |

## Typography Tokens

| Token | Usage |
|-------|-------|
| `--font-family-sans` | Sans-serif body text (Lexend) |
| `--font-family-serif` | Serif headings (Playfair Display) |
| `--font-size-heading-xl` | Extra large headings |
| `--font-size-heading-lg` | Large headings |
| `--font-size-heading-md` | Medium headings |

## Card Surface Treatment (v2.0)

The `card-spotlight` class provides the premium card surface used by MemberCard and HappeningCard.

### Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 20px rgba(0, 0, 0, 0.25)` | Base card shadow |
| `--shadow-card-hover` | `0 8px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 216, 106, 0.1)` | Hover state with accent glow |

### Card Spotlight Class

Defined in `globals.css`:

```css
.card-spotlight {
  background: var(--color-bg-card-spotlight);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-2xl);
}

.card-spotlight:hover {
  border-color: var(--color-border-accent);
  box-shadow: var(--shadow-card-hover);
}
```

### Card Background Gradient

| Token | Description |
|-------|-------------|
| `--color-bg-card-spotlight` | Radial gradient from accent-muted at top to bg-primary |

Theme-specific overrides in `presets.css`:

| Theme | Gradient |
|-------|----------|
| `default` (dark) | Accent muted → bg-primary |
| `sunset` (light) | Orange 0.08 opacity → white |
| `night` (dark) | Accent muted → bg-primary |

### Usage

```tsx
// ✅ Correct - use card-spotlight for premium cards
<article className="card-spotlight p-5">
  <h3>Card Title</h3>
</article>

// With hover transition
<article className="card-spotlight transition-all duration-200 ease-out hover:shadow-md">
  ...
</article>
```

### Related Components

- `MemberCard` - Reference implementation for card surface
- `HappeningCard` - Uses same surface treatment for event cards

---

## Visual Language & Scanning System (v2.0)

> **Enforceable contract:** See [docs/CONTRACTS.md](./CONTRACTS.md) §Contract: Pill Hierarchy & Scan Signals for testable rules.

### Purpose

This section defines the visual scanning system for event discovery.
It exists to prevent information overload, color noise, and ambiguous hierarchy across light and dark themes.

**This is not a styling suggestion. It is a contract.**

### Scan-First, Image-Forward (Clarified)

Scan-first does not mean text-only.

Scan-first means:

- A user can understand what an event is, when it happens, and whether it's reliable in under 5 seconds.
- Visual pattern recognition (image + badges) is used to reduce reading burden.
- Text remains the source of truth for decisions.

**Images anchor attention. Text confirms decisions.**

### Pill System (Hierarchical, Limited)

Pills are used only for categorical signals that benefit from visual chunking.

**Not all information should be pill-shaped.**

#### Tier 1 — Primary Signal Pills (Max 1–2 per card)

**Purpose:** Urgency, trust, or sponsorship

**Examples:** `TONIGHT`, `THIS WEEK`, `FREE`, `DSC`

**Rules:**

- Filled pills
- Accent-muted backgrounds
- High-contrast text
- Token-based colors only
- Must remain readable in Sunrise and Night themes

These pills may attract attention. Everything else must defer to them.

#### Tier 2 — Recurrence & Pattern Pills (Always Visible)

**Purpose:** Habit formation and predictability

**Examples:** `Every Monday`, `Weekly`, `First Monday of the Month`, `Third Thursday`, `One-time`

**Rules:**

- Always visible on the card
- Neutral or soft-fill appearance
- No bright accent colors
- Same visual weight as metadata, not CTAs

**Recurrence must never be hidden in details. Patterns are part of scan-first clarity.**

#### Tier 3 — Type & Context Pills (De-emphasized)

**Purpose:** Categorization without distraction

**Examples:** `Open Mic`, `Showcase`, `Workshop`, `18+`

**Rules:**

- Small
- Muted border or low-contrast fill
- No accent colors
- May collapse or truncate on mobile

These pills must never overpower title, date, or recurrence.

### What Must Not Be Pills

The following information must remain plain text to avoid noise:

- Time
- Venue / Location
- Cost (except `FREE` as Tier 1)
- Signup details
- Notes or disclaimers

**Pills are for categories, not raw data.**

### Always-Visible Information Rule

The following fields must always be present on event cards:

| Field | Requirement |
|-------|-------------|
| Date | Badge or overlay |
| Time | Show time or `NA` if missing |
| Venue | Show venue or `NA` if missing |
| Cost | `Free` or `NA` |
| Recurrence | Tier 2 pill |
| Event type | Tier 3 pill |
| Image | User, derived, or default placeholder |

**Missing information must render as labeled `NA`, never silently hidden.**

### Color & Theme Safety

- All pill colors must use tokens, never hardcoded values
- Only Tier 1 pills may use accent color families
- All other pills must remain neutral in both light and dark themes
- Orange / red text must never sit directly on light backgrounds

**Filled pills must never inherit text color. Foreground contrast is explicit and token-driven to prevent theme washout.**

**Accessibility and legibility override visual flair.**

### Global Contrast Rule (Phase 4.8.1)

**NEVER use hardcoded `text-white` on accent-colored backgrounds.**

This causes contrast failures across themes:
- ❌ `text-white` on gold (Night theme) = unreadable
- ❌ `text-white` may work on orange (Sunrise) but is not future-proof

**Always use theme-aware tokens:**

```tsx
// ✅ CORRECT - Use utility class
<button className="btn-accent">Submit</button>

// ✅ CORRECT - Use token directly
<button className="bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]">
  Submit
</button>

// ❌ WRONG - Hardcoded white fails on some themes
<button className="bg-[var(--color-accent-primary)] text-white">
  Submit
</button>
```

**Available utility classes (defined in globals.css):**

| Class | Background | Text | Use Case |
|-------|------------|------|----------|
| `.btn-accent` | `--color-accent-primary` | `--color-text-on-accent` | Primary CTA buttons |
| `.btn-accent-muted` | `--color-accent-muted` | `--color-text-accent` | Subtle accent buttons |
| `.btn-secondary` | `--color-bg-secondary` | `--color-text-secondary` | Secondary actions |

**Token values by theme:**

| Theme | `--color-text-on-accent` | Rationale |
|-------|--------------------------|-----------|
| Default (dark) | `#0F172A` (dark slate) | Dark text on gold |
| Night (dark) | `#0F172A` (dark slate) | Dark text on gold |
| Sunrise (light) | `#7C2D12` (orange-900) | Dark text on orange for WCAG AA |

**Pill-specific tokens:**

| Token | Sunrise (light) | Night (dark) | Purpose |
|-------|-----------------|--------------|---------|
| `--pill-bg-accent` | `rgba(249,115,22,0.25)` | `rgba(246,193,119,0.3)` | Tier 1 background |
| `--pill-fg-on-accent` | `#7C2D12` | `#0F172A` | Tier 1 text (dark on accent) |
| `--pill-fg-on-muted` | `#3F3F46` | `#CBD5E1` | Tier 2 text |
| `--pill-fg-on-neutral` | `#52525B` | `#94A3B8` | Tier 3 text |
| `--pill-bg-warning` | `rgba(245,158,11,0.15)` | `rgba(251,191,36,0.2)` | Warning background |
| `--pill-fg-warning` | `#92400E` | `#FCD34D` | Warning text |
| `--pill-border-warning` | `rgba(245,158,11,0.25)` | `rgba(251,191,36,0.35)` | Warning border |

### Sunrise Contrast Tuning (Phase 4.9)

Sunrise secondary/tertiary text and border tokens are tuned for legibility on light backgrounds.
Adjust tokens in `presets.css`, not components. Current values use zinc palette (cooler, higher contrast)
instead of stone (warmer, lower contrast).

### Design Reference

MemberCard is the reference implementation for:

- Pill density
- Shadow hierarchy
- Hover behavior

Event cards must feel visually related, not stylistically separate.

### Non-Goals (Explicit)

- Pills are not buttons
- Pills are not filters
- Pills are not CTAs
- Cards must not become color-heavy or "badge soup"

### Status

**Locked for v2.0**

Any changes to this system require:

1. `docs/PRODUCT_NORTH_STAR.md` update
2. `docs/CONTRACTS.md` update
3. Explicit rationale

> For enforceable pill hierarchy and missing data contracts, see [docs/CONTRACTS.md](./CONTRACTS.md).

### Why This Matters

Earlier text-only event rows failed the legitimacy test in user feedback.

This system exists to ensure events feel real, repeatable, and trustworthy at a glance — without sacrificing clarity.

---

## Usage Guidelines

### DO Use CSS Variables

```tsx
// ✅ Correct - uses theme tokens
<h1 className="text-[var(--color-text-accent)]">Welcome</h1>
<button className="bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]">
  Click Me
</button>
<input className="bg-[var(--color-bg-input)] border-[var(--color-border-input)]" />
```

### DON'T Use Hardcoded Colors

```tsx
// ❌ Incorrect - hardcoded colors don't adapt to themes
<h1 className="text-amber-400">Welcome</h1>
<button className="bg-gold-400 text-black">Click Me</button>
<input className="bg-neutral-800 border-neutral-600" />
```

### Intentional Exceptions

Some hardcoded colors are acceptable:

1. **Brand-specific buttons** (Spotify, PayPal, Venmo) - use brand colors
2. **SVG icons** - typically `text-white` or `currentColor`
3. **Status badges** - semantic colors (red=error, green=success, amber=warning)
4. **Light modal surfaces** - intentional light backgrounds in dark themes

## Adding a New Theme

1. Add a new `[data-theme="your-theme"]` block in `presets.css`
2. Define all required color tokens
3. Add the theme to `ThemeSwitcher.tsx`
4. Test on both light and dark base themes

### Example Theme Definition

```css
[data-theme="your-theme"] {
  /* Backgrounds */
  --color-background: #ffffff;
  --color-bg-surface: #f8fafc;
  --color-bg-surface-elevated: #ffffff;
  --color-bg-hover: #f1f5f9;
  --color-bg-footer: #0a0a0a;
  --color-bg-input: #ffffff;

  /* Text */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #64748b;
  --color-text-accent: #your-accent-dark;
  --color-text-on-accent: #ffffff;
  --color-text-inverse: #ffffff;

  /* Accent */
  --color-accent-primary: #your-accent;
  --color-accent-hover: #your-accent-dark;
  --color-accent-muted: #your-accent-light;

  /* Borders */
  --color-border: #e2e8f0;
  --color-border-accent: #your-accent;
  --color-border-input: #cbd5e1;

  /* Links */
  --color-link: #your-accent;
  --color-link-hover: #your-accent-dark;

  /* Placeholder */
  --color-placeholder: #94a3b8;
}
```

## WCAG Contrast Requirements

- **Text on background:** Minimum 4.5:1 contrast ratio
- **Large text on background:** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio

For light themes, ensure `--color-text-accent` is dark enough (e.g., use `-700` or `-800` shade instead of `-400`).

## Migration Notes

The following deprecated patterns have been removed:

- `text-gradient-gold` class → use `text-[var(--color-text-accent)]`
- `dark:` variants → removed (no `.dark` class applied)
- Direct `--color-gold-*` references → use accent tokens
- `web/src/lib/fonts.ts` → fonts defined in layout.tsx

## Related Files

- `web/src/app/globals.css` - Base CSS variables
- `web/src/app/themes/presets.css` - Theme presets
- `web/src/components/ui/ThemeSwitcher.tsx` - Theme selector component
- `web/src/app/style-guide/page.tsx` - Visual style guide page
