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
