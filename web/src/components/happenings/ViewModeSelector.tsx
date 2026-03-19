"use client";

/**
 * ViewModeSelector - Hero-level view mode chooser
 *
 * Phase 4.55: Replaces the small Timeline/Series toggle with
 * prominent visual cards that make the view mode selection
 * the star feature of the happenings page.
 *
 * Phase 1.0: Added Map view mode for geographic discovery.
 *
 * Design inspiration: MemberCard's card-spotlight styling,
 * radial gradients, gold accents for warmth.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type HappeningsViewMode = "timeline" | "series" | "map";

interface ViewModeSelectorProps {
  viewMode: HappeningsViewMode;
  className?: string;
}

export function ViewModeSelector({ viewMode, className }: ViewModeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    <div className={cn("space-y-3", className)}>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        How would you like to browse?
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Timeline Card */}
        <button
          onClick={() => setViewMode("timeline")}
          className={cn(
            "relative p-6 rounded-2xl text-left transition-all duration-300",
            "border-2",
            viewMode === "timeline"
              ? "card-spotlight border-[var(--color-accent-primary)] shadow-[var(--shadow-card-hover)]"
              : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)]/50 hover:shadow-[var(--shadow-card)]"
          )}
          aria-pressed={viewMode === "timeline"}
        >
          {/* Active indicator glow */}
          {viewMode === "timeline" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent pointer-events-none" />
          )}

          <div className="relative z-10 flex flex-col gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                viewMode === "timeline"
                  ? "bg-[var(--color-accent-primary)]"
                  : "bg-[var(--color-bg-tertiary)]"
              )}
            >
              📅
            </div>

            <div>
              <h3
                className={cn(
                  "text-lg font-bold",
                  viewMode === "timeline"
                    ? "text-[var(--color-text-accent)]"
                    : "text-[var(--color-text-primary)]"
                )}
              >
                Timeline
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                See what&apos;s happening each day this week and beyond
              </p>
            </div>
          </div>
        </button>

        {/* Series Card */}
        <button
          onClick={() => setViewMode("series")}
          className={cn(
            "relative p-6 rounded-2xl text-left transition-all duration-300",
            "border-2",
            viewMode === "series"
              ? "card-spotlight border-[var(--color-accent-primary)] shadow-[var(--shadow-card-hover)]"
              : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)]/50 hover:shadow-[var(--shadow-card)]"
          )}
          aria-pressed={viewMode === "series"}
        >
          {/* Active indicator glow */}
          {viewMode === "series" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent pointer-events-none" />
          )}

          <div className="relative z-10 flex flex-col gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                viewMode === "series"
                  ? "bg-[var(--color-accent-primary)]"
                  : "bg-[var(--color-bg-tertiary)]"
              )}
            >
              🔄
            </div>

            <div>
              <h3
                className={cn(
                  "text-lg font-bold",
                  viewMode === "series"
                    ? "text-[var(--color-text-accent)]"
                    : "text-[var(--color-text-primary)]"
                )}
              >
                By Series
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Find recurring happenings that fit your schedule
              </p>
            </div>
          </div>
        </button>

        {/* Map Card (Phase 1.0) */}
        <button
          onClick={() => setViewMode("map")}
          className={cn(
            "relative p-6 rounded-2xl text-left transition-all duration-300",
            "border-2",
            viewMode === "map"
              ? "card-spotlight border-[var(--color-accent-primary)] shadow-[var(--shadow-card-hover)]"
              : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)]/50 hover:shadow-[var(--shadow-card)]"
          )}
          aria-pressed={viewMode === "map"}
        >
          {/* Active indicator glow */}
          {viewMode === "map" && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent pointer-events-none" />
          )}

          <div className="relative z-10 flex flex-col gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                viewMode === "map"
                  ? "bg-[var(--color-accent-primary)]"
                  : "bg-[var(--color-bg-tertiary)]"
              )}
            >
              🗺️
            </div>

            <div>
              <h3
                className={cn(
                  "text-lg font-bold",
                  viewMode === "map"
                    ? "text-[var(--color-text-accent)]"
                    : "text-[var(--color-text-primary)]"
                )}
              >
                Map
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Discover happenings near you on the map
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default ViewModeSelector;
