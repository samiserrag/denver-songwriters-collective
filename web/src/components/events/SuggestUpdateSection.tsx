"use client";

/**
 * SuggestUpdateSection - Client wrapper for EventSuggestionForm
 *
 * Provides a button to toggle the suggestion form visibility.
 * Works for both logged-in users and guests (guest mode = email only, no verification).
 */

import { useState } from "react";
import EventSuggestionForm from "./EventSuggestionForm";

interface Event {
  id: string;
  title: string;
  venue_name?: string | null;
  venue_address?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  signup_time?: string | null;
  recurrence_rule?: string | null;
  category?: string | null;
  description?: string | null;
  slug?: string | null;
  is_free?: boolean | null;
  cost_label?: string | null;
  signup_mode?: string | null;
  signup_url?: string | null;
  age_policy?: string | null;
  location_mode?: string | null;
  online_url?: string | null;
  custom_location_name?: string | null;
  custom_address?: string | null;
  custom_city?: string | null;
  custom_state?: string | null;
  location_notes?: string | null;
  status?: string | null;
}

interface Props {
  event: Event;
  isAdminUser: boolean;
}

export function SuggestUpdateSection({ event, isAdminUser }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm underline hover:no-underline text-inherit"
        >
          {showForm ? "Hide update form" : "Suggest an update"}
        </button>
        {isAdminUser && (
          <a
            href="/dashboard/admin/open-mics"
            className="text-sm underline hover:no-underline"
          >
            Admin queue
          </a>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <EventSuggestionForm event={event} />
        </div>
      )}
    </div>
  );
}
