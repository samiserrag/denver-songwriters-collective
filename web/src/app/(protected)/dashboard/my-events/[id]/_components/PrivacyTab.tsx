"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AttendeeInviteManager from "../../_components/AttendeeInviteManager";

interface PrivacyTabProps {
  eventId: string;
  eventTitle: string;
  eventVisibility: string;
  isPrimaryHost: boolean;
  isAdmin: boolean;
  isEventOwner: boolean;
  EventInviteSection: React.ReactNode;
  onVisibilityChange: (visibility: "public" | "invite_only") => void;
}

type EventVisibility = "public" | "invite_only";

export default function PrivacyTab({
  eventId,
  eventTitle,
  eventVisibility,
  isPrimaryHost,
  isAdmin,
  isEventOwner,
  EventInviteSection,
  onVisibilityChange,
}: PrivacyTabProps) {
  const router = useRouter();
  const canManageVisibility = isPrimaryHost || isAdmin || isEventOwner;
  const canManageAttendeeInvites = isPrimaryHost || isAdmin;
  const canManageHostInvites = isAdmin || isEventOwner;

  const [selectedVisibility, setSelectedVisibility] = useState<EventVisibility>(
    eventVisibility === "invite_only" ? "invite_only" : "public"
  );
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVisibility(eventVisibility === "invite_only" ? "invite_only" : "public");
  }, [eventVisibility]);

  const handleSaveVisibility = async () => {
    if (!canManageVisibility || savingVisibility) return;
    if (selectedVisibility === eventVisibility) {
      setSuccess("No changes to save.");
      setError(null);
      return;
    }

    setSavingVisibility(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/my-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: selectedVisibility }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to update visibility.");
        return;
      }

      onVisibilityChange(selectedVisibility);
      setSuccess(
        selectedVisibility === "invite_only"
          ? "Event is now invite-only."
          : "Event is now public."
      );
      router.refresh();
    } catch {
      setError("Failed to update visibility.");
    } finally {
      setSavingVisibility(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Privacy & Access
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Choose whether this happening appears in public discovery or is only available by invite.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 border border-[var(--color-border-default)] rounded-lg">
            <input
              type="radio"
              name="event-visibility"
              value="public"
              checked={selectedVisibility === "public"}
              onChange={() => setSelectedVisibility("public")}
              disabled={!canManageVisibility || savingVisibility}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Public</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Visible on discovery pages and available to everyone.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border border-[var(--color-border-default)] rounded-lg">
            <input
              type="radio"
              name="event-visibility"
              value="invite_only"
              checked={selectedVisibility === "invite_only"}
              onChange={() => setSelectedVisibility("invite_only")}
              disabled={!canManageVisibility || savingVisibility}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">Private (Invite-only)</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Hidden from discovery. Only hosts/admins and accepted invitees can view.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-4 p-3 text-sm rounded border border-red-300 text-red-700 bg-red-50">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 text-sm rounded border border-emerald-300 text-emerald-700 bg-emerald-50">
            {success}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveVisibility}
            disabled={!canManageVisibility || savingVisibility}
            className="px-4 py-2 rounded font-medium bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] disabled:opacity-60"
          >
            {savingVisibility ? "Saving..." : "Save Privacy Setting"}
          </button>
          {!canManageVisibility && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Only the primary host or an admin can change privacy settings.
            </p>
          )}
        </div>
      </section>

      {canManageAttendeeInvites && (
        <AttendeeInviteManager
          eventId={eventId}
          eventTitle={eventTitle}
          isInviteOnly={selectedVisibility === "invite_only"}
        />
      )}

      {canManageHostInvites && (
        <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Host Invite Links</h2>
          {EventInviteSection}
        </section>
      )}
    </div>
  );
}
