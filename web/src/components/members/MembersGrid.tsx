"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Member } from "@/types";
import { MemberCard } from "./MemberCard";

interface MembersGridProps {
  members: Member[];
  className?: string;
}

export function MembersGrid({ members, className }: MembersGridProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-warm-gray)]">
          No members found matching your filters.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        className
      )}
    >
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}
