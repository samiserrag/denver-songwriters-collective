"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddToCalendarButton } from "./AddToCalendarButton";

export interface RSVPCardEvent {
  id: string;
  title: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  cover_image_url: string | null;
}

export interface RSVPCardProps {
  rsvp: {
    id: string;
    status: "confirmed" | "waitlist" | "cancelled";
    waitlist_position: number | null;
    created_at: string | null;
  };
  event: RSVPCardEvent;
  /** Whether to show the cancel button */
  showCancel?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBA";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date TBA";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${minute} ${ampm}`;
}

function getStatusBadge(status: string, waitlistPosition: number | null) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Confirmed
        </span>
      );
    case "waitlist":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Waitlist{waitlistPosition ? ` #${waitlistPosition}` : ""}
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancelled
        </span>
      );
    default:
      return null;
  }
}

export function RSVPCard({ rsvp, event, showCancel = true }: RSVPCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel RSVP");
      }

      setShowCancelConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  // Build calendar dates if event has a specific date
  let calendarStartDate: Date | null = null;
  let calendarEndDate: Date | null = null;
  if (event.event_date) {
    const [year, month, day] = event.event_date.split("-").map(Number);
    if (event.start_time) {
      const [startHour, startMin] = event.start_time.split(":").map(Number);
      calendarStartDate = new Date(year, month - 1, day, startHour, startMin);
      if (event.end_time) {
        const [endHour, endMin] = event.end_time.split(":").map(Number);
        calendarEndDate = new Date(year, month - 1, day, endHour, endMin);
      } else {
        calendarEndDate = new Date(calendarStartDate.getTime() + 2 * 60 * 60 * 1000);
      }
    } else {
      calendarStartDate = new Date(year, month - 1, day);
      calendarEndDate = new Date(year, month - 1, day + 1);
    }
  }

  const venueLocation = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const formattedDate = formatDate(event.event_date);
  const formattedTime = formatTime(event.start_time);
  const isCancelled = rsvp.status === "cancelled";

  return (
    <div className={`rounded-xl border bg-[var(--color-bg-secondary)] overflow-hidden ${
      isCancelled ? "border-[var(--color-border-default)] opacity-70" : "border-[var(--color-border-default)]"
    }`}>
      <div className="p-4 sm:p-5">
        {/* Header with title and status */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/events/${event.id}`}
              className="text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)] transition-colors line-clamp-2"
            >
              {event.title}
            </Link>
            <div className="mt-1">
              {getStatusBadge(rsvp.status, rsvp.waitlist_position)}
            </div>
          </div>
        </div>

        {/* Event details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formattedDate}</span>
            {formattedTime && (
              <>
                <span className="text-[var(--color-text-tertiary)]">at</span>
                <span>{formattedTime}</span>
              </>
            )}
          </div>

          {event.venue_name && (
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="line-clamp-1">{event.venue_name}</span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-3 text-red-400 text-sm">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border-default)] flex flex-wrap items-center gap-3">
          {/* Add to Calendar - only for non-cancelled RSVPs with dates */}
          {!isCancelled && calendarStartDate && (
            <AddToCalendarButton
              title={event.title}
              description={`RSVP confirmed for ${event.title}`}
              location={venueLocation}
              startDate={calendarStartDate}
              endDate={calendarEndDate || undefined}
            />
          )}

          {/* View Event link */}
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            View Event
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Cancel button - only for active RSVPs */}
          {showCancel && !isCancelled && (
            <>
              {showCancelConfirm ? (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-[var(--color-text-secondary)]">Cancel RSVP?</span>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    {loading ? "..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="ml-auto text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
                >
                  Cancel RSVP
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
