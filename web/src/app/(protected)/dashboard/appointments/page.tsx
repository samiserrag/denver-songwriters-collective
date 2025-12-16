import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { AppointmentCard } from "@/components/appointments";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type DBAppt = Database["public"]["Tables"]["studio_appointments"]["Row"];
type DBService = Database["public"]["Tables"]["studio_services"]["Row"];
type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function PerformerAppointmentsPage() {
  const supabase = await createSupabaseServerClient();

  // Get user
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) {
    return (
      <PageContainer className="py-24 text-center text-red-400">
        <p>Not authenticated.</p>
      </PageContainer>
    );
  }

  // Fetch appointments for this performer
  const { data: appointments } = await supabase
    .from("studio_appointments")
    .select(`
      *,
      service: studio_services (*),
      studio: studio_services(studio_id, studio:profiles!studio_id(*))
    `)
    .eq("performer_id", user.id)
    .order("appointment_time", { ascending: true });

  const appts = (appointments ?? []).map((a) => {
    const service = a.service as unknown as DBService;
    const studioProfile = (a as any).studio.studio as DBProfile;

    return {
      id: a.id,
      service_name: service.name,
      studio_name: studioProfile.full_name ?? "Studio",
      appointment_time: a.appointment_time,
      status: a.status,
    };
  });

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            Your Booked Sessions
          </h1>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl">
            View all your upcoming and past studio appointments.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 space-y-6">
          {appts.length === 0 ? (
            <p className="text-[var(--color-text-tertiary)]">
              You have no booked appointments yet.
            </p>
          ) : (
            appts.map((a) => (
              <AppointmentCard key={a.id} appt={a} />
            ))
          )}
        </div>
      </PageContainer>
    </>
  );
}
