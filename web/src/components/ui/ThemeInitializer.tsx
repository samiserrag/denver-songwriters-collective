"use client";

import { useEffect } from "react";

interface ThemeInitializerProps {
  defaultTheme: string;
  defaultFont: string;
}

/**
 * Client component that handles localStorage overrides for theme/font.
 *
 * The SSR flow:
 * 1. Server fetches site_settings from database
 * 2. Server renders <html data-theme="..." data-font="..."> with site defaults
 * 3. This component runs on client and checks localStorage for user overrides
 * 4. If localStorage has a value, it updates the data attributes (local preview wins)
 * 5. If no localStorage value, the SSR-applied site default remains
 */
export function ThemeInitializer({ defaultTheme, defaultFont }: ThemeInitializerProps) {
  useEffect(() => {
    // Check localStorage for user's local preview override
    // Use same keys as ThemeSwitcher/FontSwitcher for consistency
    const localTheme = localStorage.getItem("dsc-theme");
    const localFont = localStorage.getItem("dsc-font");

    // Apply localStorage override if it exists, otherwise keep SSR default
    const themeToApply = localTheme || defaultTheme;
    const fontToApply = localFont || defaultFont;

    // Update the HTML element's data attributes
    if (themeToApply) {
      document.documentElement.setAttribute("data-theme", themeToApply);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    if (fontToApply) {
      document.documentElement.setAttribute("data-font", fontToApply);
    } else {
      document.documentElement.removeAttribute("data-font");
    }
  }, [defaultTheme, defaultFont]);

  // This component doesn't render anything visible
  return null;
}
