"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface MemberAttendee {
  id: string;
  status: string;
  guest_name: null;
  guest_email: null;
  user: {
    id: string;
    slug: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface GuestAttendee {
  id: string;
  status: string;
  guest_name: string;
  guest_email: string;
  user: null;
}

type Attendee = MemberAttendee | GuestAttendee;

interface AttendeeListProps {
  eventId: string;
  /** Whether this event also has performer timeslots */
  hasTimeslots?: boolean;
  /** Number of confirmed performers (from timeslot claims) */
  performerCount?: number;
  /** Phase ABC6: date_key for per-occurrence RSVP scoping */
  dateKey?: string;
}

/**
 * Phase 4.43: Public attendee list for RSVP events
 *
 * Shows members who have RSVP'd with links to their profiles.
 * RSVP = audience "planning to attend" (not performer signup)
 */
export function AttendeeList({ eventId, hasTimeslots = false, performerCount = 0, dateKey }: AttendeeListProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchAttendees() {
      try {
        // Fetch confirmed RSVPs with profile info (members) and guest fields
        // Uses event_rsvps_user_id_profiles_fkey (FK to profiles, not auth.users)
        // Phase ABC6: Filter by date_key when provided for per-occurrence scoping
        let query = supabase
          .from("event_rsvps")
          .select(`
            id,
            status,
            guest_name,
            guest_email,
            user:profiles!event_rsvps_user_id_profiles_fkey (
              id,
              slug,
              full_name,
              avatar_url
            )
          `)
          .eq("event_id", eventId)
          .eq("status", "confirmed");

        if (dateKey) {
          query = query.eq("date_key", dateKey);
        }

        const { data, error: fetchError } = await query.order("created_at", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        // Type assertion for the joined data
        const typedData = (data || []) as unknown as Attendee[];
        setAttendees(typedData);
      } catch (err) {
        console.error("Error fetching attendees:", err);
        setError("Failed to load attendees");
      } finally {
        setLoading(false);
      }
    }

    fetchAttendees();
  }, [eventId, supabase, dateKey]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 w-32 bg-[var(--color-bg-tertiary)] rounded mb-3"></div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 bg-[var(--color-bg-tertiary)] rounded-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail - don't break the page
  }

  if (attendees.length === 0) {
    return null; // Don't show section if no attendees
  }

  return (
    <section id="attendees" className="mb-8">
      <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
        {hasTimeslots ? "Audience" : "Who's Coming"}
        <span className="ml-2 text-sm font-normal text-[var(--color-text-secondary)]">
          ({attendees.length} {attendees.length === 1 ? "person" : "people"})
          {hasTimeslots && performerCount > 0 && (
            <> · {performerCount} {performerCount === 1 ? "performer" : "performers"}</>
          )}
        </span>
      </h2>

      {/* RSVP meaning clarification */}
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        RSVP means you plan to attend. It is not a performer sign-up.
      </p>

      <div className="flex flex-wrap gap-2">
        {attendees.map((attendee) => {
          // Check if this is a guest RSVP (no user, has guest_name)
          const isGuest = attendee.user === null && attendee.guest_name !== null;
          const profile = attendee.user;
          const name = isGuest
            ? attendee.guest_name
            : (profile?.full_name || "Anonymous");
          const initial = name.charAt(0).toUpperCase();
          const profileUrl = !isGuest && profile?.id
            ? `/songwriters/${profile.slug || profile.id}`
            : null;

          const content = (
            <div className={`flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full ${profileUrl ? "hover:border-[var(--color-border-accent)]" : ""} transition-colors`}>
              {!isGuest && profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover object-top"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center text-xs font-medium text-[var(--color-accent-primary)]">
                  {initial}
                </div>
              )}
              <span className="text-sm text-[var(--color-text-primary)]">
                {name}
              </span>
              {isGuest && (
                <span className="text-xs text-[var(--color-text-tertiary)]">(guest)</span>
              )}
            </div>
          );

          // Members with profiles get links, guests don't
          if (profileUrl) {
            return (
              <Link key={attendee.id} href={profileUrl}>
                {content}
              </Link>
            );
          }

          return <div key={attendee.id}>{content}</div>;
        })}
      </div>
    </section>
  );
}
