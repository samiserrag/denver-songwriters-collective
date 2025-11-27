import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudioGrid } from "@/components/studios";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Studio } from "@/types";

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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "studio")
    .order("full_name", { ascending: true });

  const studios: Studio[] = (profiles ?? []).map(mapDBProfileToStudio);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            Recording Studios
          </h1>
          <p className="text-neutral-300 text-lg max-w-2xl">
            Professional recording services from our partner studios.
          </p>
        </PageContainer>
      </HeroSection>
      <PageContainer>
        <div className="py-12">
          <StudioGrid studios={studios} />
        </div>
      </PageContainer>
    </>
  );
}
