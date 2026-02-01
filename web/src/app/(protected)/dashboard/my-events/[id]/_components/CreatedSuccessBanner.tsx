"use client";

import { useState } from "react";
import Link from "next/link";

interface CreatedSuccessBannerProps {
  eventId: string;
  eventSlug?: string | null;
  /** YYYY-MM-DD date to anchor the public page link (for occurrence-specific navigation) */
  nextOccurrenceDate?: string | null;
  /** Whether this event is still a draft (unpublished) */
  isDraft?: boolean;
}

export default function CreatedSuccessBanner({ eventId, eventSlug, nextOccurrenceDate, isDraft }: CreatedSuccessBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Draft state banner (amber)
  if (isDraft) {
    return (
      <div className="mb-6 p-4 rounded-lg border flex items-start justify-between bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30">
        <div className="flex-1">
          <h3 className="font-semibold text-amber-800 dark:text-amber-600">
            Happening Created as Draft
          </h3>
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-700">
            Your happening is saved but not yet visible to the public. Use the <strong>Publish Event</strong> button above when you&apos;re ready to go live.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 p-1 rounded hover:bg-black/10 text-amber-800 dark:text-amber-600"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Published state banner (emerald)
  return (
    <div className="mb-6 p-4 rounded-lg border flex items-start justify-between bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30">
      <div className="flex-1">
        <h3 className="font-semibold text-emerald-800 dark:text-emerald-600">
          Happening Created & Published!
        </h3>
        <p className="text-sm mt-1 text-emerald-700 dark:text-emerald-700">
          Your happening is now live and visible on the Happenings page!
        </p>
        <Link
          href={`/events/${eventSlug || eventId}${nextOccurrenceDate ? `?date=${nextOccurrenceDate}` : ""}`}
          className="inline-block mt-2 text-sm text-emerald-700 dark:text-emerald-600 hover:underline"
        >
          View Public Page →
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="ml-4 p-1 rounded hover:bg-black/10 text-emerald-800 dark:text-emerald-600"
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
