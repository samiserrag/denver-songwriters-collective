"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_TYPE_CONFIG } from "@/types/events";

interface Invitation {
  id: string;
  role: string;
  invited_at: string;
  event: {
    id: string;
    title: string;
    event_type: string;
    venue_name: string;
    start_time: string;
  } | null;
  inviter: {
    id: string;
    full_name: string;
  } | null;
}

export default function InvitationsList({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRespond = async (id: string, action: "accept" | "decline", eventTitle: string) => {
    setProcessing(id);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });

      if (res.ok) {
        if (action === "accept") {
          setSuccessMessage(`You are now a co-host for "${eventTitle}"! Check My Events to manage it.`);
        } else {
          setSuccessMessage("Invitation declined.");
        }
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    } finally {
      setProcessing(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📬</div>
        <h2 className="text-xl text-[var(--color-text-primary)] mb-2">No pending invitations</h2>
        <p className="text-[var(--color-text-secondary)]">
          When someone invites you to co-host an event, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400">
          {successMessage}
        </div>
      )}
      {invitations.map((invitation) => {
        const config = invitation.event?.event_type
          ? EVENT_TYPE_CONFIG[invitation.event.event_type as keyof typeof EVENT_TYPE_CONFIG] || EVENT_TYPE_CONFIG.other
          : EVENT_TYPE_CONFIG.other;
        const eventTitle = invitation.event?.title || "Unknown Event";

        return (
          <div
            key={invitation.id}
            className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">{config.icon}</div>
              <div className="flex-1">
                <h3 className="text-[var(--color-text-primary)] font-medium">{eventTitle}</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  {invitation.event?.venue_name} {invitation.event?.start_time && `• ${invitation.event.start_time}`}
                </p>
                <p className="text-[var(--color-text-secondary)] text-sm mt-2">
                  Invited by {invitation.inviter?.full_name || "Unknown"} as {invitation.role}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleRespond(invitation.id, "accept", eventTitle)}
                disabled={processing === invitation.id}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-[var(--color-bg-inverse)] rounded-lg disabled:opacity-50"
              >
                {processing === invitation.id ? "..." : "Accept"}
              </button>
              <button
                onClick={() => handleRespond(invitation.id, "decline", eventTitle)}
                disabled={processing === invitation.id}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
