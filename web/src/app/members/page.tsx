import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { MembersPageClient } from "@/components/members";
import type { Database } from "@/lib/supabase/database.types";
import type { Member, MemberRole, SocialLinks } from "@/types";

export const metadata: Metadata = {
  title: "Members | Denver Songwriters Collective",
  description: "Meet the musicians, performers, studios, and hosts in our community. Connect, collaborate, and grow together.",
};

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToMember(profile: DBProfile): Member {
  const socialLinks: SocialLinks = {};
  if (profile.instagram_url) socialLinks.instagram = profile.instagram_url;
  if (profile.twitter_url) socialLinks.twitter = profile.twitter_url;
  if (profile.website_url) socialLinks.website = profile.website_url;

  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Member",
    role: (profile.role ?? "fan") as MemberRole,
    isHost: profile.is_host ?? false,
    bio: profile.bio ?? undefined,
    genres: profile.genres ?? undefined,
    instruments: profile.instruments ?? undefined,
    specialties: profile.specialties ?? undefined,
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

  const members: Member[] = (profiles ?? []).map(mapDBProfileToMember);

  // Check if there's an initial role filter from URL
  const initialRole = params.role as MemberRole | undefined;
  const validRoles: MemberRole[] = ["performer", "host", "studio", "fan"];
  const validInitialRole = initialRole && validRoles.includes(initialRole) ? initialRole : undefined;

  return (
    <>
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Denver Songwriters Community Members"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-[var(--color-text-primary)] tracking-tight drop-shadow-lg">
              Our Members
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              Performers, studios, hosts, and fans who make our community thrive
            </p>
          </div>
        </div>
      </div>
      <PageContainer>
        <div className="py-10">
          <MembersPageClient members={members} initialRole={validInitialRole} />
        </div>
      </PageContainer>
    </>
  );
}
