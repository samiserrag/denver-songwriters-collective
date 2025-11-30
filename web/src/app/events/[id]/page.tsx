import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { EventSlotsPanel } from "@/components/events";
import type { Database } from "@/lib/supabase/database.types";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];
type DBEventSlot = Database["public"]["Tables"]["event_slots"]["Row"];

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !event) {
    notFound();
  }

  const dbEvent = event as DBEvent;

  // Fetch slots for this event
  const { data: slotsData } = await supabase.rpc("rpc_get_all_slots_for_event", {
    event_id: id,
  });

  const slots = (slotsData as DBEventSlot[]) ?? [];

  return (
    <>
      <HeroSection minHeight="lg">
        <PageContainer>
          <div className="max-w-3xl">
            <p className="text-gold-400 font-medium mb-2">
              {dbEvent.event_date} • {dbEvent.start_time}
            </p>
            <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
              {dbEvent.title}
            </h1>
            <p className="text-neutral-300 text-lg mb-6">
              {dbEvent.venue_name ?? "Venue TBA"}
              {dbEvent.venue_address && ` • ${dbEvent.venue_address}`}
            </p>
            {dbEvent.is_showcase && (
              <span className="inline-block px-3 py-1 bg-gold-500/20 text-gold-400 rounded-full text-sm font-medium">
                Showcase Event
              </span>
            )}
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">About This Event</h2>
            <p className="text-neutral-300 leading-relaxed">
              {dbEvent.description ?? "More details coming soon."}
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">Event Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900 rounded-lg p-6">
                <p className="text-neutral-400 text-sm mb-1">Date</p>
                <p className="text-white text-lg">{dbEvent.event_date}</p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-6">
                <p className="text-neutral-400 text-sm mb-1">Time</p>
                <p className="text-white text-lg">
                  {dbEvent.start_time} - {dbEvent.end_time}
                </p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-6">
                <p className="text-neutral-400 text-sm mb-1">Venue</p>
                <p className="text-white text-lg">{dbEvent.venue_name ?? "TBA"}</p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-6">
                <p className="text-neutral-400 text-sm mb-1">Type</p>
                <p className="text-white text-lg">
                  {dbEvent.is_showcase ? "Showcase" : "Open Mic"}
                </p>
              </div>
            </div>
          </section>

          <EventSlotsPanel eventId={dbEvent.id} slots={slots} />
        </div>
      </PageContainer>
    </>
  );
}
