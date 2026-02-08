import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PerformerGrid } from "@/components/performers";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Performer } from "@/types";

export const metadata: Metadata = {
  title: "Artists | The Colorado Songwriters Collective",
  description: "Meet Denver's talented songwriters and performers. Connect, collaborate, and grow together.",
};

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToPerformer(profile: DBProfile): Performer {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Performer",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isSpotlight: profile.is_featured ?? false,
  };
}

export default async function PerformersPage() {
  const supabase = await createSupabaseServerClient();

  // Query using identity flags with legacy role fallback
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .or("is_songwriter.eq.true,role.eq.performer")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("full_name", { ascending: true });

  const performers: Performer[] = (profiles ?? []).map(mapDBProfileToPerformer);

  return (
    <>
      {/* Hero Header */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Our Performers
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow">
            Talented artists who grace our stages every week
          </p>
        </div>
      </HeroSection>
      <PageContainer>
        <div className="py-12">
          <PerformerGrid performers={performers} />
        </div>
      </PageContainer>
    </>
  );
}
