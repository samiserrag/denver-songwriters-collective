import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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
      <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="text-neutral-400 mt-2">Admin privileges required.</p>
      </div>
    );
  }

  // Fetch counts for stats
  const [
    eventsRes,
    performersRes,
    studiosRes,
    suggestionsRes,
    usersRes,
  ] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "performer"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "studio"),
    supabase.from("event_update_suggestions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  const eventsCount = (eventsRes as any).count ?? 0;
  const performersCount = (performersRes as any).count ?? 0;
  const studiosCount = (studiosRes as any).count ?? 0;
  const pendingSuggestions = (suggestionsRes as any).count ?? 0;
  const usersCount = (usersRes as any).count ?? 0;

  const stats = [
    { label: "Events", value: eventsCount || 0, href: "/dashboard/admin/events" },
    { label: "Performers", value: performersCount || 0, href: "/dashboard/admin/performers" },
    { label: "Studios", value: studiosCount || 0, href: "/dashboard/admin/studios" },
    { label: "Users", value: usersCount || 0, href: "/dashboard/admin/users" },
    { label: "Pending Suggestions", value: pendingSuggestions || 0, href: "/dashboard/admin/event-update-suggestions", highlight: (pendingSuggestions || 0) > 0 },
  ];

  const adminLinks = [
    { href: "/dashboard/admin/highlights", title: "Monthly Highlights", description: "Feature content on the homepage - events, performers, announcements" },
    { href: "/dashboard/admin/events", title: "Manage Events", description: "Edit event details, status, and featured rankings" },
    { href: "/dashboard/admin/dsc-events", title: "DSC Events", description: "View and moderate community-created events" },
    { href: "/dashboard/admin/event-update-suggestions", title: "Review Suggestions", description: "Approve or reject user-submitted corrections" },
    { href: "/dashboard/admin/host-requests", title: "Host Requests", description: "Approve users requesting to become event hosts" },
    { href: "/dashboard/admin/venues", title: "Manage Venues", description: "Review submissions and manage canonical venues" },
    { href: "/dashboard/admin/performers", title: "Manage Performers", description: "View and edit performer profiles" },
    { href: "/dashboard/admin/studios", title: "Manage Studios", description: "View and edit studio listings" },
    { href: "/dashboard/admin/users", title: "Manage Users", description: "View user profiles and roles" },
    { href: "/dashboard/admin/blog", title: "Manage Blog", description: "Create, edit, and publish blog posts" },
    { href: "/dashboard/admin/gallery", title: "Manage Gallery", description: "Upload photos, create albums, approve submissions" },
  ];

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-2">Admin Dashboard</h1>
      <p className="text-neutral-300 mb-8">Manage all aspects of the platform.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`p-4 rounded-lg border text-center hover:border-teal-500 transition-colors ${
              stat.highlight 
                ? "bg-yellow-900/30 border-yellow-600" 
                : "bg-neutral-800/50 border-neutral-700"
            }`}
          >
            <p className={`text-3xl font-bold ${stat.highlight ? "text-yellow-400" : "text-white"}`}>
              {stat.value}
            </p>
            <p className="text-neutral-400 text-sm">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Admin Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-6 bg-neutral-800/50 border border-neutral-700 rounded-lg hover:border-teal-500 transition-colors"
          >
            <h2 className="text-xl font-semibold text-white mb-2">{link.title}</h2>
            <p className="text-neutral-400 text-sm">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
