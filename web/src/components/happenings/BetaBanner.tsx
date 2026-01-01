"use client";

/**
 * BetaBanner - Dismissible beta warning banner
 *
 * Phase 4.19: Refined beta banner
 * - Prominent but not huge
 * - Dismissible per session (localStorage)
 * - One-liner with optional "Learn more"
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface BetaBannerProps {
  className?: string;
}

const STORAGE_KEY = "dsc-beta-banner-dismissed";

export function BetaBanner({ className }: BetaBannerProps) {
  const [isDismissed, setIsDismissed] = React.useState(true); // Start hidden to avoid flash

  React.useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(STORAGE_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 rounded-lg",
        "bg-amber-500/10 border border-amber-500/30",
        className
      )}
    >
      <p className="text-sm text-amber-200">
        <strong className="text-amber-100">Beta:</strong> Schedules are community-submitted. Please verify with venues.
      </p>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-amber-400 hover:text-amber-300 transition-colors text-sm"
        aria-label="Dismiss beta notice"
      >
        Dismiss
      </button>
    </div>
  );
}

export default BetaBanner;
