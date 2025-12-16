import * as React from "react";
import { SongwriterCard } from "./SongwriterCard";
import type { Songwriter } from "@/types";

interface SongwriterGridProps {
  songwriters: Songwriter[];
  className?: string;
}

export function SongwriterGrid({ songwriters, className }: SongwriterGridProps) {
  return (
    <div
      className={className}
      role="list"
      aria-label="Songwriter list"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {songwriters.map((s) => (
          <div key={s.id} role="listitem">
            <SongwriterCard songwriter={s} />
          </div>
        ))}
      </div>
    </div>
  );
}
