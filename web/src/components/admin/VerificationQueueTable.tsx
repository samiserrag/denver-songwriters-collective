"use client";

/**
 * Phase 4.41: Admin Verification Queue Table
 *
 * Features:
 * - Default filter: Unconfirmed events (last_verified_at IS NULL, status != 'cancelled')
 * - High-signal filters: verification status, date, venue, search
 * - Row-level quick actions: Verify, Cancel, Delete
 * - Inline context: date/time, venue, verification pill, public link
 * - Hard delete guardrails: blocked if RSVPs or claims exist
 */

import { useState, useMemo } from "react";
import Link from "next/link";

// Verification status based on Phase 4.40 logic
type VerificationStatus = "unconfirmed" | "confirmed" | "cancelled";

interface QueueEvent {
  id: string;
  title: string;
  slug: string | null;
  status: string | null;
  event_type: string | null;
  event_date: string | null;
  day_of_week: string | null;
  recurrence_rule: string | null;
  start_time: string | null;
  signup_time: string | null;
  last_verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
  is_published: boolean | null;
  venues: {
    name: string | null;
    city: string | null;
  } | null;
  rsvp_count: number;
  claim_count: number;
}

interface Props {
  events: QueueEvent[];
  venues: string[];
}

type DateFilter = "all" | "upcoming" | "past";

