"use client";

import Link from "next/link";
import React from "react";

export default function MapViewButton({ className }: { className?: string }) {
  return (
    <Link
      href="/open-mics/map"
      className={`${className ?? ""} w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-semibold border border-teal-500/40 backdrop-blur-sm`}
    >
      Map View
    </Link>
  );
}
