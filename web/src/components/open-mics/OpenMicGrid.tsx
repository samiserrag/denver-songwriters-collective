import * as React from "react";
import { OpenMicCard, type SpotlightOpenMic } from "./OpenMicCard";

interface OpenMicGridProps {
  openMics: SpotlightOpenMic[];
  className?: string;
}

export function OpenMicGrid({ openMics, className }: OpenMicGridProps) {
  return (
    <div className={className} role="list" aria-label="Open mic list">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {openMics.map((openMic) => (
          <div key={openMic.id} role="listitem">
            <OpenMicCard openMic={openMic} />
          </div>
        ))}
      </div>
    </div>
  );
}
