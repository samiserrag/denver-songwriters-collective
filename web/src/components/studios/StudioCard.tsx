"use client";

import Link from "next/link";
import type { Studio } from "@/types";

interface StudioCardProps {
  studio: Studio;
}

export function StudioCard({ studio }: StudioCardProps) {
  return (
    <Link href={`/studios/${studio.id}`}>
      <div className="bg-neutral-900 rounded-lg p-6 hover:bg-neutral-800 transition-colors">
        <h3 className="text-xl font-semibold text-white mb-2">{studio.name}</h3>
        {studio.description && (
          <p className="text-neutral-400 text-sm line-clamp-2">{studio.description}</p>
        )}
      </div>
    </Link>
  );
}
