import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { ServiceCard } from "@/components/studios";
import { SocialIcon, TipIcon, buildSocialLinks, buildTipLinks } from "@/components/profile";
import { ProfileComments } from "@/components/comments";
import type { Database } from "@/lib/supabase/database.types";
import type { StudioService } from "@/types";
import Image from "next/image";
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

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function StudioDetailPage({ params }: StudioDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Support both UUID and slug lookups for backward compatibility
  const { data: profile, error } = isUUID(id)
    ? await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .or("is_studio.eq.true,role.eq.studio")
        .single()
    : await supabase
        .from("profiles")
        .select("*")
        .eq("slug", id)
        .or("is_studio.eq.true,role.eq.studio")
        .single();

  if (error || !profile) {
    notFound();
  }

  // Phase 4.38: Canonical slug redirect - if accessed by UUID and profile has slug, redirect to canonical
  if (isUUID(id) && profile.slug) {
    redirect(`/studios/${profile.slug}`);
  }

  const studio = profile as DBProfile;

  const { data: dbServices } = await supabase
    .from("studio_services")
    .select("*")
    .eq("studio_id", id)
    .order("name", { ascending: true });

  const services: StudioService[] = (dbServices ?? []).map(mapDBServiceToService);

  // Query galleries linked to this studio via gallery_album_links (creator + collaborator)
  // with legacy fallback to created_by for albums not yet backfilled
  const { data: linkedAlbumIds } = await supabase
    .from("gallery_album_links")
    .select("album_id")
    .eq("target_type", "profile")
    .eq("target_id", studio.id);

  let galleries: Array<{ id: string; name: string; slug: string; cover_image_url: string | null; created_at: string }> = [];
  const linkIds = (linkedAlbumIds ?? []).map((l) => l.album_id);

  if (linkIds.length > 0) {
    const { data } = await supabase
      .from("gallery_albums")
      .select("id, name, slug, cover_image_url, created_at")
      .in("id", linkIds)
      .eq("is_published", true)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });
    galleries = data ?? [];
  }

  // Legacy fallback: if link table returned nothing, fall back to created_by query
  if (galleries.length === 0) {
    const { data: legacyData } = await supabase
      .from("gallery_albums")
      .select("id, name, slug, cover_image_url, created_at")
      .eq("created_by", studio.id)
      .eq("is_published", true)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });
    galleries = legacyData ?? [];
  }

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

          {/* Gallery Albums Section */}
          {galleries.length > 0 && (
            <section className="mb-12" data-testid="galleries-created-section">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Gallery Albums</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {galleries.map((album) => (
                  <Link
                    key={album.id}
                    href={`/gallery/${album.slug}`}
                    className="group block rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    <div className="relative aspect-[4/3] w-full bg-[var(--color-bg-tertiary)]">
                      {album.cover_image_url ? (
                        <Image
                          src={album.cover_image_url}
                          alt={album.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors truncate">
                        {album.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        {new Date(album.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
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
