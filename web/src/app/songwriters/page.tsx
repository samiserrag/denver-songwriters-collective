import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SongwriterGrid } from "@/components/songwriters";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Songwriter } from "@/types";

export const metadata: Metadata = {
  title: "Songwriters | Denver Songwriters Collective",
  description: "Meet Denver's talented songwriters. Connect, collaborate, and grow together.",
};

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToSongwriter(profile: DBProfile): Songwriter {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Songwriter",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isSpotlight: profile.is_featured ?? false,
  };
}

export default async function SongwritersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "performer")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("full_name", { ascending: true });

  const songwriters: Songwriter[] = (profiles ?? []).map(mapDBProfileToSongwriter);

  return (
    <>
      {/* Page Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
            Our Songwriters
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mt-3">
            Talented artists who grace our stages every week
          </p>
        </div>
      </div>
      <PageContainer>
        <div className="py-12">
          <SongwriterGrid songwriters={songwriters} />
        </div>
      </PageContainer>
    </>
  );
}
