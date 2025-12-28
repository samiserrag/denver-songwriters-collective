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

// Grouping helpers
function groupByDate(events: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  for (const event of events) {
    const dateKey = event.event_date!;
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export function groupByDayOfWeek(events: any[]): Map<string, any[]> {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const groups = new Map<string, any[]>();

  for (const day of dayOrder) {
    groups.set(day, []);
  }

  for (const event of events) {
    const day = event.day_of_week?.trim();
    if (day && groups.has(day)) {
      groups.get(day)!.push(event);
    }
  }

  // Remove empty days
  for (const [day, items] of groups) {
    if (items.length === 0) groups.delete(day);
  }

  return groups;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  // Use explicit timezone to prevent server/client hydration mismatch
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

export default async function HappeningsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string; time?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const typeFilter = params.type;
  const searchQuery = params.search || "";
  const timeFilter = params.time || "upcoming"; // 'upcoming' | 'past' | 'all'

  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .in("status", ["active", "needs_verification"]);

  if (typeFilter === "open_mic") query = query.eq("event_type", "open_mic");
  if (typeFilter === "dsc") query = query.eq("is_dsc_event", true);

  // Date filter logic
  if (timeFilter === "upcoming") {
    // Events today or future, OR recurring events (no specific date)
    query = query.or(`event_date.gte.${today},event_date.is.null`);
  } else if (timeFilter === "past") {
    query = query.lt("event_date", today);
  }
  // 'all' = no date filter

  query = query.order("day_of_week", { ascending: true });

  const { data: events, error } = await query;

  if (error) {
    console.error("Error fetching happenings:", error);
  }

  const list = events || [];
  const datedEvents = list.filter((e: any) => e.event_date);
  const recurringEvents = list.filter((e: any) => !e.event_date);

  // Hero only shows on unfiltered /happenings (no typeFilter)
  const showHero = !typeFilter;

  return (
    <>
      {showHero && (
        <HeroSection minHeight="sm" showVignette showBottomFade>
          <div className="text-center px-4 py-6">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-display)] font-bold text-white tracking-tight drop-shadow-lg">
              Happenings
            </h1>
            <p className="text-lg text-white/80 mt-2 drop-shadow">
              Open mics, events, and shows in the Denver music community
            </p>
          </div>
        </HeroSection>
      )}

      <PageContainer className={showHero ? "" : "pt-8"}>
        {/* Community CTA - shows on Open Mics and All views */}
        {(typeFilter === "open_mic" || !typeFilter) && (
          <div className="mb-8 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
            <p className="text-[var(--color-text-secondary)] text-sm mb-3">
              This directory is maintained by our community. Help us keep it accurate and complete!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/submit-open-mic"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-white text-sm font-medium hover:opacity-90 transition"
              >
                + Add an Open Mic
              </Link>
              <Link
                href="/submit-open-mic"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition"
              >
                Submit a Correction
              </Link>
            </div>
            <p className="text-[var(--color-text-tertiary)] text-xs mt-3">
              Are you a host? <Link href="/dashboard/my-events" className="text-[var(--color-link)] hover:underline">Claim your listing</Link> to manage it directly.
            </p>
          </div>
        )}

        {/* DSC Events CTA */}
        {typeFilter === "dsc" && (
          <div className="mb-8 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
            <p className="text-[var(--color-text-secondary)] text-sm mb-3">
              DSC Happenings are official Denver Songwriters Collective events — showcases, workshops, and community gatherings.
            </p>
            <Link
              href="/dashboard/my-events/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-white text-sm font-medium hover:opacity-90 transition"
            >
              + Create a Happening
            </Link>
          </div>
        )}

        {/* Page header with title + filters */}
        <div className="mb-6">
          {!showHero && (
            <h1 className="text-3xl md:text-4xl font-[var(--font-family-display)] font-bold text-[var(--color-text-primary)] mb-4">
              {typeFilter === "open_mic" ? "Open Mics" : "DSC Happenings"}
            </h1>
          )}
          <div className="flex gap-2 flex-wrap">
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
          {/* Time filter */}
          <div className="flex gap-2 mt-3">
            <TimeFilterTab
              href={typeFilter ? `/happenings?type=${typeFilter}&time=upcoming` : "/happenings?time=upcoming"}
              label="Upcoming"
              active={timeFilter === "upcoming"}
            />
            <TimeFilterTab
              href={typeFilter ? `/happenings?type=${typeFilter}&time=past` : "/happenings?time=past"}
              label="Past"
              active={timeFilter === "past"}
            />
          </div>
        </div>

        {datedEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-[var(--font-family-display)] font-semibold mb-4">Upcoming Happenings</h2>
            <div className="flex flex-col gap-6">
              {[...groupByDate(datedEvents)].map(([date, eventsForDate]) => (
                <div key={date}>
                  <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2 pb-1 border-b border-[var(--color-border-default)]">
                    {formatDateHeader(date)}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {eventsForDate.map((event: any) => (
                      <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recurringEvents.length > 0 && (
          <section>
            <h2 className="text-2xl font-[var(--font-family-display)] font-semibold mb-4">Weekly Open Mics</h2>
            <div className="flex flex-col gap-6">
              {[...groupByDayOfWeek(recurringEvents)].map(([day, eventsForDay]) => (
                <div key={day}>
                  <h3 className="text-2xl font-[var(--font-family-display)] font-bold text-[var(--color-text-primary)] mb-2 pb-1 border-b-2 border-[var(--color-accent-primary)]">
                    {day}s
                  </h3>
                  <div className="flex flex-col gap-2">
                    {eventsForDay.map((event: any) => (
                      <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
                    ))}
                  </div>
                </div>
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

function TimeFilterTab({
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
      className={`px-3 py-1 rounded text-sm transition-colors ${
        active
          ? "text-[var(--color-text-accent)] border-b-2 border-[var(--color-accent-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
    </Link>
  );
}
