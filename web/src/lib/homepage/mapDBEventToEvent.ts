import type { Database } from "@/lib/supabase/database.types";
import type { Event } from "@/types";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];

export function mapDBEventToEvent(
  dbEvent: DBEvent & { rsvp_count?: number; claimed_slots?: number }
): Event {
  // For timeslot events, use total_slots as capacity and claimed_slots as rsvp_count.
  const effectiveCapacity = dbEvent.has_timeslots ? dbEvent.total_slots : dbEvent.capacity;
  const effectiveRsvpCount = dbEvent.has_timeslots
    ? (dbEvent.claimed_slots ?? 0)
    : (dbEvent.rsvp_count ?? 0);

  return {
    // Preserve full DB event row so card-critical fields (verification/location/age)
    // remain available in homepage CSC rail cards.
    ...dbEvent,
    visibility: dbEvent.visibility as "public" | "invite_only",
    description: dbEvent.description ?? undefined,
    date: dbEvent.event_date,
    event_date: dbEvent.event_date,
    time: dbEvent.start_time,
    start_time: dbEvent.start_time,
    end_time: dbEvent.end_time,
    // Recurrence fields are critical for HappeningCard schedule computation.
    day_of_week: dbEvent.day_of_week,
    recurrence_rule: dbEvent.recurrence_rule,
    venue: dbEvent.venue_name ?? "TBA",
    venue_address: dbEvent.venue_address ?? undefined,
    location: dbEvent.venue_address ?? undefined,
    capacity: effectiveCapacity,
    rsvp_count: effectiveRsvpCount,
    imageUrl: dbEvent.cover_image_url ?? undefined,
  };
}
