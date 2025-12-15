import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface HostSlotCardProps {
  className?: string;
}

export function HostSlotCard({ className }: HostSlotCardProps) {
  return (
    <div
      className={cn(
        "card-base p-6 flex flex-col gap-4",
        className
      )}
    >
      <div className="flex justify-between">
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Slot</p>
          <p className="font-semibold text-[var(--color-text-accent)]">#1</p>
        </div>
        <p className="font-semibold text-[var(--color-text-primary)]">
          Performer
        </p>
      </div>

      <div className="text-sm text-[var(--color-text-secondary)]">
        (Performer details will appear here)
      </div>

      <div className="border-t border-white/10 pt-4 flex gap-2">
        <Button variant="secondary" size="sm">No-Show</Button>
        <Button variant="secondary" size="sm">Swap</Button>
        <Button variant="secondary" size="sm">Check-In</Button>
      </div>
    </div>
  );
}
