/**
 * Theme Configuration Exports
 *
 * Central barrel export for theme types and brand configurations.
 *
 * @example
 * import { denverSongwritersThemeTokens, cssVar } from '@/config';
 * const bgColor = cssVar(denverSongwritersThemeTokens.colors.background.primary);
 */

// Type definitions
export type {
  ThemeTokens,
  BackgroundTokens,
  TextTokens,
  AccentTokens,
  BorderTokens,
  RadiusTokens,
  ShadowTokens,
  CssVarName,
} from "./theme.types";

// Utilities
export { cssVar } from "./theme.types";

// Brand configurations
export { denverSongwritersThemeTokens } from "./brands/denver-songwriters";
