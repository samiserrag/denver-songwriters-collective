"use client";

import Link from "next/link";
import React from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DayJumpBar() {
  return (
    <nav className="flex gap-4 px-1 pb-3 border-b border-[var(--color-border-default)] overflow-x-auto">
      {DAYS.map((d) => (
        <a
          key={d}
          href={`#day-${d}`}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] whitespace-nowrap"
        >
          {d.slice(0,3)}
        </a>
      ))}
    </nav>
  );
}
