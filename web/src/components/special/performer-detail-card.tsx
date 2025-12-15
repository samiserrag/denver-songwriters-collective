import * as React from "react";
import { cn } from "@/lib/utils";

interface PerformerDetailCardProps {
  className?: string;
}

export function PerformerDetailCard({ className }: PerformerDetailCardProps) {
  return (
    <div className={cn("card-base p-6 flex gap-4 items-center", className)}>
      <div className="h-14 w-14 rounded-full bg-white/10" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-text-accent)]">
          Performer Name
        </p>
        <p className="text-sm text-[var(--color-warm-gray)] line-clamp-2">
          Performer bio text goes here...
        </p>
      </div>
      <button className="text-sm text-[var(--color-text-accent)] hover:underline">
        Check-In
      </button>
    </div>
  );
}
