import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PerformerGrid } from "@/components/performers";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Performer } from "@/types";
export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToPerformer(profile: DBProfile): Performer {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Performer",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

export default async function PerformersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "performer")
    .order("full_name", { ascending: true });

  const performers: Performer[] = (profiles ?? []).map(mapDBProfileToPerformer);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            Our Performers
          </h1>
          <p className="text-neutral-300 text-lg max-w-2xl">
            Discover the talented artists who grace our stages every week.
          </p>
        </PageContainer>
      </HeroSection>
      <PageContainer>
        <div className="py-12">
          <PerformerGrid performers={performers} />
        </div>
      </PageContainer>
    </>
  );
}
