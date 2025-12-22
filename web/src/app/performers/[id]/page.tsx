import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import { SocialIcon, TipIcon, buildSocialLinks, buildTipLinks } from "@/components/profile";
import type { Database } from "@/lib/supabase/database.types";
import Link from "next/link";
export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface PerformerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformerDetailPage({ params }: PerformerDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Query using identity flags with legacy role fallback
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .or("is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)")
    .single();

  if (error || !profile) {
    notFound();
  }

  const performer = profile as DBProfile;

  // Build social and tip links using shared helpers
  const socialLinks = buildSocialLinks(performer);
  const tipLinks = buildTipLinks(performer);

  return (
    <>
      <HeroSection minHeight="auto">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <PerformerAvatar
              src={performer.avatar_url ?? undefined}
              alt={performer.full_name ?? "Performer"}
              size="lg"
            />
            <div>
              <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
                {performer.full_name ?? "Anonymous Performer"}
              </h1>

              {/* Identity badges - flag-based (no role display except for legacy fallback) */}
              <div className="flex flex-wrap gap-2 mb-4">
                {performer.is_songwriter && (
                  <span className="px-3 py-1 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm">
                    🎵 Songwriter / Musician
                  </span>
                )}
                {(performer.is_host || performer.role === "host") && (
                  <span className="px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                    🎤 Open Mic Host
                  </span>
                )}
                {performer.is_studio && (
                  <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                    🎚️ Recording Studio
                  </span>
                )}
                {/* Fan badge - low prominence, only show if no other badges */}
                {performer.is_fan && !performer.is_songwriter && !performer.is_host && !performer.is_studio && (
                  <span className="px-3 py-1 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-tertiary)] text-sm">
                    Music Supporter
                  </span>
                )}
              </div>

              {/* Collaboration & Availability Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {performer.open_to_collabs && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Open to Collaborations
                  </span>
                )}
                {performer.interested_in_cowriting && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Interested in Co-writing
                  </span>
                )}
                {performer.available_for_hire && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Available for Hire
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
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">About</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-3xl">
              {performer.bio ?? "This performer hasn't added a bio yet."}
            </p>
          </section>

          {/* Genres Section */}
          {performer.genres && performer.genres.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {performer.genres.map((genre) => (
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
          {performer.instruments && performer.instruments.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Instruments & Skills</h2>
              <div className="flex flex-wrap gap-2">
                {performer.instruments.map((instrument) => (
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

          {/* Specialties Section */}
          {performer.specialties && performer.specialties.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Specialties</h2>
              <div className="flex flex-wrap gap-2">
                {performer.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="px-3 py-1.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Favorite Open Mic */}
          {performer.favorite_open_mic && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Favorite Open Mic</h2>
              <p className="text-[var(--color-text-secondary)]">{performer.favorite_open_mic}</p>
            </section>
          )}

          {/* Song Links Section */}
          {performer.song_links && performer.song_links.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Listen to My Music</h2>
              <div className="grid gap-3 max-w-xl">
                {performer.song_links.map((link, index) => {
                  // Determine the platform icon based on URL
                  const getPlatformInfo = (url: string) => {
                    if (url.includes("spotify")) return { name: "Spotify", color: "bg-[#1DB954]" };
                    if (url.includes("soundcloud")) return { name: "SoundCloud", color: "bg-[#FF5500]" };
                    if (url.includes("youtube") || url.includes("youtu.be")) return { name: "YouTube", color: "bg-[#FF0000]" };
                    if (url.includes("bandcamp")) return { name: "Bandcamp", color: "bg-[#1DA0C3]" };
                    if (url.includes("apple")) return { name: "Apple Music", color: "bg-[#FA2D48]" };
                    return { name: "Listen", color: "bg-[var(--color-accent-muted)]" };
                  };
                  const platform = getPlatformInfo(link);
                  return (
                    <Link
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg ${platform.color} hover:opacity-90 text-white transition-opacity`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="font-medium">{platform.name}</span>
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tip/Support Section */}
          {tipLinks.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Support This Artist</h2>
              <p className="text-[var(--color-text-tertiary)] mb-4">Show your appreciation with a tip!</p>
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
                    {tip.handle && <span className="text-white/80">{tip.handle}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Upcoming Performances</h2>
            <p className="text-[var(--color-text-tertiary)]">
              Check back soon for upcoming show dates.
            </p>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
