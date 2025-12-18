"use client";

import { useState } from "react";
import Link from "next/link";

interface CreatedSuccessBannerProps {
  isDraft: boolean;
  eventId: string;
}

export default function CreatedSuccessBanner({ isDraft, eventId }: CreatedSuccessBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={`mb-6 p-4 rounded-lg border flex items-start justify-between ${
      isDraft
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-emerald-500/10 border-emerald-500/30"
    }`}>
      <div className="flex-1">
        <h3 className={`font-semibold ${
          isDraft ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
        }`}>
          {isDraft ? "Event Created as Draft" : "Event Created & Published!"}
        </h3>
        <p className={`text-sm mt-1 ${
          isDraft ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
        }`}>
          {isDraft
            ? "Your event is saved but not visible to the public yet."
            : "Your event is now live and visible on the Happenings page!"
          }
        </p>
        {isDraft ? (
          <p className={`text-sm mt-2 font-medium text-amber-700 dark:text-amber-300`}>
            To publish: Scroll down to the &quot;Draft/Published&quot; toggle at the bottom of the form and switch it to Published, then click Save Changes.
          </p>
        ) : (
          <Link
            href={`/events/${eventId}`}
            className="inline-block mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            View Public Page →
          </Link>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={`ml-4 p-1 rounded hover:bg-black/10 ${
          isDraft ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
        }`}
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
