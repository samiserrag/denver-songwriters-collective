"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Attendee {
  id: string;
  status: string;
  user: {
    id: string;
    slug: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface AttendeeListProps {
  eventId: string;
  /** Whether this event also has performer timeslots */
  hasTimeslots?: boolean;
  /** Number of confirmed performers (from timeslot claims) */
  performerCount?: number;
}

/**
 * Phase 4.43: Public attendee list for RSVP events
 *
 * Shows members who have RSVP'd with links to their profiles.
 * RSVP = audience "planning to attend" (not performer signup)
 */
export function AttendeeList({ eventId, hasTimeslots = false, performerCount = 0 }: AttendeeListProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchAttendees() {
      try {
        // Fetch confirmed RSVPs with profile info
        const { data, error: fetchError } = await supabase
          .from("event_rsvps")
          .select(`
            id,
            status,
            user:profiles!event_rsvps_user_id_fkey (
              id,
              slug,
              full_name,
              avatar_url
            )
          `)
          .eq("event_id", eventId)
          .eq("status", "confirmed")
          .order("created_at", { ascending: true });

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
  }, [eventId, supabase]);

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
    <div className="mb-8">
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
          const profile = attendee.user;
          const name = profile?.full_name || "Anonymous";
          const initial = name.charAt(0).toUpperCase();
          const profileUrl = profile?.id
            ? `/songwriters/${profile.slug || profile.id}`
            : null;

          const content = (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full hover:border-[var(--color-border-accent)] transition-colors">
              {profile?.avatar_url ? (
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
            </div>
          );

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
    </div>
  );
}
