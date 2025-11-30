import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { ServiceCard } from "@/components/studios";
import type { Database } from "@/lib/supabase/database.types";
import type { StudioService } from "@/types";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];
type DBService = Database["public"]["Tables"]["studio_services"]["Row"];

interface StudioDetailPageProps {
  params: Promise<{ id: string }>;
}

function mapDBServiceToService(service: DBService): StudioService {
  return {
    id: service.id,
    name: service.name,
    description: service.description ?? undefined,
    duration: `${service.duration_min} min`,
    price: service.price_cents / 100,
  };
}

export default async function StudioDetailPage({ params }: StudioDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "studio")
    .single();

  if (error || !profile) {
    notFound();
  }

  const studio = profile as DBProfile;

  const { data: dbServices } = await supabase
    .from("studio_services")
    .select("*")
    .eq("studio_id", id)
    .order("name", { ascending: true });

  const services: StudioService[] = (dbServices ?? []).map(mapDBServiceToService);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            {studio.full_name ?? "Studio"}
          </h1>
          <p className="text-neutral-400">Recording Studio</p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">About</h2>
            <p className="text-neutral-300 leading-relaxed max-w-3xl">
              {studio.bio ?? "This studio hasn't added a description yet."}
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">Services</h2>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} studioId={id} />
                ))}
              </div>
            ) : (
              <p className="text-neutral-400">No services listed yet.</p>
            )}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
