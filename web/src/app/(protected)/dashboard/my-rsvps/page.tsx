import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RSVPCard, type RSVPCardEvent } from "@/components/events/RSVPCard";

export const dynamic = "force-dynamic";

interface RSVPWithEvent {
  id: string;
  status: "confirmed" | "waitlist" | "cancelled";
  waitlist_position: number | null;
  created_at: string | null;
  event: RSVPCardEvent | null;
}

type TabType = "upcoming" | "past" | "cancelled";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MyRSVPsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirectTo=/dashboard/my-rsvps");
  }

  const userId = session.user.id;
  const today = new Date().toISOString().split("T")[0];

  // Determine active tab
  const activeTab: TabType = (params.tab === "past" || params.tab === "cancelled")
    ? params.tab
    : "upcoming";

  // Fetch RSVPs based on tab
  let rsvps: RSVPWithEvent[] = [];

  if (activeTab === "upcoming") {
    // Upcoming: confirmed or waitlist RSVPs for events with event_date >= today (or null date)
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, created_at,
        event:events(id, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .in("status", ["confirmed", "waitlist"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Filter to upcoming events (event_date >= today or null)
    rsvps = ((data as unknown as RSVPWithEvent[]) || []).filter((r) => {
      if (!r.event) return false;
      if (!r.event.event_date) return true; // Include events without dates
      return r.event.event_date >= today;
    });

    // Sort by event date (soonest first), null dates at the end
    rsvps.sort((a, b) => {
      const dateA = a.event?.event_date;
      const dateB = b.event?.event_date;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    });

  } else if (activeTab === "past") {
    // Past: confirmed or waitlist RSVPs for events with event_date < today
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, created_at,
        event:events(id, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .in("status", ["confirmed", "waitlist"])
      .order("created_at", { ascending: false })
      .limit(50);

    // Filter to past events (event_date < today)
    rsvps = ((data as unknown as RSVPWithEvent[]) || []).filter((r) => {
      if (!r.event?.event_date) return false;
      return r.event.event_date < today;
    });

    // Sort by event date (most recent first)
    rsvps.sort((a, b) => {
      const dateA = a.event?.event_date || "";
      const dateB = b.event?.event_date || "";
      return dateB.localeCompare(dateA);
    });

  } else {
    // Cancelled: cancelled RSVPs
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, created_at,
        event:events(id, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(50);

    rsvps = (data as unknown as RSVPWithEvent[]) || [];
  }

  // Count for badges
  const { count: upcomingCount } = await supabase
    .from("event_rsvps")
    .select("id, events!inner(event_date)", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["confirmed", "waitlist"])
    .or(`event_date.gte.${today},event_date.is.null`, { referencedTable: "events" });

  const { count: cancelledCount } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "cancelled");

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "upcoming", label: "Upcoming", count: upcomingCount ?? 0 },
    { id: "past", label: "Past" },
    { id: "cancelled", label: "Cancelled", count: cancelledCount ?? 0 },
  ];

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 py-8 sm:py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors mb-4 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-accent)]">
          My RSVPs
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Track your event reservations and waitlist positions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard/my-rsvps${tab.id === "upcoming" ? "" : `?tab=${tab.id}`}`}
            className={`flex-1 min-w-[100px] px-4 py-2.5 rounded-md text-sm font-medium text-center transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.id
                  ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
              }`}>
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* RSVP List */}
      {rsvps.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
            {activeTab === "upcoming" && "No upcoming RSVPs"}
            {activeTab === "past" && "No past RSVPs"}
            {activeTab === "cancelled" && "No cancelled RSVPs"}
          </h3>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-sm mx-auto">
            {activeTab === "upcoming" && "Browse events and RSVP to see them here."}
            {activeTab === "past" && "Your attended events will appear here."}
            {activeTab === "cancelled" && "Cancelled reservations will appear here."}
          </p>
          {activeTab === "upcoming" && (
            <Link
              href="/events"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-medium rounded-lg transition-colors"
            >
              Browse Events
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rsvps.map((rsvp) => (
            rsvp.event && (
              <RSVPCard
                key={rsvp.id}
                rsvp={{
                  id: rsvp.id,
                  status: rsvp.status,
                  waitlist_position: rsvp.waitlist_position,
                  created_at: rsvp.created_at,
                }}
                event={rsvp.event}
                showCancel={activeTab === "upcoming"}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
