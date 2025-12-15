import * as React from "react";
import { cn } from "@/lib/utils";

interface SlotStatusIndicatorProps {
  status?: "open" | "claimed" | "full";
  className?: string;
}

const map = {
  open: { color: "bg-[var(--color-success)]", label: "Open" },
  claimed: { color: "bg-[var(--color-accent-primary)]", label: "Claimed" },
  full: { color: "bg-[var(--color-warm-gray)]", label: "Full" },
};

export function SlotStatusIndicator({
  status = "open",
  className,
}: SlotStatusIndicatorProps) {
  const config = map[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.color)} />
      <span className="text-xs text-[var(--color-warm-gray)]">
        {config.label}
      </span>
    </div>
  );
}
