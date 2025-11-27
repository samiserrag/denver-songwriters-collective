"use client";

import { StudioCard } from "./StudioCard";
import type { Studio } from "@/types";

interface StudioGridProps {
  studios: Studio[];
}

export function StudioGrid({ studios }: StudioGridProps) {
  if (studios.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400">No studios available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {studios.map((studio) => (
        <StudioCard key={studio.id} studio={studio} />
      ))}
    </div>
  );
}
