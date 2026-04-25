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
import { CalendarDays, Map, Repeat2 } from "lucide-react";
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

  const modes = [
    {
      id: "timeline",
      label: "Timeline",
      icon: CalendarDays,
    },
    {
      id: "series",
      label: "Series",
      icon: Repeat2,
    },
    {
      id: "map",
      label: "Map",
      icon: Map,
    },
  ] as const;

  return (
    <div className={cn("w-full", className)} aria-label="Browse mode">
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-1">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = viewMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/40",
                isActive
                  ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              )}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ViewModeSelector;
