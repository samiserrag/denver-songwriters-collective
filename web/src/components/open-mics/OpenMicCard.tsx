"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SpotlightBadge } from "@/components/special/spotlight-badge";

export interface SpotlightOpenMic {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  day_of_week?: string;
  start_time?: string;
  signup_time?: string;
  venue_name?: string;
  venue_city?: string;
  is_featured?: boolean;
}

interface OpenMicCardProps {
  openMic: SpotlightOpenMic;
  className?: string;
}

function formatTime(time?: string | null): string {
  if (!time) return "";
  try {
    const timeOnly = time.includes("T") ? time.split("T")[1] : time;
    const [hh, mm] = timeOnly.split(":");
    const hour = parseInt(hh, 10);
    const minutes = mm ?? "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = ((hour + 11) % 12) + 1;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return time;
  }
}

export function OpenMicCard({ openMic, className }: OpenMicCardProps) {
  const href = openMic.slug ? `/open-mics/${openMic.slug}` : `/open-mics`;

  return (
    <Link href={href} className="block h-full group focus-visible:outline-none">
      <article
        className={cn(
          "h-full overflow-hidden rounded-2xl border border-[var(--color-border-default)]",
          "bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-primary)]",
          "shadow-[var(--shadow-card)]",
          "transition-shadow transition-colors duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          className
        )}
      >
        {/* Header with day and spotlight badge */}
        <div className="relative px-5 py-4 border-b border-white/5 bg-gradient-to-r from-[var(--color-accent-primary)]/10 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-accent)] font-semibold text-sm uppercase tracking-widest">
              {openMic.day_of_week || "Weekly"}
            </span>
            {openMic.is_featured && <SpotlightBadge />}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3 text-center">
          <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
            {openMic.title}
          </h3>

          {/* Venue info */}
          {(openMic.venue_name || openMic.venue_city) && (
            <p className="text-base text-[var(--color-text-secondary)] flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-text-accent)]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>
                {openMic.venue_name}
                {openMic.venue_city && `, ${openMic.venue_city}`}
              </span>
            </p>
          )}

          {/* Time info */}
          <div className="flex items-center justify-center gap-4 text-base text-[var(--color-text-tertiary)]">
            {openMic.start_time && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-[var(--color-text-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(openMic.start_time)}
              </span>
            )}
            {openMic.signup_time && (
              <span className="text-sm text-[var(--color-text-tertiary)]">
                Sign-up: {formatTime(openMic.signup_time)}
              </span>
            )}
          </div>

          {/* Description preview */}
          {openMic.description && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 text-left mx-auto max-w-prose">
              {openMic.description}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
