/**
 * The Colorado Songwriters Collective Theme Token Map
 *
 * Maps TypeScript token references to CSS variable names.
 * Source of truth: web/src/app/globals.css (@theme block)
 *
 * @see ARCHITECTURE_PLAN.md - Phase 1b documentation
 */

import type { ThemeTokens } from "../../theme.types";

/**
 * The Colorado Songwriters Collective brand theme tokens
 *
 * All values are CSS variable names that reference the
 * semantic aliases defined in globals.css @theme block.
 */
export const denverSongwritersThemeTokens: ThemeTokens = {
  colors: {
    background: {
      primary: "--color-bg-primary",
      secondary: "--color-bg-secondary",
      tertiary: "--color-bg-tertiary",
      inverse: "--color-bg-inverse",
    },
    text: {
      primary: "--color-text-primary",
      secondary: "--color-text-secondary",
      tertiary: "--color-text-tertiary",
      accent: "--color-text-accent",
    },
    accent: {
      primary: "--color-accent-primary",
      hover: "--color-accent-hover",
      muted: "--color-accent-muted",
    },
    border: {
      default: "--color-border-default",
      subtle: "--color-border-subtle",
      accent: "--color-border-accent",
    },
  },
  radius: {
    sm: "--radius-sm",
    md: "--radius-md",
    lg: "--radius-lg",
    xl: "--radius-xl",
    "2xl": "--radius-2xl",
    full: "--radius-full",
  },
  shadow: {
    glowGoldSm: "--shadow-glow-gold-sm",
    glowGold: "--shadow-glow-gold",
    glowGoldLg: "--shadow-glow-gold-lg",
    card: "--shadow-card",
    cardHover: "--shadow-card-hover",
  },
};
