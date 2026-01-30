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

// Calendar icon for Timeline view
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

// Repeat/series icon for Series view
function SeriesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// Map icon for Map view (Phase 1.0)
function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

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
                "w-12 h-12 rounded-xl flex items-center justify-center",
                viewMode === "timeline"
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              )}
            >
              <CalendarIcon className="w-6 h-6" />
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
                "w-12 h-12 rounded-xl flex items-center justify-center",
                viewMode === "series"
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              )}
            >
              <SeriesIcon className="w-6 h-6" />
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
                "w-12 h-12 rounded-xl flex items-center justify-center",
                viewMode === "map"
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              )}
            >
              <MapIcon className="w-6 h-6" />
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
