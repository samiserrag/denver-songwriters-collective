/**
 * Theme Token Types
 *
 * TypeScript documentation/validation layer for theme tokens.
 * Source of truth: web/src/app/globals.css (@theme block)
 *
 * These types mirror the CSS custom properties defined in globals.css.
 * Values are CSS variable names (strings), not actual color/size values.
 *
 * @see ARCHITECTURE_PLAN.md - Phase 1a/1b documentation
 */

// CSS variable name type (for documentation purposes)
export type CssVarName = `--${string}`;

/**
 * Background color tokens
 */
export interface BackgroundTokens {
  /** Main page background - --color-bg-primary */
  primary: CssVarName;
  /** Elevated surfaces (cards, modals) - --color-bg-secondary */
  secondary: CssVarName;
  /** Subtle differentiation - --color-bg-tertiary */
  tertiary: CssVarName;
  /** Contrast sections - --color-bg-inverse */
  inverse: CssVarName;
}

/**
 * Text color tokens
 */
export interface TextTokens {
  /** Main body text - --color-text-primary */
  primary: CssVarName;
  /** Subdued text - --color-text-secondary */
  secondary: CssVarName;
  /** Hints, placeholders - --color-text-tertiary */
  tertiary: CssVarName;
  /** Highlighted/accent text - --color-text-accent */
  accent: CssVarName;
}

/**
 * Accent/brand color tokens
 */
export interface AccentTokens {
  /** Main brand color - --color-accent-primary */
  primary: CssVarName;
  /** Hover state - --color-accent-hover */
  hover: CssVarName;
  /** Subtle accent backgrounds - --color-accent-muted */
  muted: CssVarName;
}

/**
 * Border color tokens
 */
export interface BorderTokens {
  /** Default border - --color-border-default */
  default: CssVarName;
  /** Subtle border - --color-border-subtle */
  subtle: CssVarName;
  /** Accent border - --color-border-accent */
  accent: CssVarName;
}

/**
 * Border radius tokens
 */
export interface RadiusTokens {
  /** 0.375rem - --radius-sm */
  sm: CssVarName;
  /** 0.5rem - --radius-md */
  md: CssVarName;
  /** 0.75rem - --radius-lg */
  lg: CssVarName;
  /** 1rem - --radius-xl */
  xl: CssVarName;
  /** 1.5rem - --radius-2xl */
  '2xl': CssVarName;
  /** 9999px - --radius-full */
  full: CssVarName;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  /** Small gold glow - --shadow-glow-gold-sm */
  glowGoldSm: CssVarName;
  /** Medium gold glow - --shadow-glow-gold */
  glowGold: CssVarName;
  /** Large gold glow - --shadow-glow-gold-lg */
  glowGoldLg: CssVarName;
  /** Card shadow - --shadow-card */
  card: CssVarName;
  /** Card hover shadow - --shadow-card-hover */
  cardHover: CssVarName;
}

/**
 * Complete theme token structure
 *
 * Maps to CSS custom properties in globals.css @theme block.
 * Use with `var(token.colors.background.primary)` pattern.
 */
export interface ThemeTokens {
  colors: {
    background: BackgroundTokens;
    text: TextTokens;
    accent: AccentTokens;
    border: BorderTokens;
  };
  radius: RadiusTokens;
  shadow: ShadowTokens;
}

/**
 * Helper to get CSS var() syntax from token
 * @example cssVar('--color-bg-primary') => 'var(--color-bg-primary)'
 */
export function cssVar(token: CssVarName): string {
  return `var(${token})`;
}
