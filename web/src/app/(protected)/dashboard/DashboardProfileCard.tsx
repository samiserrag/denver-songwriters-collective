"use client";

import { calculateCompleteness, type ProfileData } from "@/lib/profile/completeness";
import Link from "next/link";

interface DashboardProfileCardProps {
  profile: ProfileData;
}

export function DashboardProfileCard({ profile }: DashboardProfileCardProps) {
  const result = calculateCompleteness(profile);

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Profile Completeness
        </h3>
        <span
          className={`text-sm font-semibold ${
            result.isComplete
              ? "text-emerald-500"
              : result.percentage >= 70
              ? "text-[var(--color-text-accent)]"
              : result.percentage >= 40
              ? "text-amber-500"
              : "text-red-800 dark:text-red-400"
          }`}
        >
          {result.percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            result.isComplete
              ? "bg-emerald-500"
              : result.percentage >= 70
              ? "bg-[var(--color-accent-primary)]"
              : result.percentage >= 40
              ? "bg-amber-500"
              : "bg-red-400"
          }`}
          style={{ width: `${result.percentage}%` }}
        />
      </div>

      {/* Message */}
      {result.isComplete ? (
        <p className="text-sm text-emerald-500 flex items-center gap-2">
          <span>🎉</span>
          Your profile is complete!
        </p>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {result.suggestions.length} item{result.suggestions.length !== 1 ? "s" : ""} to complete
          </p>
          <Link
            href="/dashboard/profile"
            className="text-xs text-[var(--color-text-accent)] hover:underline"
          >
            Complete profile →
          </Link>
        </div>
      )}
    </div>
  );
}
