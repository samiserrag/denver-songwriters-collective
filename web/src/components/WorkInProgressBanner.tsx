import React from "react";
import Link from "next/link";

export default function WorkInProgressBanner() {
  return (
    <div className="mb-6 rounded-xl border border-[var(--color-gold)]/30 bg-[rgba(30,20,0,0.4)] px-4 py-3 text-sm text-[var(--color-warm-gray-light)] shadow-[0_0_16px_rgba(255,216,106,0.08)]">
      <p className="font-semibold text-[var(--color-gold)]">Help Us Keep This List Accurate</p>
      <p className="mt-1">
        Open mic schedules change frequently. If you notice outdated information or know of an open mic we&apos;re missing,{" "}
        <Link href="/submit-open-mic" className="text-teal-400 hover:underline">
          let us know
        </Link>
        . Your input helps keep this directory reliable for everyone.
      </p>
    </div>
  );
}
