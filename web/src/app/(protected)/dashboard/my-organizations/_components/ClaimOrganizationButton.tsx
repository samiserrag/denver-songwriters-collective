"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ExistingClaim = {
  id?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason?: string | null;
} | null;

interface Props {
  organizationId: string;
  organizationName: string;
  existingClaim: ExistingClaim;
  isAlreadyManager: boolean;
}

export function ClaimOrganizationButton({
  organizationId,
  organizationName,
  existingClaim,
  isAlreadyManager,
}: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAlreadyManager) {
    return (
      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
        <p className="text-sm font-medium text-emerald-400">You manage this profile</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Edit it from{" "}
          <Link href={`/dashboard/my-organizations/${organizationId}`} className="underline">
            My Organizations
          </Link>
          .
        </p>
      </div>
    );
  }

  if (existingClaim && existingClaim.status !== "cancelled") {
    const isPending = existingClaim.status === "pending";
    const isRejected = existingClaim.status === "rejected";
    return (
      <div className="p-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-primary)]">Claim status</p>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              isPending
                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400"
                : isRejected
                ? "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {isPending ? "Pending" : isRejected ? "Rejected" : "Approved"}
          </span>
        </div>
        {isRejected && existingClaim.rejection_reason && (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Reason: {existingClaim.rejection_reason}
          </p>
        )}
        {isPending && (
          <button
            onClick={async () => {
              setIsCancelling(true);
              setError(null);
              try {
                const res = await fetch(`/api/organizations/${organizationId}/claim`, {
                  method: "DELETE",
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(data.error || "Failed to cancel claim");
                  return;
                }
                router.refresh();
              } catch (err) {
                console.error("Cancel organization claim error:", err);
                setError("An unexpected error occurred");
              } finally {
                setIsCancelling(false);
              }
            }}
            disabled={isCancelling}
            className="px-3 py-1 text-xs bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel claim"}
          </button>
        )}
        {error && (
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] transition-colors"
      >
        Claim this profile
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-xl shadow-2xl">
            <div className="p-6 border-b border-[var(--color-border-default)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Claim Organization Profile
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Request management access for &quot;{organizationName}&quot;
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setError(null);
                try {
                  const response = await fetch(`/api/organizations/${organizationId}/claim`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: message.trim() || null }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    setError(data.error || "Failed to submit claim");
                    return;
                  }
                  setIsModalOpen(false);
                  setMessage("");
                  router.refresh();
                } catch (err) {
                  console.error("Submit organization claim error:", err);
                  setError("An unexpected error occurred");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us your relationship to this organization and what you need to update."
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
