"use client";

/**
 * StickyControls - Sticky filter and jump control area
 *
 * Phase 4.19: Sticky control area that sticks after scrolling past nav
 * - Stays fixed below the nav (top-16 = 64px)
 * - Has blur/gradient background for readability
 */

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { HappeningsFilters } from "./HappeningsFilters";
import { DateJumpControl } from "./DateJumpControl";

interface StickyControlsProps {
  todayKey: string;
  windowEndKey: string;
  className?: string;
}

export function StickyControls({ todayKey, windowEndKey, className }: StickyControlsProps) {
  return (
    <div
      className={cn(
        "sticky top-16 z-40 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        "bg-[var(--color-bg-primary)]/95 backdrop-blur-md",
        "border-b border-[var(--color-border-default)]",
        "py-3 space-y-3",
        className
      )}
    >
      {/* Filter bar */}
      <Suspense fallback={<div className="h-20 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />}>
        <HappeningsFilters />
      </Suspense>

      {/* Date Jump Control */}
      <Suspense fallback={null}>
        <DateJumpControl todayKey={todayKey} windowEndKey={windowEndKey} />
      </Suspense>
    </div>
  );
}

export default StickyControls;
