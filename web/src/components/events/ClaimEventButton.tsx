"use client";

/**
 * ClaimEventButton - Phase 4.22.3
 *
 * Allows authenticated users to claim ownership of unclaimed events
 * (events with host_id IS NULL). Shows claim status if already claimed.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  eventTitle: string;
  existingClaim: {
    status: "pending" | "approved" | "rejected";
    rejection_reason?: string | null;
  } | null;
}

export function ClaimEventButton({ eventId, eventTitle, existingClaim }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If user already has a claim, show status
  if (existingClaim) {
    return (
      <div className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-medium text-[var(--color-text-primary)]">
              Claim Status
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              You&apos;ve requested to claim this happening
            </p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              existingClaim.status === "pending"
                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400"
                : existingClaim.status === "approved"
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400"
            }`}
          >
            {existingClaim.status === "pending"
              ? "Pending Approval"
              : existingClaim.status === "approved"
              ? "Approved"
              : "Rejected"}
          </span>
        </div>
        {existingClaim.status === "rejected" && existingClaim.rejection_reason && (
          <p className="mt-2 text-sm text-red-800 dark:text-red-400">
            Reason: {existingClaim.rejection_reason}
          </p>
        )}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: insertError } = await supabase
        .from("event_claims")
        .insert({
          event_id: eventId,
          requester_id: (await supabase.auth.getUser()).data.user?.id,
          message: message.trim() || null,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          // Unique constraint violation
          setError("You already have a pending claim for this happening.");
        } else {
          setError(insertError.message);
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Claim submitted! An admin will review your request.");
      setIsModalOpen(false);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Claim submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <p className="font-medium text-emerald-400">{successMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Claim This Happening
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />

          {/* Modal content */}
          <div className="relative w-full max-w-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-xl shadow-2xl">
            <div className="p-6 border-b border-[var(--color-border-default)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Claim Happening
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Request ownership of &quot;{eventTitle}&quot;
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us why you're claiming this happening (e.g., 'I'm the venue owner' or 'I organize this open mic')"
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] resize-none placeholder:text-[var(--color-text-tertiary)]"
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {message.length}/500 characters
                </p>
              </div>

              {error && (
                <div className="p-3 rounded bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-default)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
