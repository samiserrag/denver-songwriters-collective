import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventGrid } from "@/components/events";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Event } from "@/types";

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];

function mapDBEventToEvent(dbEvent: DBEvent): Event {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description ?? undefined,
    date: dbEvent.event_date,
    time: dbEvent.start_time,
    venue: dbEvent.venue_name ?? "TBA",
    location: dbEvent.venue_address ?? undefined,
  };
}

export default async function EventsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: dbEvents } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  const events: Event[] = (dbEvents ?? []).map(mapDBEventToEvent);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-6">
            Upcoming Events
          </h1>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <EventGrid events={events} />
      </PageContainer>
    </>
  );
}
