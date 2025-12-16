import * as React from "react";
import { HostCard } from "./HostCard";
import type { Host } from "@/types";

interface HostGridProps {
  hosts: Host[];
  className?: string;
}

export function HostGrid({ hosts, className }: HostGridProps) {
  return (
    <div
      className={className}
      role="list"
      aria-label="Host list"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {hosts.map((h) => (
          <div key={h.id} role="listitem">
            <HostCard host={h} />
          </div>
        ))}
      </div>
    </div>
  );
}
