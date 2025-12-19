import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import { WelcomeToast } from "./WelcomeToast";
import { Suspense } from "react";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";

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

  // Check host status and pending invitations
  const { data: hostStatus } = await supabase
    .from("approved_hosts")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const isApprovedHost = !!hostStatus || p?.role === "admin";

  // Get pending invitation count
  const { count: pendingInvitations } = await supabase
    .from("event_hosts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("invitation_status", "pending");

  // Get unread notification count
  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  // Get upcoming RSVP count (confirmed or waitlisted)
  const { count: upcomingRsvps } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["confirmed", "waitlist"]);

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <HeroSection minHeight="md">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <PerformerAvatar
              src={p?.avatar_url ?? undefined}
              alt={p?.full_name ?? "User"}
              size="lg"
            />
            <div>
              <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-3">
                Welcome, {p?.full_name ?? "User"}
              </h1>
              <p className="text-[var(--color-text-secondary)] text-lg">
                Role: <span className="text-[var(--color-accent-primary)]">{p?.role}</span>
              </p>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 space-y-10">
          <section>
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
              Quick Actions
            </h2>

            <ul className="space-y-3 text-[var(--color-text-secondary)] text-lg">
              <li>
                <Link href="/dashboard/profile" className="text-[var(--color-accent-primary)] hover:underline">Edit My Profile</Link>
              </li>
              <li>
                <Link href="/events" className="text-[var(--color-accent-primary)] hover:underline">Browse Events</Link>
              </li>
              <li>
                <Link href="/dashboard/my-rsvps" className="text-[var(--color-accent-primary)] hover:underline">
                  My RSVPs
                  {(upcomingRsvps ?? 0) > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                      {upcomingRsvps} upcoming
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <Link href="/performers" className="text-[var(--color-accent-primary)] hover:underline">Explore Performers</Link>
              </li>
              <li>
                <Link href="/studios" className="text-[var(--color-accent-primary)] hover:underline">Find Studios</Link>
              </li>
              <li>
                <Link href="/dashboard/blog" className="text-[var(--color-accent-primary)] hover:underline">My Blog Posts</Link>
              </li>
              <li>
                <Link href="/dashboard/my-events" className="text-[var(--color-accent-primary)] hover:underline">
                  My Events
                  {isApprovedHost && " (Host Dashboard)"}
                </Link>
              </li>
              <li>
                <Link href="/dashboard/invitations" className="text-[var(--color-accent-primary)] hover:underline">
                  Co-host Invitations
                  {(pendingInvitations ?? 0) > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                      {pendingInvitations} pending
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <Link href="/dashboard/notifications" className="text-[var(--color-accent-primary)] hover:underline">
                  Notifications
                  {(unreadNotifications ?? 0) > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-xs rounded-full">
                      {unreadNotifications} new
                    </span>
                  )}
                </Link>
              </li>

              {p?.role === "performer" && (
                <>
                  <li>
                    <Link href="/events" className="text-[var(--color-accent-primary)] hover:underline">Find Open Mic Slots</Link>
                  </li>
                  <li>
                    <Link href={`/performers/${user.id}`} className="text-[var(--color-accent-primary)] hover:underline">View My Public Profile</Link>
                  </li>
                </>
              )}

              {p?.role === "studio" && (
                <li>
                  <Link href="/studios" className="text-[var(--color-accent-primary)] hover:underline">Manage Your Services (coming soon)</Link>
                </li>
              )}

              {p?.role === "host" && (
                <li>
                  <Link href="/events/manage" className="text-[var(--color-accent-primary)] hover:underline">Host Dashboard (coming soon)</Link>
                </li>
              )}

              {p?.role === "admin" && (
                <li>
                  <Link href="/dashboard/admin" className="text-[var(--color-accent-primary)] hover:underline">Admin Panel</Link>
                </li>
              )}

              <li className="pt-4 mt-4 border-t border-[var(--color-border-default)]">
                <Link href="/dashboard/settings" className="text-[var(--color-accent-primary)] hover:underline">Account Settings</Link>
              </li>
            </ul>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
