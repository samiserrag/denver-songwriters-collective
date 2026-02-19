"use client";

import CoHostManager from "../../_components/CoHostManager";
import AttendeeInviteManager from "../../_components/AttendeeInviteManager";
import CancelEventButton from "./CancelEventButton";

interface EventHost {
  id: string;
  user_id: string;
  role: string;
  invitation_status: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface SettingsTabProps {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  eventVisibility: string;
  hosts: EventHost[];
  currentUserId: string;
  currentUserRole: "host" | "cohost";
  isPrimaryHost: boolean;
  isAdmin: boolean;
  isEventOwner: boolean;
  EventInviteSection: React.ReactNode;
}

/**
 * Phase 5.14: Settings tab for event management
 *
 * Contains:
 * - Co-host management
 * - Event invites (for admins/primary hosts)
 * - Danger zone (cancel event)
 */
export default function SettingsTab({
  eventId,
  eventTitle,
  eventStatus,
  eventVisibility,
  hosts,
  currentUserId,
  currentUserRole,
  isPrimaryHost,
  isAdmin,
  isEventOwner,
  EventInviteSection,
}: SettingsTabProps) {
  const acceptedHostCount = hosts.filter((h) => h.invitation_status === "accepted").length;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Co-hosts section */}
      <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Co-hosts</h2>
        <CoHostManager
          eventId={eventId}
          eventTitle={eventTitle}
          hosts={hosts}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isSoleHost={acceptedHostCount === 1}
        />
      </section>

      {/* Attendee Invites - only for primary hosts and admins, only for invite-only events */}
      {(isPrimaryHost || isAdmin) && (
        <AttendeeInviteManager
          eventId={eventId}
          eventTitle={eventTitle}
          isInviteOnly={eventVisibility === "invite_only"}
        />
      )}

      {/* Invite Links - only for admins and primary hosts */}
      {(isAdmin || isEventOwner) && (
        <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Invite Links</h2>
          {EventInviteSection}
        </section>
      )}

      {/* Danger Zone */}
      {isPrimaryHost && eventStatus === "active" && (
        <section className="p-6 bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-900/50 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4">Danger Zone</h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            Cancelling this event will notify all attendees and remove it from public listings.
            This action cannot be undone.
          </p>
          <CancelEventButton eventId={eventId} />
        </section>
      )}

      {/* Info for non-primary hosts */}
      {!isPrimaryHost && !isAdmin && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
          <p className="text-sm text-[var(--color-text-secondary)]">
            As a co-host, you can manage attendees and the lineup. Contact the primary host or an admin
            for additional settings changes.
          </p>
        </div>
      )}
    </div>
  );
}
