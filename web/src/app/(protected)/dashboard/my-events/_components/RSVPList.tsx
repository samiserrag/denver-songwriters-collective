"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

/**
 * Format a date key for short display.
 * E.g., "2026-01-18" -> "Sat, Jan 18"
 */
function formatDateKeyShort(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

interface RSVPListProps {
  eventId: string;
  capacity: number | null;
  isRecurring?: boolean;
  availableDates?: string[];
  initialDateKey?: string;
}

interface RSVPUser {
  id: string;
  status: string;
  waitlist_position: number | null;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Phase 5.02: RSVPList — Host-visible RSVP list with date-scoping
 *
 * For recurring events:
 * - Shows date selector to pick occurrence
 * - Fetches RSVPs only for selected date_key
 * - Does NOT aggregate across occurrences
 */
export default function RSVPList({
  eventId,
  capacity,
  isRecurring = false,
  availableDates = [],
  initialDateKey,
}: RSVPListProps) {
  const [selectedDate, setSelectedDate] = useState(initialDateKey || availableDates[0] || "");
  const [data, setData] = useState<{
    confirmed: RSVPUser[];
    waitlist: RSVPUser[];
    total_confirmed: number;
    total_waitlist: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRSVPs = async () => {
      setLoading(true);
      try {
        // Phase 5.02: Pass date_key for occurrence-specific RSVPs
        const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
        const res = await fetch(`/api/my-events/${eventId}/rsvps${dateParam}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch RSVPs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRSVPs();
  }, [eventId, selectedDate]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-[var(--color-bg-secondary)] rounded-lg"></div>;
  }

  if (!data) {
    return <p className="text-[var(--color-text-secondary)]">Failed to load attendees</p>;
  }

  const remaining = capacity ? Math.max(0, capacity - data.total_confirmed) : null;

  return (
    <div className="space-y-4">
      {/* Date selector for recurring events */}
      {isRecurring && availableDates.length > 1 && (
        <div>
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">
            Select occurrence:
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-3 py-2 text-[var(--color-text-primary)]"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDateKeyShort(date)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
        <div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{data.total_confirmed}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {capacity ? `of ${capacity} confirmed` : "confirmed"}
          </div>
        </div>
        {data.total_waitlist > 0 && (
          <div className="text-right">
            <div className="text-xl font-bold text-[var(--color-text-accent)]">{data.total_waitlist}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">waitlist</div>
          </div>
        )}
      </div>

      {remaining !== null && remaining > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {remaining} spot{remaining !== 1 ? "s" : ""} remaining
        </p>
      )}

      {/* Confirmed List */}
      {data.confirmed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Confirmed</h3>
          <ul className="space-y-2">
            {data.confirmed.map((rsvp) => (
              <li key={rsvp.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-900/50 text-green-400 rounded-full flex items-center justify-center text-sm">
                  {rsvp.user?.avatar_url ? (
                    <Image src={rsvp.user.avatar_url} alt="" width={32} height={32} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    rsvp.user?.full_name?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <span className="text-[var(--color-text-primary)] text-sm">{rsvp.user?.full_name || "Anonymous"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Waitlist */}
      {data.waitlist.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-accent)] mb-2">Waitlist</h3>
          <ul className="space-y-2">
            {data.waitlist.map((rsvp, index) => (
              <li key={rsvp.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <span className="text-[var(--color-text-secondary)] text-sm">{rsvp.user?.full_name || "Anonymous"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.confirmed.length === 0 && data.waitlist.length === 0 && (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-4">
          No RSVPs yet
        </p>
      )}
    </div>
  );
}
