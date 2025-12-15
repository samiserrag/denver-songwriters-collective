import * as React from "react";
import { cn } from "@/lib/utils";

interface PerformerTagProps {
  children: React.ReactNode;
  className?: string;
}

export function PerformerTag({ children, className }: PerformerTagProps) {
  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium",
        "bg-white/5 border border-white/10",
        "text-[var(--color-text-secondary)]",
        className
      )}
    >
      {children}
    </span>
  );
}
