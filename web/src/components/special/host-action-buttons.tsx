import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HostActionButtonsProps {
  className?: string;
}

export function HostActionButtons({ className }: HostActionButtonsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="secondary" size="sm">Mark No-Show</Button>
      <Button variant="secondary" size="sm">Swap Slots</Button>
      <Button variant="secondary" size="sm">Check-In</Button>
    </div>
  );
}
