import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RSVPCard, type RSVPCardEvent } from "@/components/events/RSVPCard";

export const dynamic = "force-dynamic";

interface RSVPWithEvent {
  id: string;
  status: "confirmed" | "waitlist" | "cancelled" | "offered";
  waitlist_position: number | null;
  offer_expires_at: string | null;
  created_at: string | null;
  /** Phase ABC7: date_key for per-occurrence RSVP */
  date_key: string;
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
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect("/login?redirectTo=/dashboard/my-rsvps");
  }

  const userId = sessionUser.id;
  const today = new Date().toISOString().split("T")[0];

  // Determine active tab
  const activeTab: TabType = (params.tab === "past" || params.tab === "cancelled")
    ? params.tab
    : "upcoming";

  // Fetch RSVPs based on tab
  let rsvps: RSVPWithEvent[] = [];

  if (activeTab === "upcoming") {
    // Phase ABC7: Upcoming RSVPs filtered by date_key (the RSVP's occurrence date)
    // RSVPs with date_key >= today are upcoming
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, offer_expires_at, created_at, date_key,
        event:events(id, slug, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .in("status", ["confirmed", "waitlist", "offered"])
      .gte("date_key", today)
      .order("date_key", { ascending: true })
      .limit(50);

    rsvps = (data as unknown as RSVPWithEvent[]) || [];

  } else if (activeTab === "past") {
    // Phase ABC7: Past RSVPs filtered by date_key < today
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, offer_expires_at, created_at, date_key,
        event:events(id, slug, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .in("status", ["confirmed", "waitlist"])
      .lt("date_key", today)
      .order("date_key", { ascending: false })
      .limit(50);

    rsvps = (data as unknown as RSVPWithEvent[]) || [];

  } else {
    // Phase ABC7: Cancelled RSVPs with date_key
    const { data } = await supabase
      .from("event_rsvps")
      .select(`
        id, status, waitlist_position, offer_expires_at, created_at, date_key,
        event:events(id, slug, title, event_date, start_time, end_time, venue_name, venue_address, cover_image_url)
      `)
      .eq("user_id", userId)
      .eq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(50);

    rsvps = (data as unknown as RSVPWithEvent[]) || [];
  }

  // Phase ABC7: Count badges use date_key instead of event.event_date
  const { count: upcomingCount } = await supabase
    .from("event_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["confirmed", "waitlist", "offered"])
    .gte("date_key", today);

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
              href="/happenings"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-medium rounded-lg transition-colors"
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
                  offer_expires_at: rsvp.offer_expires_at,
                  created_at: rsvp.created_at,
                  date_key: rsvp.date_key, // Phase ABC7: Pass date_key for cancel action
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
