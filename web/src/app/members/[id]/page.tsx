import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { SongwriterAvatar } from "@/components/songwriters";
import { SocialIcon, TipIcon, buildSocialLinks, buildTipLinks } from "@/components/profile";
import { ProfileComments } from "@/components/comments";
import type { Database } from "@/lib/supabase/database.types";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface MemberDetailPageProps {
  params: Promise<{ id: string }>;
}

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Support both UUID and slug lookups
  // Query must have parentheses: (id = $1 OR slug = $1) AND is_public = true
  // to prevent bypassing is_public check
  let profile: DBProfile | null = null;

  if (isUUID(id)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .single();
    if (!error) profile = data;
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("slug", id)
      .eq("is_public", true)
      .single();
    if (!error) profile = data;
  }

  if (!profile) {
    notFound();
  }

  // Canonical slug redirect - if accessed by UUID and profile has slug, redirect to canonical
  if (isUUID(id) && profile.slug) {
    redirect(`/members/${profile.slug}`);
  }

  const member = profile as DBProfile;

  // Build social and tip links using shared helpers
  const socialLinks = buildSocialLinks(member);
  const tipLinks = buildTipLinks(member);

  // Determine identity badges to show
  // Note: legacy role enum is "performer" | "host" | "studio" | "admin" | "fan" | "member"
  // "songwriter" is not a valid role value - use "performer" for legacy compatibility
  const hasSongwriter = member.is_songwriter || member.role === "performer";
  const hasHost = member.is_host || member.role === "host";
  const hasStudio = member.is_studio || member.role === "studio";
  const hasFan = member.is_fan || member.role === "fan";
  const isFanOnly = hasFan && !hasSongwriter && !hasHost && !hasStudio;

  return (
    <>
      <HeroSection minHeight="auto">
        <PageContainer>
          {/* Profile Header - Centered layout with large avatar */}
          <div className="flex flex-col items-center text-center pt-8 pb-4">
            {/* Large Avatar */}
            <div className="mb-8">
              <SongwriterAvatar
                src={member.avatar_url ?? undefined}
                alt={member.full_name ?? "Member"}
                size="2xl"
                className="ring-4 ring-[var(--color-accent-primary)]/30 shadow-2xl"
              />
            </div>

            {/* Name */}
            <h1 className="text-[var(--color-text-accent)] text-4xl md:text-5xl lg:text-6xl font-[var(--font-family-serif)] italic mb-6">
              {member.full_name ?? "Anonymous Member"}
            </h1>

            {/* Identity badges */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {hasSongwriter && (
                <span className="px-4 py-1.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm font-medium">
                  🎵 Songwriter / Musician
                </span>
              )}
              {hasHost && (
                <span className="px-4 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                  🎤 Happenings Host
                </span>
              )}
              {hasStudio && (
                <span className="px-4 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                  🎚️ Recording Studio
                </span>
              )}
              {isFanOnly && (
                <span className="px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                  🎶 Music Supporter
                </span>
              )}
            </div>

            {/* Collaboration & Availability Badges - only show if relevant flags are set */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {member.open_to_collabs && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Open to Collaborations
                </span>
              )}
              {member.interested_in_cowriting && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Interested in Co-writing
                </span>
              )}
              {member.available_for_hire && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Available for Hire
                </span>
              )}
            </div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {socialLinks.map((link) => (
                  <Link
                    key={link.type}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent-muted)] hover:bg-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    title={link.label}
                  >
                    <SocialIcon type={link.type} />
                    <span className="text-sm font-medium">{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 max-w-4xl mx-auto">
          {/* About Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">About</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-lg">
              {member.bio ?? "This member hasn't added a bio yet."}
            </p>
          </section>

          {/* Genres and Instruments - only show if member is a songwriter/musician */}
          {hasSongwriter && ((member.genres && member.genres.length > 0) || (member.instruments && member.instruments.length > 0)) && (
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Genres Section */}
              {member.genres && member.genres.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Genres</h2>
                  <div className="flex flex-wrap gap-2">
                    {member.genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-4 py-2 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Instruments & Skills Section */}
              {member.instruments && member.instruments.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Instruments & Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {member.instruments.map((instrument) => (
                      <span
                        key={instrument}
                        className="px-4 py-2 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm font-medium"
                      >
                        {instrument}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Specialties Section - only show if member is a songwriter/musician */}
          {hasSongwriter && member.specialties && member.specialties.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Specialties</h2>
              <div className="flex flex-wrap gap-2">
                {member.specialties.map((specialty) => (
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

          {/* Favorite Open Mic - only show if member is a songwriter/musician */}
          {hasSongwriter && member.favorite_open_mic && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Favorite Open Mic</h2>
              <p className="text-[var(--color-text-secondary)]">{member.favorite_open_mic}</p>
            </section>
          )}

          {/* Song Links Section - only show if member is a songwriter/musician */}
          {hasSongwriter && member.song_links && member.song_links.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Listen to My Music</h2>
              <div className="grid gap-3 max-w-xl">
                {member.song_links.map((link, index) => {
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
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Support This Member</h2>
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

          {/* Profile Comments Section */}
          <ProfileComments profileId={member.id} profileOwnerId={member.id} />
        </div>
      </PageContainer>
    </>
  );
}
