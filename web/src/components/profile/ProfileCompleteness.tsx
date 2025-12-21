"use client";

import { calculateCompleteness, type ProfileData } from "@/lib/profile/completeness";

interface ProfileCompletenessProps {
  profile: ProfileData;
  variant?: "full" | "compact";
}

export function ProfileCompleteness({ profile, variant = "full" }: ProfileCompletenessProps) {
  const result = calculateCompleteness(profile);

  // Compact variant for dashboard home
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Profile</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {result.percentage}%
            </span>
          </div>
          <div className="h-2 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
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
        </div>
        {!result.isComplete && result.suggestions.length > 0 && (
          <a
            href="/dashboard/profile"
            className="text-xs text-[var(--color-text-accent)] hover:underline whitespace-nowrap"
          >
            Complete profile →
          </a>
        )}
      </div>
    );
  }

  // Full variant for profile edit page
  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4 mb-8">
      {/* Header with percentage */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Profile Completeness
        </h3>
        <span
          className={`text-lg font-semibold ${
            result.isComplete
              ? "text-emerald-500"
              : result.percentage >= 70
              ? "text-[var(--color-text-accent)]"
              : result.percentage >= 40
              ? "text-amber-500"
              : "text-red-400"
          }`}
        >
          {result.percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden mb-4">
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

      {/* Suggestions or success message */}
      {result.isComplete ? (
        <p className="text-sm text-emerald-500 flex items-center gap-2">
          <span>🎉</span>
          Your profile is complete!
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
            Complete your profile to help others find you:
          </p>
          {result.suggestions.map((suggestion) => (
            <a
              key={suggestion.id}
              href={`#${suggestion.sectionId}`}
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors group"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(suggestion.sectionId);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                  // Add a brief highlight effect
                  element.classList.add("ring-2", "ring-[var(--color-border-accent)]", "ring-offset-2");
                  setTimeout(() => {
                    element.classList.remove("ring-2", "ring-[var(--color-border-accent)]", "ring-offset-2");
                  }, 2000);
                }
              }}
            >
              <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-accent)]">
                →
              </span>
              <span>{suggestion.suggestion}</span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                (+{suggestion.points} pts)
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
