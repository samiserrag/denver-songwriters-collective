import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import type { Database } from "@/lib/supabase/database.types";
export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface PerformerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformerDetailPage({ params }: PerformerDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "performer")
    .single();

  if (error || !profile) {
    notFound();
  }

  const performer = profile as DBProfile;

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <PerformerAvatar
              src={performer.avatar_url ?? undefined}
              alt={performer.full_name ?? "Performer"}
              size="lg"
            />
            <div>
              <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
                {performer.full_name ?? "Anonymous Performer"}
              </h1>
              <p className="text-neutral-400">Performer</p>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">About</h2>
            <p className="text-neutral-300 leading-relaxed max-w-3xl">
              {performer.bio ?? "This performer hasn't added a bio yet."}
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-4">Upcoming Performances</h2>
            <p className="text-neutral-400">
              Check back soon for upcoming show dates.
            </p>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
