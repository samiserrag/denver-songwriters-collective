import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PerformerGrid } from "@/components/performers";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Performer } from "@/types";

export const metadata: Metadata = {
  title: "Artists | Denver Songwriters Collective",
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "performer")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("full_name", { ascending: true });

  const performers: Performer[] = (profiles ?? []).map(mapDBProfileToPerformer);

  return (
    <>
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Denver Songwriters Performers"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] drop-shadow-lg">
              Our Performers
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              Talented artists who grace our stages every week
            </p>
          </div>
        </div>
      </div>
      <PageContainer>
        <div className="py-12">
          <PerformerGrid performers={performers} />
        </div>
      </PageContainer>
    </>
  );
}
