'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ScrollReset - Ensures fresh page loads start at the top while preserving
 * back/forward navigation scroll positions.
 *
 * Behavior:
 * - Fresh navigation (clicking links): Scrolls to top
 * - Back/forward buttons: Restores previous scroll position
 * - Hash anchors (e.g., #comments): Browser handles natively
 */
export function ScrollReset() {
  const pathname = usePathname();
  const isPopState = useRef(false);

  useEffect(() => {
    // Track back/forward navigation via popstate event
    const handlePopState = () => {
      isPopState.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // Don't scroll to top if URL has a hash anchor (e.g., #comments)
    if (window.location.hash) {
      isPopState.current = false;
      return;
    }

    // Don't scroll to top on back/forward navigation - let browser restore position
    if (isPopState.current) {
      isPopState.current = false;
      return;
    }

    // Fresh navigation: scroll to top
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
