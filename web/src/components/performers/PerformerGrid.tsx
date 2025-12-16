import * as React from "react";
import { PerformerCard } from "./PerformerCard";
import type { Performer } from "@/types";

interface PerformerGridProps {
  performers: Performer[];
  className?: string;
}

export function PerformerGrid({ performers, className }: PerformerGridProps) {
  return (
    <div
      className={className}
      role="list"
      aria-label="Performer list"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {performers.map((p) => (
          <div key={p.id} role="listitem">
            <PerformerCard performer={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
