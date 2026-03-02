"use client";

/**
 * StickyControls - Filter and jump control area
 *
 * Phase 4.19: Originally sticky, sticking below nav (top-16 = 64px)
 * Phase 4.21: Added showCancelled toggle for displaying cancelled occurrences
 * Phase 4.38: Removed sticky behavior - filters now scroll with content
 *             Added BackToTop floating button for quick navigation
 * Phase 4.54: Added view toggle (Timeline / Series)
 * Phase 4.55: Moved view toggle to ViewModeSelector component (hero-level cards)
 */

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { DateJumpControl } from "./DateJumpControl";
import { ViewModeSelector, type HappeningsViewMode } from "./ViewModeSelector";
import { HappeningsFilters } from "./HappeningsFilters";

/**
 * Hydration-safe placeholder rendered during SSR and the initial client frame.
 * We avoid rendering HappeningsFilters until mounted to prevent hydration
 * mismatch regressions, while using static imports to remove lazy-chunk flash.
 */
function HappeningsFiltersShell() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-14 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]" />
      <div className="h-12 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]" />
      <div className="h-12 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]" />
    </div>
  );
}

export type { HappeningsViewMode };

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
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    setShowFilters(true);
  }, []);

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
        // Phase 4.38: Removed sticky positioning - filters scroll with content
        "py-3 space-y-6",
        className
      )}
    >
      {/* Phase 4.55: Hero-level View Mode Selector */}
      <Suspense fallback={<div className="h-32 bg-[var(--color-bg-secondary)] rounded-2xl animate-pulse" />}>
        <ViewModeSelector viewMode={viewMode} />
      </Suspense>

      {/* Filter bar: defer until mounted to preserve hydration safety */}
      {showFilters ? <HappeningsFilters /> : <HappeningsFiltersShell />}

      {/* Date Jump Control + Cancelled Toggle Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}>
          <DateJumpControl
            todayKey={todayKey}
            windowStartKey={windowStartKey}
            windowEndKey={windowEndKey}
            timeFilter={timeFilter}
          />
        </Suspense>

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