export default function VerificationQueueTable({ events: initialEvents, venues }: Props) {
  const [events, setEvents] = useState(initialEvents);

  // Phase 4.41: Default to "unconfirmed" filter
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("unconfirmed");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get today's date in Denver timezone for date filtering
  const todayKey = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  }, []);

  // Compute verification status for each event (Phase 4.40 logic)
  const getVerificationStatus = (event: QueueEvent): VerificationStatus => {
    if (event.status === "cancelled") return "cancelled";
    if (event.last_verified_at) return "confirmed";
    return "unconfirmed";
  };

  // Get next occurrence date for recurring events
  const getEventDate = (event: QueueEvent): string | null => {
    if (event.event_date) return event.event_date;
    // For recurring events without a specific date, we can't determine date easily
    // Return null - they'll be treated as "no date" for filtering
    return null;
  };

  // Filter events based on all filters
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => getVerificationStatus(e) === statusFilter);
    }

    // Date filter
    if (dateFilter === "upcoming") {
      filtered = filtered.filter((e) => {
        const date = getEventDate(e);
        // Recurring events without event_date are considered "upcoming" (they have future occurrences)
        if (!date && e.day_of_week) return true;
        return date ? date >= todayKey : false;
      });
    } else if (dateFilter === "past") {
      filtered = filtered.filter((e) => {
        const date = getEventDate(e);
        // Recurring events are never "past"
        if (!date && e.day_of_week) return false;
        return date ? date < todayKey : false;
      });
    }

    // Venue filter
    if (venueFilter !== "all") {
      filtered = filtered.filter((e) => e.venues?.name === venueFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venues?.name?.toLowerCase().includes(q) ||
          e.venues?.city?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [events, statusFilter, dateFilter, venueFilter, search, todayKey]);

  // Count events by verification status
  const counts = useMemo(() => ({
    all: events.length,
    unconfirmed: events.filter((e) => getVerificationStatus(e) === "unconfirmed").length,
    confirmed: events.filter((e) => getVerificationStatus(e) === "confirmed").length,
    cancelled: events.filter((e) => getVerificationStatus(e) === "cancelled").length,
  }), [events]);

  // Verify action - sets last_verified_at
  const handleVerify = async (eventId: string) => {
    setUpdating(eventId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/open-mics/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, status: data.status, last_verified_at: data.last_verified_at }
              : e
          )
        );
      } else {
        const errData = await res.json();
        setError(`Failed to verify: ${errData.error || "Unknown error"}`);
      }
    } catch {
      setError("Error verifying event");
    } finally {
      setUpdating(null);
    }
  };

  // Unverify action - clears last_verified_at (marks as unconfirmed)
  const handleUnverify = async (eventId: string) => {
    setUpdating(eventId);
    setError(null);

    try {
      const res = await fetch("/api/admin/ops/events/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: [eventId],
          action: "unverify",
        }),
      });

      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, last_verified_at: null, verified_by: null }
              : e
          )
        );
      } else {
        const errData = await res.json();
        setError(`Failed to unverify: ${errData.error || "Unknown error"}`);
      }
    } catch {
      setError("Error unverifying event");
    } finally {
      setUpdating(null);
    }
  };

  // Cancel action - sets status to cancelled
  const handleCancel = async (eventId: string) => {
    if (!confirm("Are you sure you want to cancel this event? This will hide it from public views.")) {
      return;
    }

    setUpdating(eventId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/open-mics/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, status: data.status }
              : e
          )
        );
      } else {
        const errData = await res.json();
        setError(`Failed to cancel: ${errData.error || "Unknown error"}`);
      }
    } catch {
      setError("Error cancelling event");
    } finally {
      setUpdating(null);
    }
  };

  // Delete action - hard delete with guardrails
  const handleDelete = async (eventId: string) => {
    setUpdating(eventId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/open-mics/${eventId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Remove from local state
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setDeleteConfirm(null);
      } else {
        const errData = await res.json();
        setError(`Failed to delete: ${errData.error || "Unknown error"}`);
        setDeleteConfirm(null);
      }
    } catch {
      setError("Error deleting event");
      setDeleteConfirm(null);
    } finally {
      setUpdating(null);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  };

  const getScheduleDisplay = (event: QueueEvent): string => {
    if (event.event_date) {
      return formatDate(event.event_date) || "—";
    }
    if (event.day_of_week) {
      // Recurring: show day of week
      const dayLabel = event.day_of_week;
      if (event.recurrence_rule) {
        // Parse recurrence rule for ordinal (e.g., "1st", "2nd")
        const match = event.recurrence_rule.match(/BYDAY=(\d)(\w{2})/);
        if (match) {
          const ordinal = ["1st", "2nd", "3rd", "4th", "5th"][parseInt(match[1]) - 1] || "";
          return `${ordinal} ${dayLabel}`;
        }
        return `Every ${dayLabel}`;
      }
      return `Every ${dayLabel}`;
    }
    return "—";
  };

  // Verification status pill
  const VerificationPill = ({ event }: { event: QueueEvent }) => {
    const status = getVerificationStatus(event);

    if (status === "confirmed") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Confirmed
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border border-red-300 dark:border-red-500/30">
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
        Unconfirmed
      </span>
    );
  };

  // Check if delete is safe
  const canDelete = (event: QueueEvent): { safe: boolean; reason?: string } => {
    if (event.rsvp_count > 0) {
      return { safe: false, reason: `${event.rsvp_count} RSVP${event.rsvp_count > 1 ? "s" : ""}` };
    }
    if (event.claim_count > 0) {
      return { safe: false, reason: `${event.claim_count} timeslot claim${event.claim_count > 1 ? "s" : ""}` };
    }
    return { safe: true };
  };

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 rounded text-red-800 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by title or venue..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
        />

        {/* Filter row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Verification Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-secondary)]">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | "all")}
              className="px-3 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-sm text-[var(--color-text-primary)]"
            >
              <option value="unconfirmed">Unconfirmed ({counts.unconfirmed})</option>
              <option value="confirmed">Confirmed ({counts.confirmed})</option>
              <option value="cancelled">Cancelled ({counts.cancelled})</option>
              <option value="all">All ({counts.all})</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-secondary)]">Date:</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="px-3 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All</option>
              <option value="upcoming">Upcoming only</option>
              <option value="past">Past only</option>
            </select>
          </div>

          {/* Venue Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-text-secondary)]">Venue:</label>
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="px-3 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-sm text-[var(--color-text-primary)] max-w-[200px]"
            >
              <option value="all">All venues</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Showing {filteredEvents.length} of {events.length} events
      </div>

      {/* Table */}
      {filteredEvents.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)] py-8 text-center">
          No events match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-tertiary)] border-b border-white/10">
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const verificationStatus = getVerificationStatus(event);
                const isUpdating = updating === event.id;
                const deleteCheck = canDelete(event);
                const isConfirmingDelete = deleteConfirm === event.id;

                return (
                  <tr
                    key={event.id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    {/* Event title with public link */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {event.title}
                        </span>
                        <Link
                          href={`/open-mics/${event.slug || event.id}`}
                          target="_blank"
                          className="text-xs text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] flex items-center gap-1"
                        >
                          View public page
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </Link>
                      </div>
                    </td>

                    {/* Venue */}
                    <td className="px-3 py-2">
                      {event.venues?.name ? (
                        <div>
                          <span className="text-[var(--color-text-primary)]">{event.venues.name}</span>
                          {event.venues.city && (
                            <p className="text-xs text-[var(--color-text-tertiary)]">{event.venues.city}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">No venue set</span>
                      )}
                    </td>

                    {/* Schedule */}
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {getScheduleDisplay(event)}
                    </td>

                    {/* Time */}
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {formatTime(event.start_time)}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <VerificationPill event={event} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        {/* Verify button - only for unconfirmed events */}
                        {verificationStatus === "unconfirmed" && (
                          <button
                            onClick={() => handleVerify(event.id)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                          >
                            {isUpdating ? "..." : "Verify"}
                          </button>
                        )}

                        {/* Unverify button - only for confirmed events */}
                        {verificationStatus === "confirmed" && (
                          <button
                            onClick={() => handleUnverify(event.id)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                          >
                            {isUpdating ? "..." : "Unverify"}
                          </button>
                        )}

                        {/* Cancel button - only for non-cancelled events */}
                        {verificationStatus !== "cancelled" && (
                          <button
                            onClick={() => handleCancel(event.id)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded text-white text-xs font-medium"
                          >
                            {isUpdating ? "..." : "Cancel"}
                          </button>
                        )}

                        {/* Delete button */}
                        {!isConfirmingDelete ? (
                          <button
                            onClick={() => setDeleteConfirm(event.id)}
                            disabled={isUpdating || !deleteCheck.safe}
                            title={deleteCheck.safe ? "Delete event" : `Cannot delete: ${deleteCheck.reason}`}
                            className={`px-2.5 py-1 rounded text-xs font-medium ${
                              deleteCheck.safe
                                ? "bg-red-600 hover:bg-red-500 text-white"
                                : "bg-gray-600 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            Delete
                          </button>
                        ) : (
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => handleDelete(event.id)}
                              disabled={isUpdating}
                              className="px-2.5 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded text-white text-xs font-bold"
                            >
                              {isUpdating ? "..." : "Confirm Delete"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Delete blocked reason */}
                        {!deleteCheck.safe && (
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            ({deleteCheck.reason})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal would go here in a more polished version */}
    </div>
  );
}
