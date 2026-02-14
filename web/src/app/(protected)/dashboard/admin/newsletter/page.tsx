import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import SelectableTextarea from "./SelectableTextarea";

export const dynamic = "force-dynamic";

export default async function NewsletterAdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  // Fetch all newsletter subscribers
  const { data: subscribers, error } = await supabase
    .from("newsletter_subscribers")
    .select("*")
    .order("subscribed_at", { ascending: false });

  if (error) {
    console.error("Error fetching subscribers:", error);
  }

  const activeSubscribers = subscribers?.filter((s) => !s.unsubscribed_at) ?? [];
  const unsubscribed = subscribers?.filter((s) => s.unsubscribed_at) ?? [];

  // Group by source
  const sourceStats: Record<string, number> = {};
  activeSubscribers.forEach((s) => {
    const src = s.source || "unknown";
    sourceStats[src] = (sourceStats[src] || 0) + 1;
  });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/admin"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          &larr; Back to Admin
        </Link>
      </div>

      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">Newsletter Subscribers</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Manage your newsletter subscriber list. Export emails for bulk sending.
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-[var(--color-border-default)] card-base text-center">
          <p className="text-3xl font-bold text-emerald-400">{activeSubscribers.length}</p>
          <p className="text-[var(--color-text-secondary)] text-sm">Active Subscribers</p>
        </div>
        <div className="p-4 rounded-lg border border-[var(--color-border-default)] card-base text-center">
          <p className="text-3xl font-bold text-red-400">{unsubscribed.length}</p>
          <p className="text-[var(--color-text-secondary)] text-sm">Unsubscribed</p>
        </div>
        {Object.entries(sourceStats).map(([source, count]) => (
          <div key={source} className="p-4 rounded-lg border border-[var(--color-border-default)] card-base text-center">
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">{count}</p>
            <p className="text-[var(--color-text-secondary)] text-sm capitalize">From {source}</p>
          </div>
        ))}
      </div>

      {/* Export Section */}
      <div className="mb-8 p-4 rounded-lg border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Export Emails</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Copy the list below to use with your email service (Mailchimp, ConvertKit, etc.)
        </p>
        <SelectableTextarea value={activeSubscribers.map((s) => s.email).join("\n")} />
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          Click the text area to select all emails
        </p>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-lg border border-[var(--color-border-default)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-tertiary)]">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">Source</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">Subscribed</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-default)]">
            {subscribers?.map((subscriber) => (
              <tr key={subscriber.id} className="hover:bg-[var(--color-bg-secondary)]">
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{subscriber.email}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] capitalize">{subscriber.source || "—"}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  {subscriber.subscribed_at
                    ? new Date(subscriber.subscribed_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/Denver",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {subscriber.unsubscribed_at ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Unsubscribed</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Active</span>
                  )}
                </td>
              </tr>
            ))}
            {(!subscribers || subscribers.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  No subscribers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
