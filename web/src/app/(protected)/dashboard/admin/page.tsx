import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteStyleSettings } from "@/components/admin/SiteStyleSettings";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  // Fetch counts and site settings in parallel
  const [
    eventsRes,
    performersRes,
    studiosRes,
    suggestionsRes,
    usersRes,
    pendingBlogRes,
    pendingGalleryRes,
    hostRequestsRes,
    siteSettings,
  ] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).or("is_songwriter.eq.true,role.eq.performer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).or("is_studio.eq.true,role.eq.studio"),
    supabase.from("event_update_suggestions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("gallery_images").select("*", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("host_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    getSiteSettings(),
  ]);

  const eventsCount = (eventsRes as { count: number | null }).count ?? 0;
  const performersCount = (performersRes as { count: number | null }).count ?? 0;
  const studiosCount = (studiosRes as { count: number | null }).count ?? 0;
  const pendingSuggestions = (suggestionsRes as { count: number | null }).count ?? 0;
  const usersCount = (usersRes as { count: number | null }).count ?? 0;
  const pendingBlog = (pendingBlogRes as { count: number | null }).count ?? 0;
  const pendingGallery = (pendingGalleryRes as { count: number | null }).count ?? 0;
  const pendingHostRequests = (hostRequestsRes as { count: number | null }).count ?? 0;

  // Calculate total pending items
  const totalPending = pendingSuggestions + pendingBlog + pendingGallery + pendingHostRequests;

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="font-[var(--font-family-display)] text-3xl text-[var(--color-text-primary)]">
            Admin Dashboard
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Manage all aspects of the platform.
          </p>
        </div>

        {/* Quick Stats */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/dashboard/admin/events" className="text-center p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{eventsCount}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">Happenings</div>
            </Link>
            <Link href="/dashboard/admin/users" className="text-center p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{usersCount}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">Users</div>
            </Link>
            <Link href="/dashboard/admin/performers" className="text-center p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{performersCount}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">Songwriters</div>
            </Link>
            <Link href="/dashboard/admin/studios" className="text-center p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{studiosCount}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">Studios</div>
            </Link>
          </div>
        </section>

        {/* Pending Review - Only show if there are items */}
        {totalPending > 0 && (
          <section className="mb-8 p-6 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h2 className="text-lg font-semibold text-amber-600 mb-4 flex items-center gap-2">
              <span>Pending Review ({totalPending})</span>
            </h2>
            <div className="space-y-2">
              {pendingHostRequests > 0 && (
                <Link
                  href="/dashboard/admin/host-requests"
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <span className="text-[var(--color-text-primary)]">Host Requests</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 text-sm rounded-full">{pendingHostRequests}</span>
                </Link>
              )}
              {pendingBlog > 0 && (
                <Link
                  href="/dashboard/admin/blog"
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <span className="text-[var(--color-text-primary)]">Blog Posts</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 text-sm rounded-full">{pendingBlog}</span>
                </Link>
              )}
              {pendingGallery > 0 && (
                <Link
                  href="/dashboard/admin/gallery"
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <span className="text-[var(--color-text-primary)]">Gallery Photos</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 text-sm rounded-full">{pendingGallery}</span>
                </Link>
              )}
              {pendingSuggestions > 0 && (
                <Link
                  href="/dashboard/admin/event-update-suggestions"
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <span className="text-[var(--color-text-primary)]">Event Suggestions</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 text-sm rounded-full">{pendingSuggestions}</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Content Management */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Content Management</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/events"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Manage Happenings</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Edit happening details, status, and verification</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/open-mics"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Open Mic Status</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Review and verify open mic listings</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/venues"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Manage Venues</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Review submissions and manage canonical venues</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/blog"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Manage Blog</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Create, edit, and publish blog posts</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/gallery"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Manage Gallery</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Upload photos, create albums, approve submissions</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/highlights"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Monthly Highlights</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Feature content on the homepage</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
          </div>
        </section>

        {/* Operations */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Operations</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/ops"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Ops Console</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Bulk CSV operations for happenings, venues, and overrides</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
          </div>
        </section>

        {/* Community & Users */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Community & Users</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/users"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Manage Users</span>
                <p className="text-sm text-[var(--color-text-secondary)]">View user profiles, roles, and permissions</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/performers"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Songwriters</span>
                <p className="text-sm text-[var(--color-text-secondary)]">View and edit songwriter profiles</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/studios"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Studios</span>
                <p className="text-sm text-[var(--color-text-secondary)]">View and edit studio listings</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/host-requests"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Host Requests</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Approve users requesting to become event hosts</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/newsletter"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Newsletter</span>
                <p className="text-sm text-[var(--color-text-secondary)]">View subscribers and export emails</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
          </div>
        </section>

        {/* Moderation */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Moderation</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/verifications"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Change Reports</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Review community-submitted corrections</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
            <Link
              href="/dashboard/admin/event-update-suggestions"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Event Suggestions</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Approve or reject user-submitted corrections</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
          </div>
        </section>

        {/* Site Configuration */}
        <section className="mb-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Site Configuration</h2>
          <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <span className="text-[var(--color-text-primary)] font-medium">Theme & Fonts</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Set the default site appearance</p>
              </div>
              <SiteStyleSettings
                initialTheme={siteSettings.themePreset}
                initialFont={siteSettings.fontPreset}
              />
            </div>
          </div>
        </section>

        {/* System */}
        <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">System</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/logs"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors group"
            >
              <div>
                <span className="text-[var(--color-text-primary)] font-medium">Application Logs</span>
                <p className="text-sm text-[var(--color-text-secondary)]">Debug errors and monitor activity</p>
              </div>
              <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-accent)]">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
