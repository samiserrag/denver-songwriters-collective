import React from "react";
import Link from "next/link";

export default function WorkInProgressBanner() {
  return (
    <div className="mb-6 rounded-xl border border-[var(--color-border-accent)] bg-[var(--color-accent-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-glow-gold-sm)]">
      <p className="font-semibold text-[var(--color-text-accent)]">Help Us Keep This List Accurate</p>
      <p className="mt-1">
        Open mic schedules change frequently. If you notice outdated information or know of an open mic we&apos;re missing,{" "}
        <Link href="/submit-open-mic" className="text-[var(--color-text-accent)] hover:underline">
          let us know
        </Link>
        . Your input helps keep this directory reliable for everyone.
      </p>
    </div>
  );
}
