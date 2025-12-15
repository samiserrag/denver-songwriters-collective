"use client";

import Link from "next/link";
import Image from "next/image";
import type { Studio } from "@/types";
import { ImagePlaceholder } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StudioCardProps {
  studio: Studio;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "STU";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StudioCard({ studio, className }: StudioCardProps) {
  return (
    <Link href={`/studios/${studio.id}`} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image / Placeholder Section - aspect-[4/3] reserves stable space to prevent CLS */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {studio.imageUrl ? (
            <Image
              src={studio.imageUrl}
              alt={studio.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(studio.name)}
              className="w-full h-full text-3xl"
            />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <h3
            className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] tracking-tight"
          >
            {studio.name}
          </h3>

          {studio.description && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] line-clamp-3">
              {studio.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
