"use client";

/**
 * StickyControls - Sticky filter and jump control area
 *
 * Phase 4.19: Sticky control area that sticks after scrolling past nav
 * - Stays fixed below the nav (top-16 = 64px)
 * - Has blur/gradient background for readability
 *
 * Phase 4.21: Added showCancelled toggle for displaying cancelled occurrences
 */

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { HappeningsFilters } from "./HappeningsFilters";
import { DateJumpControl } from "./DateJumpControl";

interface StickyControlsProps {
  todayKey: string;
  windowEndKey: string;
  cancelledCount?: number;
  className?: string;
}

export function StickyControls({ todayKey, windowEndKey, cancelledCount = 0, className }: StickyControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCancelled = searchParams.get("showCancelled") === "1";

  // Toggle showCancelled URL param
  const toggleShowCancelled = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showCancelled) {
      params.delete("showCancelled");
    } else {
      params.set("showCancelled", "1");
    }
    router.push(`/happenings?${params.toString()}`, { scroll: false });
  };

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

      {/* Date Jump Control + Cancelled Toggle Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <DateJumpControl todayKey={todayKey} windowEndKey={windowEndKey} />
        </Suspense>

        {/* Phase 4.21: Show Cancelled Toggle */}
        {cancelledCount > 0 && (
          <button
            onClick={toggleShowCancelled}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              showCancelled
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:border-red-500/30 hover:text-red-400"
            )}
            aria-pressed={showCancelled}
          >
            <span className="text-xs">
              {showCancelled ? "✕" : "○"}
            </span>
            {cancelledCount} cancelled
          </button>
        )}
      </div>
    </div>
  );
}

export default StickyControls;
