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
        "bg-[radial-gradient(circle_at_top,_var(--color-accent-muted),_var(--color-bg-primary))]",
        "border border-white/10 text-[var(--color-text-primary)]",
        "text-2xl font-semibold tracking-[0.16em]",
        className
      )}
    >
      <span className="uppercase">{safeInitials}</span>
    </div>
  );
}
