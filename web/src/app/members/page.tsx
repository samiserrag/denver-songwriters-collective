import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { MembersPageClient } from "@/components/members";
import type { Database } from "@/lib/supabase/database.types";
import type { Member, MemberRole, SocialLinks } from "@/types";

export const metadata: Metadata = {
  title: "Members | Denver Songwriters Collective",
  description: "Meet the musicians, performers, studios, and hosts in our community. Connect, collaborate, and grow together.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToMember(profile: DBProfile, venueManagerIds: Set<string>): Member {
  const socialLinks: SocialLinks = {};
  if (profile.instagram_url) socialLinks.instagram = profile.instagram_url;
  if (profile.twitter_url) socialLinks.twitter = profile.twitter_url;
  if (profile.website_url) socialLinks.website = profile.website_url;

  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Member",
    role: (profile.role ?? "fan") as MemberRole,
    // Identity flags
    isSongwriter: profile.is_songwriter ?? false,
    isHost: profile.is_host ?? false,
    isStudio: profile.is_studio ?? false,
    isFan: profile.is_fan ?? false,
    isVenueManager: venueManagerIds.has(profile.id),
    bio: profile.bio ?? undefined,
    genres: profile.genres ?? undefined,
    instruments: profile.instruments ?? undefined,
    specialties: profile.specialties ?? undefined,
    location: (profile as any).city ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isSpotlight: profile.is_featured ?? false,
    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
    availableForHire: profile.available_for_hire ?? false,
    interestedInCowriting: profile.interested_in_cowriting ?? false,
    openToCollabs: profile.open_to_collabs ?? false,
    songLinks: profile.song_links ?? undefined,
  };
}

interface PageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;

  // Fetch public profiles with at least one identity flag set
  // Note: We no longer filter out admins - admins who are also songwriters should appear
  // The is_public flag controls visibility, not the role
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .or("is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,is_fan.eq.true")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("full_name", { ascending: true });

  // Fetch all venue manager user_ids in a single query (no N+1)
  const { data: venueManagers } = await supabase
    .from("venue_managers")
    .select("user_id")
    .is("revoked_at", null);
  const venueManagerIds = new Set((venueManagers ?? []).map((vm) => vm.user_id));

  const members: Member[] = (profiles ?? []).map((profile) =>
    mapDBProfileToMember(profile, venueManagerIds)
  );

  // Check if there's an initial role filter from URL
  const initialRole = params.role as MemberRole | undefined;
  const validRoles: MemberRole[] = ["performer", "host", "studio", "fan"];
  const validInitialRole = initialRole && validRoles.includes(initialRole) ? initialRole : undefined;

  return (
    <>
      {/* Hero Header */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Collective Members
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow">
            Songwriters, event hosts, studios, promoters, and fans who make our community thrive
          </p>
        </div>
      </HeroSection>
      <PageContainer>
        <div className="py-10">
          <MembersPageClient members={members} initialRole={validInitialRole} />
        </div>
      </PageContainer>
    </>
  );
}
