"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  isPublished: boolean;
  status: string;
}

export default function PublishButton({ eventId, isPublished, status }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Handle restore for cancelled events
  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/my-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Failed to restore event:", data.error);
        setIsLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to restore event:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancelled events show restore button
  if (status === "cancelled") {
    return (
      <button
        onClick={handleRestore}
        disabled={isLoading}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoading ? "Restoring..." : "Restore Event"}
      </button>
    );
  }

  const handleTogglePublish = async () => {
    setIsLoading(true);
    const supabase = createClient();

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

    const { error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", eventId);

    if (error) {
      console.error("Failed to update publish status:", error);
      setIsLoading(false);
      return;
    }

    router.refresh();
    setIsLoading(false);
  };

  if (isPublished) {
    // Published - show less prominent unpublish option
    return (
      <button
        onClick={handleTogglePublish}
        disabled={isLoading}
        className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors disabled:opacity-50"
      >
        {isLoading ? "..." : "Unpublish"}
      </button>
    );
  }

  // Draft - show prominent publish button
  return (
    <button
      onClick={handleTogglePublish}
      disabled={isLoading}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)] font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {isLoading ? "Publishing..." : "Publish Event"}
    </button>
  );
}
