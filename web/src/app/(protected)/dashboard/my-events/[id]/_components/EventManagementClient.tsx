"use client";

import { useState } from "react";
import EventManagementTabs, { TabId } from "./EventManagementTabs";
import AttendeesTab from "./AttendeesTab";
import LineupTab from "./LineupTab";
import SettingsTab from "./SettingsTab";

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

interface EventManagementClientProps {
  // Event data
  eventId: string;
  eventSlug: string | null;
  eventTitle: string;
  eventStatus: string;
  capacity: number | null;
  isRecurring: boolean;
  availableDates: string[];
  initialDateKey?: string;
  hasTimeslots: boolean;
  hasActiveClaims: boolean;

  // Host data
  hosts: EventHost[];
  currentUserId: string;
  currentUserRole: "host" | "cohost";
  isPrimaryHost: boolean;
  isAdmin: boolean;
  isEventOwner: boolean;

  // Child components passed from server
  DetailsContent: React.ReactNode;
  EventInviteSection: React.ReactNode;
  LineupControlSection: React.ReactNode;
  SeriesEditingNotice: React.ReactNode;
}

/**
 * Phase 5.14: Client wrapper for tabbed event management
 *
 * Manages tab state and renders the appropriate content for each tab.
 * Details tab content is passed from server (EventForm needs server data).
 */
export default function EventManagementClient({
  eventId,
  eventSlug,
  eventTitle,
  eventStatus,
  capacity,
  isRecurring,
  availableDates,
  initialDateKey,
  hasTimeslots,
  hasActiveClaims,
  hosts,
  currentUserId,
  currentUserRole,
  isPrimaryHost,
  isAdmin,
  isEventOwner,
  DetailsContent,
  EventInviteSection,
  LineupControlSection,
  SeriesEditingNotice,
}: EventManagementClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("details");

  // For badge counts - these will be fetched/passed as needed
  // For now, we use 0 as placeholder since actual counts come from the tab components
  const attendeeCount = 0;
  const lineupCount = 0;

  return (
    <div>
      <EventManagementTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasTimeslots={hasTimeslots || hasActiveClaims}
        attendeeCount={attendeeCount}
        lineupCount={lineupCount}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "details" && (
          <div className="space-y-8">
            {SeriesEditingNotice}
            <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Happening Details</h2>
              {DetailsContent}
            </section>
            {/* Lineup Control in Details tab for quick access */}
            {(hasTimeslots || hasActiveClaims) && LineupControlSection}
          </div>
        )}

        {activeTab === "attendees" && (
          <AttendeesTab
            eventId={eventId}
            capacity={capacity}
            isRecurring={isRecurring}
            availableDates={availableDates}
            initialDateKey={initialDateKey}
          />
        )}

        {activeTab === "lineup" && (hasTimeslots || hasActiveClaims) && (
          <LineupTab
            eventId={eventId}
            eventSlug={eventSlug}
            isRecurring={isRecurring}
            availableDates={availableDates}
            initialDateKey={initialDateKey}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            eventId={eventId}
            eventTitle={eventTitle}
            eventStatus={eventStatus}
            hosts={hosts}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            isPrimaryHost={isPrimaryHost}
            isAdmin={isAdmin}
            isEventOwner={isEventOwner}
            EventInviteSection={EventInviteSection}
          />
        )}
      </div>
    </div>
  );
}
