"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface AttendeesTabProps {
  eventId: string;
  capacity: number | null;
  isRecurring: boolean;
  availableDates: string[];
  initialDateKey?: string;
  canRemoveAttendees?: boolean;
}

interface RSVPUser {
  id: string;
  status: string;
  waitlist_position: number | null;
  created_at: string;
  guest_name: string | null;
  guest_email: string | null;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    slug?: string | null;
  } | null;
}

/**
 * Format a date key for display.
 * E.g., "2026-01-18" -> "Saturday, January 18"
 */
function formatDateKeyLong(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Phase 5.14: Full-width Attendees tab with profile cards
 *
 * Shows RSVPs in a spacious layout with:
 * - Profile avatars and names (linked to profiles for members)
 * - Guest emails as mailto links
 * - RSVP timestamps
 * - Confirmed vs waitlist sections
 */
export default function AttendeesTab({
  eventId,
  capacity,
  isRecurring,
  availableDates,
  initialDateKey,
  canRemoveAttendees = false,
}: AttendeesTabProps) {
  const [selectedDate, setSelectedDate] = useState(initialDateKey || availableDates[0] || "");
  const [data, setData] = useState<{
    confirmed: RSVPUser[];
    waitlist: RSVPUser[];
    total_confirmed: number;
    total_waitlist: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveRsvp, setConfirmRemoveRsvp] = useState<{ id: string; name: string } | null>(null);

  // Sync with parent's date when it changes
  useEffect(() => {
    if (initialDateKey && initialDateKey !== selectedDate) {
      setSelectedDate(initialDateKey);
    }
  }, [initialDateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchRSVPs = async () => {
      setLoading(true);
      try {
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

  const handleRemove = async () => {
    if (!confirmRemoveRsvp) return;
    const rsvpId = confirmRemoveRsvp.id;
    setRemovingId(rsvpId);
    setConfirmRemoveRsvp(null);
    try {
      const res = await fetch(`/api/my-events/${eventId}/rsvps`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvp_id: rsvpId }),
      });
      if (res.ok) {
        // Optimistically remove from local state
        setData((prev) => {
          if (!prev) return prev;
          const confirmed = prev.confirmed.filter((r) => r.id !== rsvpId);
          const waitlist = prev.waitlist.filter((r) => r.id !== rsvpId);
          return {
            confirmed,
            waitlist,
            total_confirmed: confirmed.length,
            total_waitlist: waitlist.length,
          };
        });
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Failed to remove RSVP");
      }
    } catch {
      alert("Failed to remove RSVP");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-12 bg-[var(--color-bg-secondary)] rounded-lg"></div>
        <div className="animate-pulse h-64 bg-[var(--color-bg-secondary)] rounded-lg"></div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-[var(--color-text-secondary)]">Failed to load attendees</p>;
  }

  const remaining = capacity ? Math.max(0, capacity - data.total_confirmed) : null;

  return (
    <div className="space-y-6">
      {/* Date selector for recurring events */}
      {isRecurring && availableDates.length > 1 && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            📅 Viewing attendees for:
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full max-w-xs text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDateKeyLong(date)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">{data.total_confirmed}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Confirmed</div>
        </div>
        {data.total_waitlist > 0 && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="text-3xl font-bold text-[var(--color-text-accent)]">{data.total_waitlist}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Waitlist</div>
          </div>
        )}
        {capacity && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">{capacity}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Capacity</div>
          </div>
        )}
        {remaining !== null && remaining > 0 && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="text-3xl font-bold text-emerald-500">{remaining}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Spots Left</div>
          </div>
        )}
      </div>

      {/* Confirmed attendees */}
      {data.confirmed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Confirmed ({data.confirmed.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.confirmed.map((rsvp) => (
              <AttendeeCard
                key={rsvp.id}
                rsvp={rsvp}
                type="confirmed"
                onRemove={canRemoveAttendees ? (id, name) => setConfirmRemoveRsvp({ id, name }) : undefined}
                isRemoving={removingId === rsvp.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Waitlist */}
      {data.waitlist.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-accent)] mb-4">
            Waitlist ({data.waitlist.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.waitlist.map((rsvp, index) => (
              <AttendeeCard
                key={rsvp.id}
                rsvp={rsvp}
                type="waitlist"
                position={index + 1}
                onRemove={canRemoveAttendees ? (id, name) => setConfirmRemoveRsvp({ id, name }) : undefined}
                isRemoving={removingId === rsvp.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data.confirmed.length === 0 && data.waitlist.length === 0 && (
        <div className="text-center py-12 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-[var(--color-text-secondary)] text-lg">No RSVPs yet</p>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-2">
            Share your event to get attendees.
          </p>
        </div>
      )}

      {/* Confirm remove dialog */}
      <ConfirmDialog
        isOpen={!!confirmRemoveRsvp}
        onClose={() => setConfirmRemoveRsvp(null)}
        onConfirm={handleRemove}
        title="Remove RSVP"
        message={`Remove ${confirmRemoveRsvp?.name || "this person"} from the attendee list? They will be notified. If there is a waitlist, the next person will be promoted.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}

interface AttendeeCardProps {
  rsvp: RSVPUser;
  type: "confirmed" | "waitlist";
  position?: number;
  onRemove?: (id: string, name: string) => void;
  isRemoving?: boolean;
}

function AttendeeCard({ rsvp, type, position, onRemove, isRemoving }: AttendeeCardProps) {
  const isGuest = !rsvp.user && rsvp.guest_name;
  const displayName = rsvp.user?.full_name || rsvp.guest_name || "Anonymous";
  const initial = displayName[0]?.toUpperCase() || "?";
  const profileSlug = rsvp.user?.slug || rsvp.user?.id;

  const rsvpDate = new Date(rsvp.created_at);
  const formattedDate = rsvpDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={`
      p-4 bg-[var(--color-bg-secondary)] border rounded-lg relative
      ${type === "confirmed"
        ? "border-emerald-500/30"
        : "border-[var(--color-accent-primary)]/30"
      }
    `}>
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={() => onRemove(rsvp.id, displayName)}
          disabled={isRemoving}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-500/20 text-[var(--color-text-tertiary)] hover:text-red-400 transition-colors disabled:opacity-50"
          title={`Remove ${displayName}`}
        >
          {isRemoving ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`
          w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium flex-shrink-0
          ${type === "confirmed"
            ? "bg-emerald-900/50 text-emerald-400"
            : "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]"
          }
        `}>
          {rsvp.user?.avatar_url ? (
            <Image
              src={rsvp.user.avatar_url}
              alt=""
              width={48}
              height={48}
              className="w-full h-full rounded-full object-cover"
            />
          ) : position !== undefined ? (
            <span>#{position}</span>
          ) : (
            initial
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {rsvp.user && profileSlug ? (
              <Link
                href={`/songwriters/${profileSlug}`}
                className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)] truncate"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-medium text-[var(--color-text-primary)] truncate">
                {displayName}
              </span>
            )}
            {isGuest && (
              <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] rounded-full">
                guest
              </span>
            )}
          </div>

          {/* Guest email */}
          {isGuest && rsvp.guest_email && (
            <a
              href={`mailto:${rsvp.guest_email}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline block truncate"
            >
              {rsvp.guest_email}
            </a>
          )}

          {/* RSVP timestamp */}
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            RSVP&apos;d {formattedDate}
          </div>
        </div>
      </div>
    </div>
  );
}
