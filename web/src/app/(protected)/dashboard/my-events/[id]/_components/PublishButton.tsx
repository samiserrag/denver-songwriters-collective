"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
interface Props {
  eventId: string;
  isPublished: boolean;
  status: string;
  hasSignupActivity: boolean;
}

export default function PublishButton({ eventId, isPublished, status, hasSignupActivity }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (status === "cancelled") return null;

  const handleTogglePublish = async () => {
    if (isPublished && hasSignupActivity) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // When publishing, also set status to active and auto-confirm
    // When unpublishing, keep status as-is (don't reset to draft)
    const updates: { is_published: boolean; status?: string; last_verified_at?: string } = {
      is_published: !isPublished,
    };
    if (!isPublished) {
      // Publishing: ensure status is active so it appears on /happenings
      updates.status = "active";
      // Phase 4.73: Auto-confirm on publish (including republish)
      // This ensures user-created events are confirmed when published
      updates.last_verified_at = new Date().toISOString();
    }

    const response = await fetch(`/api/my-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    const data = await response.json().catch(() => ({} as { error?: string; is_published?: boolean }));

    if (!response.ok) {
      console.error("Failed to update publish status:", data.error || "unknown error");
      setErrorMessage(data.error || "Failed to update publish status. Please refresh and try again.");
      setIsLoading(false);
      return;
    }

    const expectedPublishedState = updates.is_published;
    if (data?.is_published !== expectedPublishedState) {
      setErrorMessage(
        expectedPublishedState
          ? "Publish request did not persist. Event is still draft."
          : "Unpublish request did not persist. Event is still live."
      );
      router.refresh();
      setIsLoading(false);
      return;
    }

    setSuccessMessage(expectedPublishedState ? "Event published." : "Event unpublished.");
    router.refresh();
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {isPublished ? (
        // Published - show less prominent unpublish option
        <button
          onClick={handleTogglePublish}
          disabled={isLoading || hasSignupActivity}
          title={hasSignupActivity ? "Unpublish is disabled when RSVP/timeslot activity exists. Use Cancel instead." : undefined}
          className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "..." : hasSignupActivity ? "Unpublish disabled" : "Unpublish"}
        </button>
      ) : (
        // Draft - show prominent publish button
        <button
          onClick={handleTogglePublish}
          disabled={isLoading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)] font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? "Publishing..." : "Publish Event"}
        </button>
      )}

      {errorMessage && (
        <p className="max-w-xs text-right text-xs text-red-600">{errorMessage}</p>
      )}
      {!errorMessage && successMessage && (
        <p className="max-w-xs text-right text-xs text-emerald-600">{successMessage}</p>
      )}
    </div>
  );
}
