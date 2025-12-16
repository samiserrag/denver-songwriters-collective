import * as React from "react";
import { SongwriterCard } from "./SongwriterCard";
import type { Songwriter } from "@/types";

interface SpotlightSongwriterCardProps {
  songwriter: Songwriter;
  className?: string;
}

export function SpotlightSongwriterCard({
  songwriter,
  className,
}: SpotlightSongwriterCardProps) {
  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl bg-[var(--color-accent-primary)]/10 blur-xl"
        aria-hidden="true"
      />
      <SongwriterCard songwriter={songwriter} className={className} />
    </div>
  );
}
