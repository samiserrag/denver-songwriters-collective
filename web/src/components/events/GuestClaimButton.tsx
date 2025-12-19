"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GuestClaimModal } from "./GuestClaimModal";
import { isGuestVerificationEnabled } from "@/lib/featureFlags";

interface GuestClaimButtonProps {
  eventId: string;
  eventTitle: string;
  slotIndex: number;
  slotTime: string;
  isAuthenticated: boolean;
  disabled?: boolean;
  onSuccess?: () => void;
  className?: string;
}

/**
 * GuestClaimButton
 *
 * Shows a "Claim as Guest" button for unauthenticated users when the
 * guest verification feature flag is enabled. Opens GuestClaimModal
 * for the email verification flow.
 */
export function GuestClaimButton({
  eventId,
  eventTitle,
  slotIndex,
  slotTime,
  isAuthenticated,
  disabled,
  onSuccess,
  className,
}: GuestClaimButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't render if:
  // - Feature flag is off
  // - User is authenticated (should use member flow)
  if (!isGuestVerificationEnabled() || isAuthenticated) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "px-4 py-2 rounded-full text-sm font-medium",
          "border border-[var(--color-accent-primary)]/60 bg-transparent",
          "text-[var(--color-text-accent)]",
          "hover:bg-[var(--color-accent-muted)] hover:border-[var(--color-accent-primary)]",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          className
        )}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        Claim as Guest
      </button>

      <GuestClaimModal
        eventId={eventId}
        eventTitle={eventTitle}
        slotIndex={slotIndex}
        slotTime={slotTime}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          onSuccess?.();
        }}
      />
    </>
  );
}
