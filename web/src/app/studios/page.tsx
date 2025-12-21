import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudioGrid } from "@/components/studios";
import { PageContainer } from "@/components/layout";
import type { Database } from "@/lib/supabase/database.types";
import type { Studio } from "@/types";

export const metadata: Metadata = {
  title: "Studios | Denver Songwriters Collective",
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
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Denver Recording Studios"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] drop-shadow-lg">
              Recording Studios
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              Professional recording services from our partner studios
            </p>
          </div>
        </div>
      </div>
      <PageContainer>
        <div className="py-12">
          <StudioGrid studios={studios} />
        </div>
      </PageContainer>
    </>
  );
}
