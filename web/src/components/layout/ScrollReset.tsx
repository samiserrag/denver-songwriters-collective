'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ScrollReset - Ensures pages load with scroll at the top
 *
 * Addresses browser scroll restoration behavior that can cause pages
 * to load scrolled down. This component:
 * 1. Disables browser's automatic scroll restoration
 * 2. Scrolls to top on initial mount (unless URL has a hash anchor)
 * 3. Scrolls to top on navigation (unless URL has a hash anchor)
 */
export function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    // Disable browser's automatic scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    // Don't scroll to top if URL has a hash anchor (e.g., #comments)
    if (window.location.hash) {
      return;
    }

    // Scroll to top on pathname change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
