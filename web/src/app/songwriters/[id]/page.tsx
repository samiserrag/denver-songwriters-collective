import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { SongwriterAvatar } from "@/components/songwriters";
import type { Database } from "@/lib/supabase/database.types";
import Link from "next/link";
export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface SongwriterDetailPageProps {
  params: Promise<{ id: string }>;
}

// Social link icons as inline SVGs
const SocialIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    instagram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    facebook: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    twitter: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    youtube: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    spotify: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    website: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  };
  return icons[type] || null;
};

// Tip platform icons
const TipIcon = ({ type }: { type: string }) => {
  const icons: Record<string, React.ReactNode> = {
    venmo: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.5 2h-15A2.5 2.5 0 002 4.5v15A2.5 2.5 0 004.5 22h15a2.5 2.5 0 002.5-2.5v-15A2.5 2.5 0 0019.5 2zM17.2 8.2c0 2.5-2.1 6.1-3.8 8.5H9.3L7.5 6.3l3.4-.3.9 7.2c.9-1.4 1.9-3.6 1.9-5.1 0-.8-.1-1.3-.3-1.8l3.1-.6c.4.6.7 1.5.7 2.5z"/>
      </svg>
    ),
    cashapp: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.59 3.47A5.1 5.1 0 0020.53.41C19.86.14 19.1 0 18.25 0H5.75C4.9 0 4.14.14 3.47.41a5.1 5.1 0 00-3.06 3.06C.14 4.14 0 4.9 0 5.75v12.5c0 .85.14 1.61.41 2.28a5.1 5.1 0 003.06 3.06c.67.27 1.43.41 2.28.41h12.5c.85 0 1.61-.14 2.28-.41a5.1 5.1 0 003.06-3.06c.27-.67.41-1.43.41-2.28V5.75c0-.85-.14-1.61-.41-2.28zM17.46 14.7l-1.37 1.47c-.17.18-.43.28-.72.28h-.02c-.29 0-.56-.1-.73-.28l-1.73-1.81-.65.69c-.15.17-.37.26-.6.26-.46 0-.85-.37-.85-.84v-.02l.02-1.08h-1.2c-.47 0-.85-.38-.85-.85s.38-.85.85-.85h1.2l-.02-1.05c0-.47.38-.85.85-.85.23 0 .44.09.6.25l.65.68 1.73-1.81c.17-.18.44-.28.73-.28h.02c.29 0 .55.1.72.28l1.37 1.47c.19.2.19.52 0 .72l-1.87 2-.87.93.87.93 1.87 2c.19.2.19.52 0 .72z"/>
      </svg>
    ),
    paypal: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.14c-.528 0-.986.396-1.062.93l-.02.144-1.067 6.757-.015.094a.462.462 0 0 1-.456.4l-.443-.02z"/>
      </svg>
    ),
  };
  return icons[type] || null;
};

export default async function SongwriterDetailPage({ params }: SongwriterDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .in("role", ["performer", "host"])
    .single();

  if (error || !profile) {
    notFound();
  }

  const songwriter = profile as DBProfile;

  // Build social links array
  const socialLinks = [
    { type: "instagram", url: songwriter.instagram_url, label: "Instagram" },
    { type: "facebook", url: songwriter.facebook_url, label: "Facebook" },
    { type: "youtube", url: songwriter.youtube_url, label: "YouTube" },
    { type: "spotify", url: songwriter.spotify_url, label: "Spotify" },
    { type: "website", url: songwriter.website_url, label: "Website" },
  ].filter((link) => link.url);

  // Build tip links array
  const tipLinks = [
    {
      type: "venmo",
      handle: songwriter.venmo_handle,
      url: songwriter.venmo_handle ? `https://venmo.com/${songwriter.venmo_handle.replace("@", "")}` : null,
      label: "Venmo",
      color: "bg-[#3D95CE]",
    },
    {
      type: "cashapp",
      handle: songwriter.cashapp_handle,
      url: songwriter.cashapp_handle ? `https://cash.app/${songwriter.cashapp_handle.replace("$", "$")}` : null,
      label: "Cash App",
      color: "bg-[#00D632]",
    },
    {
      type: "paypal",
      handle: null,
      url: songwriter.paypal_url,
      label: "PayPal",
      color: "bg-[#003087]",
    },
  ].filter((link) => link.url || link.handle);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <SongwriterAvatar
              src={songwriter.avatar_url ?? undefined}
              alt={songwriter.full_name ?? "Songwriter"}
              size="lg"
            />
            <div>
              <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
                {songwriter.full_name ?? "Anonymous Songwriter"}
              </h1>

              {/* Role badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {songwriter.role === "host" ? (
                    <span className="px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                      🎤 Open Mic Host
                    </span>
                ) : (
                  <>
                    <span className="px-3 py-1 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm">
                      Songwriter
                    </span>
                    {(songwriter as DBProfile & { is_host?: boolean }).is_host && (
                      <span className="px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                        🎤 Also Hosts Open Mics
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Collaboration & Availability Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {songwriter.open_to_collabs && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Open to Collaborations
                  </span>
                )}
                {songwriter.interested_in_cowriting && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Interested in Co-writing
                  </span>
                )}
                {songwriter.available_for_hire && (
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
              {songwriter.bio ?? "This songwriter hasn't added a bio yet."}
            </p>
          </section>

          {/* Genres Section */}
          {songwriter.genres && songwriter.genres.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {songwriter.genres.map((genre) => (
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

          {/* Instruments Section */}
          {songwriter.instruments && songwriter.instruments.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Instruments</h2>
              <div className="flex flex-wrap gap-2">
                {songwriter.instruments.map((instrument) => (
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
          {songwriter.specialties && songwriter.specialties.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Specialties</h2>
              <div className="flex flex-wrap gap-2">
                {songwriter.specialties.map((specialty) => (
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
          {songwriter.favorite_open_mic && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Favorite Open Mic</h2>
              <p className="text-[var(--color-text-secondary)]">{songwriter.favorite_open_mic}</p>
            </section>
          )}

          {/* Song Links Section */}
          {songwriter.song_links && songwriter.song_links.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Listen to My Music</h2>
              <div className="grid gap-3 max-w-xl">
                {songwriter.song_links.map((link, index) => {
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
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg ${platform.color} hover:opacity-90 text-[var(--color-text-primary)] transition-opacity`}
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
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Support This Songwriter</h2>
              <p className="text-[var(--color-text-tertiary)] mb-4">Show your appreciation with a tip!</p>
              <div className="flex flex-wrap gap-3">
                {tipLinks.map((tip) => (
                  <Link
                    key={tip.type}
                    href={tip.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${tip.color} hover:opacity-90 text-[var(--color-text-primary)] transition-opacity`}
                  >
                    <TipIcon type={tip.type} />
                    <span className="font-medium">{tip.label}</span>
                    {tip.handle && <span className="text-[var(--color-text-primary)]/80">{tip.handle}</span>}
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
