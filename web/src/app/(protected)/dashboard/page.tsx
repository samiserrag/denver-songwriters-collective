import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import { WelcomeToast } from "./WelcomeToast";
import { DashboardProfileCard } from "./DashboardProfileCard";
import { GettingStartedSection } from "./_components/GettingStartedSection";
import { Suspense } from "react";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";
import NotificationsList from "./notifications/NotificationsList";
import InvitationsList from "./invitations/InvitationsList";

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) {
    return (
      <PageContainer className="py-24 text-center text-red-400">
        <p>Not authenticated.</p>
      </PageContainer>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const p = profile as DBProfile | null;

  // Check if user is an approved host
  const { data: approvedHostStatus } = await supabase
    .from("approved_hosts")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const isApprovedHost = !!approvedHostStatus;

  // Check if user has a pending host request
  const { data: pendingHostRequest } = await supabase
    .from("host_requests")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  const hasPendingHostRequest = !!pendingHostRequest;

  // Get count of venues user manages
  const { count: venueCount } = await supabase
    .from("venue_managers")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  // Get pending invitations with event details
  const { data: pendingInvitations } = await supabase
    .from("event_hosts")
    .select(`
      *,
      event:events(id, title, event_type, venue_name, start_time),
      inviter:profiles!event_hosts_invited_by_fkey(id, full_name)
    `)
    .eq("user_id", user.id)
    .eq("invitation_status", "pending")
    .order("invited_at", { ascending: false });

  // Get recent notifications (last 10)
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Get unread notification count
  const unreadCount = notifications?.filter(n => !n.is_read).length ?? 0;

  // Get upcoming RSVP count
  const { count: upcomingRsvps } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["confirmed", "waitlist"]);

  // Get user's events count (if host)
  const { count: myEventsCount } = await supabase
    .from("event_hosts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted");

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <HeroSection minHeight="sm">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <PerformerAvatar
              src={p?.avatar_url ?? undefined}
              alt={p?.full_name ?? "User"}
              size="lg"
            />
            <div className="text-center md:text-left">
              <h1 className="text-[var(--color-text-accent)] text-3xl md:text-4xl font-[var(--font-family-serif)] italic mb-2">
                {p?.full_name ?? "Welcome"}
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                {p?.role === "admin" ? "Administrator" : "Member"}
              </p>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-8 space-y-8">
          {/* Profile Completeness */}
          {p && (
            <DashboardProfileCard
              profile={{
                is_songwriter: p.is_songwriter ?? false,
                is_host: p.is_host ?? false,
                is_studio: p.is_studio ?? false,
                is_fan: p.is_fan ?? false,
                full_name: p.full_name,
                bio: p.bio,
                avatar_url: p.avatar_url,
                instruments: p.instruments,
                genres: p.genres,
                instagram_url: p.instagram_url,
                facebook_url: p.facebook_url,
                twitter_url: p.twitter_url,
                tiktok_url: p.tiktok_url,
                youtube_url: p.youtube_url,
                spotify_url: p.spotify_url,
                website_url: p.website_url,
                venmo_handle: p.venmo_handle,
                cashapp_handle: p.cashapp_handle,
                paypal_url: p.paypal_url,
              }}
            />
          )}

          {/* Getting Started Prompts (Host + Venue) */}
          {p && (
            <GettingStartedSection
              isHost={p.is_host ?? false}
              isStudio={p.is_studio ?? false}
              isApprovedHost={isApprovedHost}
              hasPendingHostRequest={hasPendingHostRequest}
              venueCount={venueCount ?? 0}
            />
          )}

          {/* Quick Actions Grid */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <Link
                href="/dashboard/profile"
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center"
              >
                <span className="block text-2xl mb-2">👤</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Edit Profile</span>
              </Link>

              <Link
                href="/dashboard/my-rsvps"
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center relative"
              >
                <span className="block text-2xl mb-2">🎟️</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">My RSVPs</span>
                {(upcomingRsvps ?? 0) > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                    {upcomingRsvps}
                  </span>
                )}
              </Link>

              <Link
                href="/dashboard/my-events"
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center relative"
              >
                <span className="block text-2xl mb-2">📅</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">My Happenings</span>
                {(myEventsCount ?? 0) > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-xs rounded-full">
                    {myEventsCount}
                  </span>
                )}
              </Link>

              <Link
                href="/dashboard/blog"
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center"
              >
                <span className="block text-2xl mb-2">✍️</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">My Blog</span>
              </Link>

              <Link
                href="/dashboard/gallery"
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center"
              >
                <span className="block text-2xl mb-2">📷</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">My Photos</span>
              </Link>

              {/* My Venues - show for venue managers or hosts/studios */}
              {((venueCount ?? 0) > 0 || p?.is_host || p?.is_studio) && (
                <Link
                  href="/dashboard/my-venues"
                  className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:border-[var(--color-border-accent)] transition-colors text-center relative"
                >
                  <span className="block text-2xl mb-2">🏠</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">My Venues</span>
                  {(venueCount ?? 0) > 0 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                      {venueCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Admin Panel - only for admins */}
              {p?.role === "admin" && (
                <Link
                  href="/dashboard/admin"
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:border-red-500/60 hover:bg-red-500/20 transition-colors text-center col-span-2 sm:col-span-1"
                >
                  <span className="block text-2xl mb-2">⚙️</span>
                  <span className="text-sm font-medium text-red-400">Admin Panel</span>
                </Link>
              )}
            </div>
          </section>

          {/* Invitations Section (if any pending) */}
          {(pendingInvitations?.length ?? 0) > 0 && (
            <section className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <span>📬</span>
                <span>Co-host Invitations</span>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 text-xs rounded-full">
                  {pendingInvitations?.length}
                </span>
              </h2>
              <InvitationsList invitations={pendingInvitations || []} />
            </section>
          )}

          {/* Notifications Section */}
          <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <span>🔔</span>
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-xs rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <Link
                href="/dashboard/notifications"
                className="text-sm text-[var(--color-text-accent)] hover:underline"
              >
                Manage all →
              </Link>
            </div>
            {notifications && notifications.length > 0 ? (
              <NotificationsList notifications={notifications.slice(0, 5)} compact />
            ) : (
              <p className="text-[var(--color-text-secondary)] text-sm">No notifications yet.</p>
            )}
          </section>

          {/* Secondary Links */}
          <section className="pt-4 border-t border-[var(--color-border-default)]">
            <div className="flex flex-wrap gap-4 text-sm">
              {/* Profile-specific links */}
              {(p?.is_songwriter || p?.role === "performer") && (
                <Link href={`/songwriters/${p?.slug || user.id}`} className="text-[var(--color-accent-primary)] hover:underline">
                  View Public Profile
                </Link>
              )}
              {(p?.is_studio || p?.role === "studio") && (
                <>
                  <Link href={`/studios/${p?.slug || user.id}`} className="text-[var(--color-accent-primary)] hover:underline">
                    View Studio Profile
                  </Link>
                  <Link href="/dashboard/studio-appointments" className="text-[var(--color-accent-primary)] hover:underline">
                    Studio Bookings
                  </Link>
                </>
              )}

              {/* Settings always available */}
              <Link href="/dashboard/settings" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                Account Settings
              </Link>
            </div>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
