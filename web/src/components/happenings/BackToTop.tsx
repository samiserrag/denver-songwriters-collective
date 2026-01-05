"use client";

/**
 * BackToTop - Floating button for quick navigation to top of page
 *
 * Phase 4.38: Added as replacement for sticky filter behavior
 * - Appears when user scrolls down past a threshold
 * - Smooth scroll to top on click
 * - Works on desktop and mobile
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BackToTopProps {
  /** Scroll threshold in pixels before button appears (default: 400) */
  threshold?: number;
  className?: string;
}

export function BackToTop({ threshold = 400, className }: BackToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    // Check initial position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex items-center justify-center",
        "w-12 h-12 rounded-full",
        "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-200",
        "hover:scale-105 active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2",
        className
      )}
      aria-label="Back to top"
      title="Back to top"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 15l7-7 7 7"
        />
      </svg>
    </button>
  );
}

export default BackToTop;
