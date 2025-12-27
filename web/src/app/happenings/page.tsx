import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningsCard } from "@/components/happenings";
import { PageContainer } from "@/components/layout/page-container";
import { HeroSection } from "@/components/layout/hero-section";

export const metadata: Metadata = {
  title: "Happenings | Denver Songwriters Collective",
  description: "Discover open mics, events, and shows in the Denver music community.",
};

export const dynamic = "force-dynamic";

export default async function HappeningsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const typeFilter = params.type;
  const searchQuery = params.search || "";

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .eq("status", "active");

  if (typeFilter === "open_mic") query = query.eq("event_type", "open_mic");
  if (typeFilter === "dsc") query = query.eq("is_dsc_event", true);

  query = query.order("day_of_week", { ascending: true });

  const { data: events, error } = await query;

  if (error) {
    console.error("Error fetching happenings:", error);
  }

  const list = events || [];
  const datedEvents = list.filter((e: any) => e.event_date);
  const recurringEvents = list.filter((e: any) => !e.event_date);

  return (
    <>
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Happenings
          </h1>
          <p className="text-lg text-white/80 mt-2 drop-shadow">
            Open mics, events, and shows in the Denver music community
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="flex gap-2 mb-6 flex-wrap">
          <FilterTab href="/happenings" label="All" active={!typeFilter} />
          <FilterTab
            href="/happenings?type=open_mic"
            label="Open Mics"
            active={typeFilter === "open_mic"}
          />
          <FilterTab
            href="/happenings?type=dsc"
            label="DSC Happenings"
            active={typeFilter === "dsc"}
          />
        </div>

        {datedEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Upcoming Happenings</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {datedEvents.map((event: any) => (
                <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
              ))}
            </div>
          </section>
        )}

        {recurringEvents.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Weekly Open Mics</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recurringEvents.map((event: any) => (
                <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
              ))}
            </div>
          </section>
        )}

        {list.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-secondary)]">
              No happenings found. Check back soon!
            </p>
          </div>
        )}
      </PageContainer>
    </>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-accent-primary)] text-white"
          : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
      }`}
    >
      {label}
    </Link>
  );
}
