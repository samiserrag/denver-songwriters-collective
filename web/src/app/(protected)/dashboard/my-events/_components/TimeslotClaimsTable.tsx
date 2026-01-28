"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

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

interface ClaimData {
  id: string;
  timeslot_id: string;
  member_id: string | null;
  performer_name: string | null;
  performer_email: string | null;
  status: string;
  created_at: string;
  slot_index: number | null;
  date_key: string | null;
  start_offset_minutes: number | null;
  duration_minutes: number | null;
  is_guest: boolean;
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    slug: string | null;
  } | null;
}

interface TimeslotClaimsTableProps {
  eventId: string;
  isRecurring: boolean;
  availableDates: string[];
  initialDateKey?: string;
}

/**
 * Phase 5.02: TimeslotClaimsTable — Host-visible performer signup management
 *
 * Features:
 * - List all claims for the event, grouped by date
 * - Date selector for recurring events
 * - Show: slot number, performer name, status, signup time
 * - Actions: Remove/Cancel claim
 * - Displays guest email when available (for host contact)
 */
export default function TimeslotClaimsTable({
  eventId,
  isRecurring,
  availableDates,
  initialDateKey,
}: TimeslotClaimsTableProps) {
  const [selectedDate, setSelectedDate] = React.useState(initialDateKey || availableDates[0] || "");
  const [claims, setClaims] = React.useState<ClaimData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [removingClaimId, setRemovingClaimId] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{
    totalClaims: number;
    activeClaims: number;
    futureClaims: number;
    pastClaims: number;
  }>({ totalClaims: 0, activeClaims: 0, futureClaims: 0, pastClaims: 0 });

  const fetchClaims = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
      const res = await fetch(`/api/my-events/${eventId}/claims${dateParam}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch claims");
      }
      const data = await res.json();
      setClaims(data.claims || []);
      setStats({
        totalClaims: data.totalClaims || 0,
        activeClaims: data.activeClaims || 0,
        futureClaims: data.futureClaims || 0,
        pastClaims: data.pastClaims || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedDate]);

  React.useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleRemoveClaim = async (claimId: string) => {
    if (!confirm("Remove this performer from the lineup? They will be notified.")) {
      return;
    }

    setRemovingClaimId(claimId);
    try {
      const res = await fetch(`/api/my-events/${eventId}/claims`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove claim");
      }

      // Refresh claims list
      await fetchClaims();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove claim");
    } finally {
      setRemovingClaimId(null);
    }
  };

  const formatSlotTime = (offsetMinutes: number | null, durationMinutes: number | null): string => {
    if (offsetMinutes === null) return "";
    const hours = Math.floor(offsetMinutes / 60);
    const mins = offsetMinutes % 60;
    const endOffset = offsetMinutes + (durationMinutes || 0);
    const endHours = Math.floor(endOffset / 60);
    const endMins = endOffset % 60;

    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return m > 0 ? `${displayH}:${m.toString().padStart(2, "0")}${period}` : `${displayH}${period}`;
    };

    return `${formatTime(hours, mins)} - ${formatTime(endHours, endMins)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            Confirmed
          </span>
        );
      case "performed":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Performed
          </span>
        );
      case "waitlist":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Waitlist
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 line-through">
            Cancelled
          </span>
        );
      case "no_show":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            No-show
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-[var(--color-bg-tertiary)] rounded w-1/3"></div>
        <div className="h-20 bg-[var(--color-bg-tertiary)] rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300">
        {error}
      </div>
    );
  }

  // Filter to active claims for display
  const activeClaims = claims.filter(c =>
    c.status === "confirmed" || c.status === "performed" || c.status === "waitlist"
  );

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎸</span>
          <h3 className="font-semibold text-[var(--color-text-primary)]">Performer Signups</h3>
        </div>
        {stats.activeClaims > 0 && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            {stats.futureClaims} upcoming · {stats.pastClaims} past
          </div>
        )}
      </div>

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

      {/* Claims list */}
      {activeClaims.length === 0 ? (
        <div className="text-center py-6 text-[var(--color-text-secondary)]">
          <p className="text-sm">No signups yet for this date</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {activeClaims.map((claim) => (
            <li
              key={claim.id}
              className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                {/* Slot number */}
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] flex items-center justify-center text-sm font-medium">
                  {(claim.slot_index ?? 0) + 1}
                </div>

                {/* Performer info */}
                <div>
                  <div className="flex items-center gap-2">
                    {/* Avatar (if member) */}
                    {claim.profiles?.avatar_url && (
                      <Image
                        src={claim.profiles.avatar_url}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    )}

                    {/* Name with link (if member) */}
                    {claim.profiles?.slug ? (
                      <Link
                        href={`/songwriters/${claim.profiles.slug}`}
                        className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                      >
                        {claim.profiles.full_name || claim.performer_name || "Unknown"}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {claim.performer_name || "Unknown"}
                        {claim.is_guest && (
                          <span className="text-[var(--color-text-tertiary)]"> (guest)</span>
                        )}
                      </span>
                    )}

                    {getStatusBadge(claim.status)}
                  </div>

                  {/* Time and email */}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    {claim.start_offset_minutes !== null && (
                      <span>{formatSlotTime(claim.start_offset_minutes, claim.duration_minutes)}</span>
                    )}
                    {claim.is_guest && claim.performer_email && (
                      <>
                        <span>·</span>
                        <a
                          href={`mailto:${claim.performer_email}`}
                          className="hover:text-[var(--color-text-accent)] underline"
                        >
                          {claim.performer_email}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {(claim.status === "confirmed" || claim.status === "waitlist") && (
                <button
                  onClick={() => handleRemoveClaim(claim.id)}
                  disabled={removingClaimId === claim.id}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                >
                  {removingClaimId === claim.id ? "..." : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Past claims note (when viewing "all") */}
      {!selectedDate && stats.pastClaims > 0 && (
        <p className="text-xs text-[var(--color-text-tertiary)] italic">
          Past signups ({stats.pastClaims}) are preserved for historical records.
        </p>
      )}
    </div>
  );
}
