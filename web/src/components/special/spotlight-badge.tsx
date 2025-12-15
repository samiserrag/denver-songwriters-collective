import * as React from "react";
import { cn } from "@/lib/utils";

interface SpotlightBadgeProps {
  className?: string;
}

export function SpotlightBadge({ className }: SpotlightBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full",
        "text-[var(--color-indigo-950)] text-xs font-semibold",
        "bg-[var(--color-accent-primary)] shadow-sm",
        className
      )}
    >
      SPOTLIGHT
    </span>
  );
}
