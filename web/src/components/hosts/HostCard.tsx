"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Host } from "@/types";
import { SpotlightBadge } from "@/components/special/spotlight-badge";
import { ImagePlaceholder } from "@/components/ui";

interface HostCardProps {
  host: Host;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "H";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HostCard({ host, className }: HostCardProps) {
  return (
    <Link href={`/performers/${host.id}`} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden rounded-3xl border border-white/10",
          "bg-[radial-gradient(circle_at_top,_rgba(56,178,172,0.12),_rgba(6,15,44,1))]",
          "shadow-[0_0_40px_rgba(0,0,0,0.55)]",
          "transition-all duration-300",
          "hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(56,178,172,0.25)]",
          "hover:border-teal-500/30",
          className
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {host.avatarUrl ? (
            <img
              src={host.avatarUrl}
              alt={host.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(host.name)}
              className="w-full h-full"
            />
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Spotlight badge */}
          {host.isSpotlight && (
            <div className="absolute top-3 right-3">
              <SpotlightBadge />
            </div>
          )}

          {/* Host badge */}
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-teal-500/80 text-white">
              Open Mic Host
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3">
          <h3
            className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] tracking-tight"
          >
            {host.name}
          </h3>

          {host.bio && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] line-clamp-2">
              {host.bio}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
