import * as React from "react";
import { PerformerCard } from "./PerformerCard";
import type { Performer } from "@/types";

interface SpotlightPerformerCardProps {
  performer: Performer;
  className?: string;
}

export function SpotlightPerformerCard({
  performer,
  className,
}: SpotlightPerformerCardProps) {
  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl bg-[var(--color-gold)]/10 blur-xl"
        aria-hidden="true"
      />
      <PerformerCard performer={performer} className={className} />
    </div>
  );
}
