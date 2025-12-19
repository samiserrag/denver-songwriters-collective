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

  // Cancelled events cannot be published directly
  if (status === "cancelled") {
    return (
      <div className="text-sm text-[var(--color-text-secondary)]">
        Restore this event before publishing.
      </div>
    );
  }

  const handleTogglePublish = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("events")
      .update({ is_published: !isPublished })
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
