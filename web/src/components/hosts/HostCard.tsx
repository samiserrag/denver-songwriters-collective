"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image Section - aspect-[4/3] reserves stable space to prevent CLS */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {host.avatarUrl ? (
            <Image
              src={host.avatarUrl}
              alt={host.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
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
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--color-gold)]/80 text-[var(--color-background)]">
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
