"use client";

import Link from "next/link";
import React from "react";

export default function MapViewButton({ className }: { className?: string }) {
  return (
    <Link
      href="/open-mics/map"
      className={`${className ?? ""} w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--color-gold)]/20 hover:bg-[var(--color-gold)]/30 text-[var(--color-gold)] font-semibold border border-[var(--color-gold)]/40 backdrop-blur-sm`}
    >
      Map View
    </Link>
  );
}
