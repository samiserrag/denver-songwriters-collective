"use client";

import { StudioCard } from "./StudioCard";
import type { Studio } from "@/types";

interface StudioGridProps {
  studios: Studio[];
  /** Compact mode: smaller cards, more columns */
  compact?: boolean;
}

export function StudioGrid({ studios, compact = false }: StudioGridProps) {
  if (studios.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--color-text-tertiary)]">No studios available yet.</p>
      </div>
    );
  }

  return (
    <div className={compact
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    }>
      {studios.map((studio) => (
        <StudioCard key={studio.id} studio={studio} compact={compact} />
      ))}
    </div>
  );
}
