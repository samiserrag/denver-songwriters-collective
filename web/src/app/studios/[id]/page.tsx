import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { ServiceCard } from "@/components/studios";
import { SocialIcon, TipIcon, buildSocialLinks, buildTipLinks } from "@/components/profile";
import { ProfileComments } from "@/components/comments";
import type { Database } from "@/lib/supabase/database.types";
import type { StudioService } from "@/types";
import Link from "next/link";
export const dynamic = "force-dynamic";

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

  // Query using identity flags with legacy role fallback
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .or("is_studio.eq.true,role.eq.studio")
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

  // Build social and tip links
  const socialLinks = buildSocialLinks(studio);
  const tipLinks = buildTipLinks(studio);

  return (
    <>
      <HeroSection minHeight="auto">
        <PageContainer>
          <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            {studio.full_name ?? "Studio"}
          </h1>

          {/* Identity badges - flag-based */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
              🎚️ Recording Studio
            </span>
            {studio.is_songwriter && (
              <span className="px-3 py-1 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm">
                🎵 Also a Songwriter
              </span>
            )}
            {(studio.is_host || studio.role === "host") && (
              <span className="px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                🎤 Hosts Open Mics
              </span>
            )}
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link) => (
                <Link
                  key={link.type}
                  href={link.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent-muted)] hover:bg-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  title={link.label}
                >
                  <SocialIcon type={link.type} />
                  <span className="text-sm">{link.label}</span>
                </Link>
              ))}
            </div>
          )}
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">About</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-3xl">
              {studio.bio ?? "This studio hasn't added a description yet."}
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">Services</h2>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} studioId={id} />
                ))}
              </div>
            ) : (
              <p className="text-[var(--color-text-tertiary)]">No services listed yet.</p>
            )}
          </section>

          {/* Genres Section */}
          {studio.genres && studio.genres.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {studio.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Instruments & Skills Section */}
          {studio.instruments && studio.instruments.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Instruments & Skills</h2>
              <div className="flex flex-wrap gap-2">
                {studio.instruments.map((instrument) => (
                  <span
                    key={instrument}
                    className="px-3 py-1.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm"
                  >
                    {instrument}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Support Section (Tipping) */}
          {tipLinks.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Support This Studio</h2>
              <p className="text-[var(--color-text-tertiary)] mb-4">Show your appreciation!</p>
              <div className="flex flex-wrap gap-3">
                {tipLinks.map((tip) => (
                  <Link
                    key={tip.type}
                    href={tip.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${tip.color} hover:opacity-90 text-white transition-opacity`}
                  >
                    <TipIcon type={tip.type} />
                    <span className="font-medium">{tip.label}</span>
                    {tip.handle && <span className="opacity-80">{tip.handle}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Profile Comments Section */}
          <ProfileComments profileId={studio.id} profileOwnerId={studio.id} />
        </div>
      </PageContainer>
    </>
  );
}
