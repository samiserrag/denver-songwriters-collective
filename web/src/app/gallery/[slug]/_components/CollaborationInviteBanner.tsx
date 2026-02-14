"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CollaborationInviteBannerProps {
  albumId: string;
  albumName: string;
  inviterName: string;
}

export default function CollaborationInviteBanner({
  albumId,
  albumName,
  inviterName,
}: CollaborationInviteBannerProps) {
  const router = useRouter();
  const [responding, setResponding] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleRespond = async (response: "accepted" | "declined") => {
    setResponding(response);
    try {
      const res = await fetch(`/api/gallery-albums/${albumId}/respond-collaboration`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await res.json();
      if (res.ok) {
        setDismissed(true);
        if (response === "accepted") {
          router.refresh();
        }
      } else {
        alert(data.error || `Failed to ${response === "accepted" ? "accept" : "decline"}.`);
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-accent)] rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            📸 <strong>{inviterName}</strong> invited you to collaborate on &ldquo;{albumName}&rdquo;.
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            If you accept, this album will appear on your public profile.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handleRespond("accepted")}
            disabled={responding !== null}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {responding === "accepted" ? "Accepting..." : "Accept"}
          </button>
          <button
            onClick={() => handleRespond("declined")}
            disabled={responding !== null}
            className="px-4 py-1.5 text-sm font-medium rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-red-500 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {responding === "declined" ? "Declining..." : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}
