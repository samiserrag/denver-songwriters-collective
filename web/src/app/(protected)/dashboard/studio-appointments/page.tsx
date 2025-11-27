import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import type { StudioOwnedAppointment, AppointmentStatus } from "@/types";
import type { Database } from "@/lib/supabase/database.types";
import { StudioAppointmentCard } from "@/components/appointments";

type DBAppt = Database["public"]["Tables"]["studio_appointments"]["Row"];
type DBService = Database["public"]["Tables"]["studio_services"]["Row"];
type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function StudioAppointmentsPage() {
  const supabase = await createSupabaseServerClient();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <PageContainer className="py-24 text-center text-red-400">
        <p>Not authenticated.</p>
      </PageContainer>
    );
  }

  // Query: appointments → services → performer profile
  const { data } = await supabase
    .from("studio_appointments")
    .select(`
      *,
      service:studio_services(
        id,
        name,
        studio_id
      ),
      performer:profiles(
        id,
        full_name
      )
    `)
    .order("appointment_time", { ascending: true });

  const owned = (data ?? []).filter((row: any) => row.service?.studio_id === user.id);

  const appointments: StudioOwnedAppointment[] = owned.map(
    (row: {
      id: string;
      status: AppointmentStatus;
      appointment_time: string;
      service: DBService;
      performer: DBProfile | null;
    }) => ({
      id: row.id,
      status: row.status,
      appointment_time: row.appointment_time,
      service_name: row.service.name,
      performer_name: row.performer?.full_name ?? null,
    })
  );

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic">
            Studio Appointments
          </h1>
          <p className="text-neutral-300 mt-3">
            Manage your upcoming recording sessions.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer className="py-12 space-y-6">
        {appointments.length === 0 ? (
          <p className="text-neutral-400">
            No appointments yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {appointments.map((appt) => (
              <StudioAppointmentCard key={appt.id} appointment={appt} />
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
