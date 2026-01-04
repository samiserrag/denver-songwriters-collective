"use client";

/**
 * MissingDetailsChip - Visual indicator for events needing community input
 *
 * Phase 4.1: Shows when an event has missing critical information.
 * Clicking navigates to the "Submit Update" section on the detail page.
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { computeMissingDetails, type MissingDetailsInput } from "@/lib/events/missingDetails";

interface MissingDetailsChipProps {
  event: MissingDetailsInput & { id: string; slug?: string | null; event_type?: string | null };
  /** Compact mode for list views */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function MissingDetailsChip({ event, compact = false, className }: MissingDetailsChipProps) {
  const { missing, reasons } = computeMissingDetails(event);

  if (!missing) return null;

  // Build detail page URL with anchor to suggestion form
  // Prefer slug for SEO-friendly URLs, fallback to id for backward compatibility
  const identifier = event.slug || event.id;
  const detailHref = event.event_type === "open_mic"
    ? `/open-mics/${identifier}#suggest-update`
    : `/events/${identifier}#suggest-update`;

  const tooltipText = `Know the details? Make this listing better!\n\nMissing:\n${reasons.map(r => `• ${r}`).join("\n")}`;

  return (
    <Link
      href={detailHref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full",
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        "hover:bg-amber-200 dark:hover:bg-amber-800/50",
        "transition-colors cursor-pointer",
        compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
      title={tooltipText}
      aria-label="Missing details - click to help complete this listing"
    >
      <svg
        className={cn("flex-shrink-0", compact ? "w-3 h-3" : "w-4 h-4")}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>Missing details</span>
    </Link>
  );
}

/**
 * Server-side compatible version that just renders the chip
 * (no Link, just visual indicator with reasons in tooltip)
 */
export function MissingDetailsChipStatic({
  event,
  compact = false,
  className
}: Omit<MissingDetailsChipProps, "event"> & { event: MissingDetailsInput }) {
  const { missing, reasons } = computeMissingDetails(event);

  if (!missing) return null;

  const tooltipText = `Missing: ${reasons.join(", ")}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full",
        "bg-amber-100 text-amber-800",
        compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
      title={tooltipText}
    >
      <svg
        className={cn("flex-shrink-0", compact ? "w-3 h-3" : "w-4 h-4")}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>Missing details</span>
    </span>
  );
}

export default MissingDetailsChip;
