import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import BookStudioForm from "@/components/booking/BookStudioForm";
export const dynamic = "force-dynamic";

interface BookingPageProps {
  params: Promise<{ id: string; serviceId: string }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { id, serviceId } = await params;

  const supabase = await createSupabaseServerClient();

  // Fetch studio service
  const { data: service } = await supabase
    .from("studio_services")
    .select("*")
    .eq("id", serviceId)
    .eq("studio_id", id)
    .single();

  if (!service) {
    return (
      <PageContainer className="py-24 text-center text-red-400">
        <p>Service not found.</p>
      </PageContainer>
    );
  }

  return (
    <>
      <HeroSection minHeight="sm">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic">
            Book a Service
          </h1>
          <p className="text-neutral-300 mt-2">
            Choose a date and time for your session.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer className="py-16">
        <BookStudioForm
          serviceId={serviceId}
          serviceName={service.name}
          durationMin={service.duration_min}
          priceCents={service.price_cents}
        />
      </PageContainer>
    </>
  );
}
