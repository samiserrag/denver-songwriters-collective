"use client";

/**
 * GettingStartedSection - Slice 3
 *
 * Shows post-onboarding action prompts for:
 * - Host: Apply to become a DSC Happenings Host (if eligible)
 * - Venue: Browse and claim venues (if host/studio with 0 managed venues)
 *
 * Dismissable via localStorage.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { RequestHostButton } from "@/components/hosts";

const DISMISS_KEY = "dsc_getting_started_dismissed_v1";

interface Props {
  isHost: boolean;
  isStudio: boolean;
  isApprovedHost: boolean;
  hasPendingHostRequest: boolean;
  venueCount: number;
}

export function GettingStartedSection({
  isHost,
  isStudio,
  isApprovedHost,
  hasPendingHostRequest,
  venueCount,
}: Props) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    // Check localStorage on mount - legitimate sync with external storage
    const dismissed = localStorage.getItem(DISMISS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  };

  // Determine what to show
  const showHostCard = isHost && !isApprovedHost && !hasPendingHostRequest;
  const showVenueCard = (isHost || isStudio) && venueCount === 0;

  // If nothing to show or dismissed, don't render
  if (isDismissed || (!showHostCard && !showVenueCard)) {
    return null;
  }

  return (
    <section
      className="p-6 bg-[var(--color-accent-primary)]/5 border border-[var(--color-accent-primary)]/20 rounded-lg"
      data-testid="getting-started-section"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <span>✨</span>
          <span>Getting Started</span>
        </h2>
        <button
          onClick={handleDismiss}
          className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          data-testid="dismiss-getting-started"
        >
          Dismiss
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Host Card */}
        {showHostCard && (
          <div
            className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
            data-testid="host-prompt-card"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🎤</span>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  Host DSC Happenings
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  You marked yourself as a host. Apply to create official DSC happenings.
                </p>
              </div>
            </div>
            <RequestHostButton />
          </div>
        )}

        {/* Venue Card */}
        {showVenueCard && (
          <div
            className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
            data-testid="venue-prompt-card"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">📍</span>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">
                  Manage a Venue
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Do you run or manage a venue that hosts live music? Claim it to manage its listings.
                </p>
              </div>
            </div>
            <Link
              href="/venues"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm font-medium transition-colors"
              data-testid="browse-venues-link"
            >
              Browse Venues
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
