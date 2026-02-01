"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface LineupTabProps {
  eventId: string;
  eventSlug: string | null;
  isRecurring: boolean;
  availableDates: string[];
  initialDateKey?: string;
}

interface ClaimData {
  id: string;
  status: string;
  slot_index: number;
  created_at: string;
  guest_name: string | null;
  guest_email: string | null;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    slug?: string | null;
  } | null;
  timeslot: {
    id: string;
    slot_index: number;
    slot_label: string | null;
    start_time: string | null;
  } | null;
}

/**
 * Format a date key for display.
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
 * Phase 5.14: Full-width Lineup tab with performer cards
 *
 * Shows performer signups in a spacious layout with:
 * - Profile avatars and names (linked to profiles for members)
 * - Guest emails as mailto links
 * - Slot assignments and times
 * - Status indicators (confirmed, waitlist, performed)
 * - Remove functionality
 */
export default function LineupTab({
  eventId,
  eventSlug,
  isRecurring,
  availableDates,
  initialDateKey,
}: LineupTabProps) {
  const [selectedDate, setSelectedDate] = useState(initialDateKey || availableDates[0] || "");
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync with parent's date when it changes
  useEffect(() => {
    if (initialDateKey && initialDateKey !== selectedDate) {
      setSelectedDate(initialDateKey);
    }
  }, [initialDateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true);
      setError(null);
      try {
        const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
        const res = await fetch(`/api/my-events/${eventId}/claims${dateParam}`);
        if (res.ok) {
          const data = await res.json();
          setClaims(data.claims || []);
        } else {
          setError("Failed to load lineup");
        }
      } catch (err) {
        console.error("Failed to fetch claims:", err);
        setError("Failed to load lineup");
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, [eventId, selectedDate]);

  const handleRemove = async (claimId: string) => {
    if (!confirm("Remove this performer from the lineup?")) return;

    try {
      const res = await fetch(`/api/my-events/${eventId}/claims?claim_id=${claimId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
      } else {
        alert("Failed to remove performer");
      }
    } catch {
      alert("Failed to remove performer");
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

  if (error) {
    return <p className="text-[var(--color-text-secondary)]">{error}</p>;
  }

  // Group claims by status
  const confirmed = claims.filter((c) => c.status === "confirmed");
  const waitlist = claims.filter((c) => c.status === "waitlist");
  const performed = claims.filter((c) => c.status === "performed");

  return (
    <div className="space-y-6">
      {/* Date selector for recurring events */}
      {isRecurring && availableDates.length > 1 && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            📅 Viewing lineup for:
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
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">{confirmed.length}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Confirmed</div>
        </div>
        {waitlist.length > 0 && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="text-3xl font-bold text-[var(--color-text-accent)]">{waitlist.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Waitlist</div>
          </div>
        )}
        {performed.length > 0 && (
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="text-3xl font-bold text-emerald-500">{performed.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Performed</div>
          </div>
        )}
      </div>

      {/* Lineup Control link */}
      {(confirmed.length > 0 || waitlist.length > 0) && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Ready to run your event?
          </p>
          <Link
            href={`/events/${eventSlug || eventId}/lineup${selectedDate ? `?date=${selectedDate}` : ""}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            🎬 Open Lineup Control
          </Link>
        </div>
      )}

      {/* Confirmed performers */}
      {confirmed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Confirmed Performers ({confirmed.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {confirmed.map((claim) => (
              <PerformerCard key={claim.id} claim={claim} onRemove={handleRemove} />
            ))}
          </div>
        </div>
      )}

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-accent)] mb-4">
            Waitlist ({waitlist.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitlist.map((claim, index) => (
              <PerformerCard key={claim.id} claim={claim} position={index + 1} onRemove={handleRemove} />
            ))}
          </div>
        </div>
      )}

      {/* Performed */}
      {performed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-emerald-500 mb-4">
            Already Performed ({performed.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {performed.map((claim) => (
              <PerformerCard key={claim.id} claim={claim} onRemove={handleRemove} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {claims.length === 0 && (
        <div className="text-center py-12 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <div className="text-4xl mb-4">🎤</div>
          <p className="text-[var(--color-text-secondary)] text-lg">No performers signed up yet</p>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-2">
            Share your event to get signups!
          </p>
        </div>
      )}
    </div>
  );
}

interface PerformerCardProps {
  claim: ClaimData;
  position?: number;
  onRemove: (claimId: string) => void;
}

function PerformerCard({ claim, position, onRemove }: PerformerCardProps) {
  const isGuest = !claim.user && claim.guest_name;
  const displayName = claim.user?.full_name || claim.guest_name || "Anonymous";
  const initial = displayName[0]?.toUpperCase() || "?";
  const profileSlug = claim.user?.slug || claim.user?.id;

  const slotLabel = claim.timeslot?.slot_label || `Slot ${(claim.timeslot?.slot_index ?? claim.slot_index) + 1}`;
  const slotTime = claim.timeslot?.start_time
    ? new Date(`2000-01-01T${claim.timeslot.start_time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const statusColors = {
    confirmed: "border-emerald-500/30 bg-emerald-900/10",
    waitlist: "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5",
    performed: "border-emerald-500/50 bg-emerald-900/20",
  };

  return (
    <div className={`p-4 border rounded-lg ${statusColors[claim.status as keyof typeof statusColors] || "border-[var(--color-border-default)]"}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`
          w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium flex-shrink-0
          ${claim.status === "confirmed" || claim.status === "performed"
            ? "bg-emerald-900/50 text-emerald-400"
            : "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]"
          }
        `}>
          {claim.user?.avatar_url ? (
            <Image
              src={claim.user.avatar_url}
              alt=""
              width={56}
              height={56}
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
          <div className="flex items-center gap-2 flex-wrap">
            {claim.user && profileSlug ? (
              <Link
                href={`/songwriters/${profileSlug}`}
                className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-medium text-[var(--color-text-primary)]">
                {displayName}
              </span>
            )}
            {isGuest && (
              <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] rounded-full">
                guest
              </span>
            )}
            {claim.status === "performed" && (
              <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                ✓ performed
              </span>
            )}
          </div>

          {/* Guest email */}
          {isGuest && claim.guest_email && (
            <a
              href={`mailto:${claim.guest_email}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline block truncate"
            >
              {claim.guest_email}
            </a>
          )}

          {/* Slot info */}
          <div className="flex items-center gap-2 mt-1 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium">{slotLabel}</span>
            {slotTime && <span>• {slotTime}</span>}
          </div>
        </div>

        {/* Remove button */}
        {claim.status !== "performed" && (
          <button
            onClick={() => onRemove(claim.id)}
            className="text-[var(--color-text-tertiary)] hover:text-red-500 transition-colors p-1"
            title="Remove from lineup"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
