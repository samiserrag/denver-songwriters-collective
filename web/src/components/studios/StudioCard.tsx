"use client";

import Link from "next/link";
import Image from "next/image";
import type { Studio } from "@/types";
import { ImagePlaceholder } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StudioCardProps {
  studio: Studio;
  className?: string;
  /** Compact mode: smaller card with reduced padding and text */
  compact?: boolean;
}

function getInitials(name: string): string {
  if (!name) return "STU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StudioCard({ studio, className, compact = false }: StudioCardProps) {
  return (
    <Link href={`/studios/${studio.id}`} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image / Placeholder Section */}
        <div className={cn("relative overflow-hidden", "aspect-[4/3]")}>
          {studio.imageUrl ? (
            <Image
              src={studio.imageUrl}
              alt={studio.name}
              fill
              sizes={compact
                ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(studio.name)}
              className={cn("w-full h-full", compact ? "text-xl" : "text-3xl")}
            />
          )}
        </div>

        {/* Content */}
        <div className={cn(compact ? "p-3 space-y-1.5" : "p-5 space-y-3")}>
          <h3
            className={cn(
              "font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight line-clamp-2",
              compact ? "text-sm" : "text-[length:var(--font-size-heading-sm)]"
            )}
          >
            {studio.name}
          </h3>

          {!compact && studio.description && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-3">
              {studio.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
