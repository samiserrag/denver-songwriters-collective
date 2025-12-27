import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";

export const metadata: Metadata = {
  title: "Spotlight | Denver Songwriters Collective",
  description: "Meet our featured artists, hosts, and studios from the Denver songwriting community.",
};

export const dynamic = "force-dynamic";

interface SpotlightProfile {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string;
  featured_at: string | null;
  is_featured: boolean;
  // Identity flags
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
  spotlight_type: string | null;
}

export default async function SpotlightPage() {
  const supabase = await createSupabaseServerClient();

  // Get current spotlighted profiles (is_featured = true)
  // Include identity flags for proper display/linking
  const { data: currentSpotlights } = await supabase
    .from("profiles")
    .select("id, full_name, bio, avatar_url, role, featured_at, is_featured, is_songwriter, is_host, is_studio, is_fan, spotlight_type")
    .eq("is_featured", true)
    .eq("is_public", true)
    .or("is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,role.in.(performer,host,studio)")
    .order("featured_rank", { ascending: true });

  // Get previously spotlighted profiles (has featured_at but not currently featured)
  // We'll show anyone with a featured_at timestamp who isn't currently featured
  const { data: previousSpotlights } = await supabase
    .from("profiles")
    .select("id, full_name, bio, avatar_url, role, featured_at, is_featured, is_songwriter, is_host, is_studio, is_fan, spotlight_type")
    .eq("is_featured", false)
    .eq("is_public", true)
    .not("featured_at", "is", null)
    .or("is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,role.in.(performer,host,studio)")
    .order("featured_at", { ascending: false })
    .limit(20);

  // Identity flag helpers with legacy role fallback
  const isProfileStudio = (p: SpotlightProfile) => p.is_studio || p.role === "studio";
  const isProfileSongwriter = (p: SpotlightProfile) => p.is_songwriter || p.role === "performer";
  const isProfileHost = (p: SpotlightProfile) => p.is_host || p.role === "host";

  const getRoleLabel = (profile: SpotlightProfile) => {
    // Use spotlight_type if available for current spotlights
    if (profile.is_featured && profile.spotlight_type) {
      switch (profile.spotlight_type) {
        case "performer": return "Artist Spotlight";
        case "host": return "Host Spotlight";
        case "studio": return "Studio Spotlight";
      }
    }
    // Flag-based labels with role fallback
    if (isProfileStudio(profile)) {
      return "Studio";
    }
    if (isProfileSongwriter(profile) && isProfileHost(profile)) {
      return "Artist & Host";
    }
    if (isProfileSongwriter(profile)) {
      return "Artist";
    }
    if (isProfileHost(profile)) {
      return "Open Mic Host";
    }
    return "Member";
  };

  const getProfileLink = (profile: SpotlightProfile) => {
    // Studios -> /studios/[id], everyone else -> /songwriters/[id]
    if (isProfileStudio(profile)) return `/studios/${profile.id}`;
    return `/songwriters/${profile.id}`;
  };

  return (
    <>
      {/* Hero Header */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Community Spotlight
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow">
            Celebrating the artists, hosts, and studios of our community
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-12 space-y-16">
          {/* Current Spotlights */}
          <section>
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-2">
                Currently in the Spotlight
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Meet our featured community members
              </p>
            </div>

            {currentSpotlights && currentSpotlights.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {currentSpotlights.map((profile) => (
                  <SpotlightCard
                    key={profile.id}
                    profile={profile as SpotlightProfile}
                    isCurrent={true}
                    getRoleLabel={getRoleLabel}
                    getProfileLink={getProfileLink}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border-default)]">
                <p className="text-[var(--color-text-secondary)]">
                  No one is currently in the spotlight. Check back soon!
                </p>
              </div>
            )}
          </section>

          {/* Previous Spotlights */}
          {previousSpotlights && previousSpotlights.length > 0 && (
            <section>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-2">
                  Previously Featured
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Past spotlight recipients from our community
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {previousSpotlights.map((profile) => (
                  <SpotlightCard
                    key={profile.id}
                    profile={profile as SpotlightProfile}
                    isCurrent={false}
                    getRoleLabel={getRoleLabel}
                    getProfileLink={getProfileLink}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </PageContainer>
    </>
  );
}

function SpotlightCard({
  profile,
  isCurrent,
  getRoleLabel,
  getProfileLink,
}: {
  profile: SpotlightProfile;
  isCurrent: boolean;
  getRoleLabel: (profile: SpotlightProfile) => string;
  getProfileLink: (profile: SpotlightProfile) => string;
}) {
  const formattedDate = profile.featured_at
    ? new Date(profile.featured_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        timeZone: "America/Denver",
      })
    : null;

  return (
    <Link
      href={getProfileLink(profile)}
      className={`group block rounded-2xl border overflow-hidden transition-all ${
        isCurrent
          ? "border-[var(--color-border-accent)]/30 bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent hover:border-[var(--color-border-accent)]/50"
          : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)]"
      }`}
    >
      {/* Avatar */}
      <div className={`relative ${isCurrent ? "aspect-square" : "aspect-[4/3]"} overflow-hidden bg-[var(--color-bg-tertiary)]`}>
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name ?? "Profile"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-transparent">
            <span className="text-4xl text-[var(--color-text-accent)]">
              {profile.full_name?.[0] ?? "?"}
            </span>
          </div>
        )}

        {/* Current spotlight badge */}
        {isCurrent && (
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1 rounded-full bg-[var(--color-accent-primary)] text-[var(--color-background)] text-xs font-semibold shadow-lg">
              ★ Spotlight
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={`${isCurrent ? "p-6" : "p-4"}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            isCurrent
              ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]"
              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
          }`}>
            {getRoleLabel(profile)}
          </span>
          {formattedDate && !isCurrent && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {formattedDate}
            </span>
          )}
        </div>

        <h3 className={`font-[var(--font-family-serif)] text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors ${
          isCurrent ? "text-xl" : "text-base"
        }`}>
          {profile.full_name ?? "Anonymous"}
        </h3>

        {isCurrent && profile.bio && (
          <p className="text-[var(--color-text-secondary)] text-sm mt-2 line-clamp-3">
            {profile.bio}
          </p>
        )}
      </div>
    </Link>
  );
}
