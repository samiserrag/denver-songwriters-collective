"use client";

/**
 * BetaBanner - Persistent beta warning banner
 *
 * Phase 4.20: Non-dismissible beta banner
 * - Prominent but not huge
 * - Always visible (no dismiss button, no localStorage)
 * - One-liner with clear community-submitted disclaimer
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface BetaBannerProps {
  className?: string;
}

export function BetaBanner({ className }: BetaBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        "bg-amber-500/10 border border-amber-500/30",
        className
      )}
    >
      <p className="text-sm text-amber-200">
        <strong className="text-amber-100">Beta:</strong> Schedules are community-submitted. Please verify with venues.
      </p>
    </div>
  );
}

export default BetaBanner;
