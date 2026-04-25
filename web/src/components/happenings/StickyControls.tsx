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
        "py-3 space-y-4",
        className
      )}
    >
      <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Find a happening
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Search by who, where, when, or what kind of night you want.
            </p>
          </div>
          <Suspense fallback={<div className="h-12 rounded-lg bg-[var(--color-bg-secondary)]" />}>
            <ViewModeSelector viewMode={viewMode} className="lg:max-w-sm" />
          </Suspense>
        </div>

        {/* Filter bar: defer until mounted to preserve hydration safety */}
        {showFilters ? (
          <HappeningsFilters
            todayKey={todayKey}
            windowStartKey={windowStartKey}
            windowEndKey={windowEndKey}
            timeFilter={timeFilter}
          />
        ) : (
          <HappeningsFiltersShell />
        )}
      </section>

      {/* Phase 4.21: Show Cancelled Toggle - only show in timeline mode */}
      {viewMode === "timeline" && cancelledCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={toggleShowCancelled}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors self-start",
              showCancelled
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:border-red-500/30 hover:text-red-400"
            )}
            aria-pressed={showCancelled}
          >
            <span aria-hidden="true">
              {showCancelled ? "✕" : "○"}
            </span>
            {cancelledCount} cancelled
          </button>
        </div>
      )}
    </div>
  );
}

export default StickyControls;
