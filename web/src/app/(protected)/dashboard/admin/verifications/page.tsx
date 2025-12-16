import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChangeReportsTable from "@/components/admin/ChangeReportsTable";

export const dynamic = "force-dynamic";

export interface ChangeReport {
  id: string;
  event_id: string;
  field_name: string;
  proposed_value: string;
  notes: string | null;
  reporter_id: string | null;
  reporter_email: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  events: {
    id: string;
    title: string;
    slug: string | null;
    venue_name: string | null;
    day_of_week: string | null;
    start_time: string | null;
  } | null;
}

export default async function AdminVerificationsPage() {
  const supabase = await createSupabaseServerClient();

  // Support test environments where auth.getSession may not be available on the mocked client.
  let user = null;
  if (typeof supabase.auth.getSession === "function") {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } else {
    const { data: { user: _user } } = await supabase.auth.getUser();
    user = _user ?? null;
  }

  if (!user) {
    return <div className="p-8 text-red-500">You must be logged in.</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return <div className="p-8 text-red-500">Access denied — admin only.</div>;
  }

  // Fetch change reports with event details
  const { data: changeReports, error } = await supabase
    .from("change_reports")
    .select("*, events(id, title, slug, venue_name, day_of_week, start_time)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching change reports:", error);
  }

  // Count pending reports for stats
  const pendingCount = (changeReports ?? []).filter(r => r.status === "pending").length;
  const approvedCount = (changeReports ?? []).filter(r => r.status === "approved").length;
  const rejectedCount = (changeReports ?? []).filter(r => r.status === "rejected").length;

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-4">
        Change Report Verifications
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Review and approve community-submitted corrections for open mic listings.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Pending</div>
        </div>
        <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
          <div className="text-2xl font-bold text-emerald-400">{approvedCount}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Approved</div>
        </div>
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/30">
          <div className="text-2xl font-bold text-red-400">{rejectedCount}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Rejected</div>
        </div>
      </div>

      <ChangeReportsTable reports={(changeReports as ChangeReport[]) ?? []} />
    </div>
  );
}
