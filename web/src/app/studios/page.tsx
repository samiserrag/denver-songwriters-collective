import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudioGrid } from "@/components/studios";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Studio } from "@/types";

export const metadata: Metadata = {
  title: "Studios | The Colorado Songwriters Collective",
  description: "Find recording studios, rehearsal spaces, and creative venues for Denver songwriters.",
};

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBProfileToStudio(profile: DBProfile): Studio {
  return {
    id: profile.id,
    name: profile.full_name ?? "Unnamed Studio",
    description: profile.bio ?? undefined,
  };
}

export default async function StudiosPage() {
  const supabase = await createSupabaseServerClient();

  // Query using identity flags with legacy role fallback
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .or("is_studio.eq.true,role.eq.studio")
    .order("full_name", { ascending: true });

  const studios: Studio[] = (profiles ?? []).map(mapDBProfileToStudio);

  return (
    <>
      {/* Hero Header */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Recording Studios
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow">
            Professional recording services from our partner studios
          </p>
        </div>
      </HeroSection>
      <PageContainer>
        <div className="py-12">
          <StudioGrid studios={studios} />
        </div>
      </PageContainer>
    </>
  );
}
