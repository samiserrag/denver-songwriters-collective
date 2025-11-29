"use client";

import * as React from "react";
import clsx from "clsx";

interface ImagePlaceholderProps {
  initials: string;
  className?: string;
}

export function ImagePlaceholder({ initials, className }: ImagePlaceholderProps) {
  const safeInitials =
    initials?.trim().toUpperCase().slice(0, 3) || "OMD";

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded-2xl",
        "bg-[radial-gradient(circle_at_top,_rgba(255,216,106,0.32),_rgba(6,15,44,1))]",
        "border border-white/10 text-[var(--color-warm-white)]",
        "text-2xl font-semibold tracking-[0.16em]",
        className
      )}
    >
      <span className="uppercase">{safeInitials}</span>
    </div>
  );
}
