"use client";

/**
 * StickyControls - Filter and jump control area
 *
 * Phase 4.19: Originally sticky, sticking below nav (top-16 = 64px)
 * Phase 4.21: Added showCancelled toggle for displaying cancelled occurrences
 * Phase 4.38: Removed sticky behavior - filters now scroll with content
 *             Added BackToTop floating button for quick navigation
 * Phase 4.54: Added view toggle (Timeline / Series)
 */

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { HappeningsFilters } from "./HappeningsFilters";
import { DateJumpControl } from "./DateJumpControl";

export type HappeningsViewMode = "timeline" | "series";

interface StickyControlsProps {
  todayKey: string;
  windowStartKey: string;
  windowEndKey: string;
  timeFilter: string;
  cancelledCount?: number;
  viewMode?: HappeningsViewMode;
  className?: string;
}

export function StickyControls({ todayKey, windowStartKey, windowEndKey, timeFilter, cancelledCount = 0, viewMode = "timeline", className }: StickyControlsProps) {
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

  // Phase 4.54: Toggle view mode
  const setViewMode = (mode: HappeningsViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "timeline") {
      params.delete("view"); // timeline is default, no param needed
    } else {
      params.set("view", mode);
    }
    router.push(`/happenings?${params.toString()}`, { scroll: false });
  };

  return (
    <div
      className={cn(
        // Phase 4.38: Removed sticky positioning - filters scroll with content
        "py-3 space-y-3",
        className
      )}
    >
      {/* Filter bar */}
      <Suspense fallback={<div className="h-20 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />}>
        <HappeningsFilters />
      </Suspense>

      {/* Date Jump Control + View Toggle + Cancelled Toggle Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <DateJumpControl
            todayKey={todayKey}
            windowStartKey={windowStartKey}
            windowEndKey={windowEndKey}
            timeFilter={timeFilter}
          />
        </Suspense>

        {/* Phase 4.54: View Mode Toggle */}
        <div
          className="inline-flex rounded-lg border border-[var(--color-border-default)] overflow-hidden"
          role="group"
          aria-label="View mode"
        >
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "timeline"
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
            aria-pressed={viewMode === "timeline"}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode("series")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors border-l border-[var(--color-border-default)]",
              viewMode === "series"
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
            aria-pressed={viewMode === "series"}
          >
            Series
          </button>
        </div>

        {/* Phase 4.21: Show Cancelled Toggle - only show in timeline mode */}
        {viewMode === "timeline" && cancelledCount > 0 && (
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
