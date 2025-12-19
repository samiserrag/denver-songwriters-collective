"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface CancelRSVPModalProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelRSVPModal({
  eventId,
  eventTitle,
  isOpen,
  onClose,
  onSuccess,
}: CancelRSVPModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Simple focus trap - keep focus within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Focus the cancel button when modal opens
    setTimeout(() => cancelButtonRef.current?.focus(), 0);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleCancel = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel RSVP");
      }

      setSuccess(true);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel RSVP");
    } finally {
      setLoading(false);
    }
  }, [eventId, router, onSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-2xl shadow-2xl overflow-hidden"
      >
        {success ? (
          // Success state
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2
              id="cancel-modal-title"
              className="text-xl font-semibold text-[var(--color-text-primary)] mb-2"
            >
              You&apos;re All Set
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Your RSVP for &ldquo;{eventTitle}&rdquo; has been cancelled.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/dashboard/my-rsvps"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-medium rounded-lg transition-colors"
              >
                View My RSVPs
              </a>
              <button
                onClick={onClose}
                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Stay on this page
              </button>
            </div>
          </div>
        ) : (
          // Confirmation state
          <>
            <div className="p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2
                id="cancel-modal-title"
                className="text-xl font-semibold text-[var(--color-text-primary)] text-center mb-2"
              >
                Cancel Your RSVP?
              </h2>
              <p className="text-[var(--color-text-secondary)] text-center mb-2">
                Are you sure you want to cancel your RSVP for:
              </p>
              <p className="text-[var(--color-text-primary)] font-medium text-center mb-4">
                &ldquo;{eventTitle}&rdquo;
              </p>
              <p className="text-[var(--color-text-tertiary)] text-sm text-center">
                If you change your mind, you can RSVP again if spots are available.
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]/50">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Keep RSVP
              </button>
              <button
                ref={cancelButtonRef}
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Cancelling...
                  </span>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
