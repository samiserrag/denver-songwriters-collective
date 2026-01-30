"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe hook to detect mobile viewport.
 *
 * Returns false during SSR and initial hydration to prevent mismatches.
 * Uses useSyncExternalStore for efficient resize detection without cascading renders.
 *
 * @param breakpointPx - Viewport width threshold (default 768px, matches Tailwind md:)
 * @returns true if viewport width is less than breakpointPx
 */
export function useIsMobile(breakpointPx = 768): boolean {
  // Use useSyncExternalStore for efficient external state sync
  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") return () => {};

    const mediaQuery = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches;
  };

  // Server snapshot always returns false for hydration safety
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useIsMobile;
