"use client";

import { useState } from "react";
import OccurrenceSelector from "./OccurrenceSelector";
import RSVPList from "../../_components/RSVPList";
import TimeslotClaimsTable from "../../_components/TimeslotClaimsTable";

interface SidebarManagementPanelsProps {
  eventId: string;
  capacity: number | null;
  isRecurring: boolean;
  availableDates: string[];
  initialDateKey?: string;
  hasTimeslots: boolean;
  hasActiveClaims: boolean;
}

/**
 * Phase 5.13: Unified sidebar management panels for edit page
 *
 * For recurring events, this component provides a SINGLE occurrence selector
 * that controls both the RSVPList and TimeslotClaimsTable. This eliminates
 * the confusing UX where hosts had to select the date separately in each panel.
 *
 * Single occurrence events don't show the selector - they just show the panels.
 */
export default function SidebarManagementPanels({
  eventId,
  capacity,
  isRecurring,
  availableDates,
  initialDateKey,
  hasTimeslots,
  hasActiveClaims,
}: SidebarManagementPanelsProps) {
  const [selectedDate, setSelectedDate] = useState(initialDateKey || availableDates[0] || "");

  const showTimeslots = hasTimeslots || hasActiveClaims;
  const showSelector = isRecurring && availableDates.length > 1;

  return (
    <div className="space-y-6">
      {/* Unified Occurrence Selector - only for recurring events with multiple dates */}
      {showSelector && (
        <OccurrenceSelector
          availableDates={availableDates}
          initialDateKey={initialDateKey}
          onDateChange={setSelectedDate}
        />
      )}

      {/* Performer Signups - controlled by unified selector */}
      {showTimeslots && (
        <section id="performer-signups" className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <TimeslotClaimsTable
            eventId={eventId}
            isRecurring={isRecurring}
            availableDates={availableDates}
            initialDateKey={selectedDate}
            hideOwnSelector={showSelector}
          />
        </section>
      )}

      {/* Attendees - controlled by unified selector */}
      <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Attendees</h2>
        <RSVPList
          eventId={eventId}
          capacity={capacity}
          isRecurring={isRecurring}
          availableDates={availableDates}
          initialDateKey={selectedDate}
          hideOwnSelector={showSelector}
        />
      </section>
    </div>
  );
}
