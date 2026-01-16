import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/adminAuth";
import LogsTable from "./_components/LogsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application Logs | Admin",
};

interface AppLog {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: Record<string, unknown>;
  user_id: string | null;
  user_email: string | null;
  source: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

export default async function AdminLogsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
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

  // Fetch recent logs (last 7 days, max 500)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: logs, error } = await supabase
    .from("app_logs")
    .select("*")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error fetching logs:", error);
  }

  // Get log stats
  const errorCount = logs?.filter((l) => l.level === "error").length || 0;
  const warnCount = logs?.filter((l) => l.level === "warn").length || 0;
  const infoCount = logs?.filter((l) => l.level === "info").length || 0;
  const debugCount = logs?.filter((l) => l.level === "debug").length || 0;

  // Get unique sources
  const sources = [...new Set(logs?.map((l) => l.source).filter(Boolean) || [])];

  const currentUserIsSuperAdmin = isSuperAdmin(user.email);

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-3">
          Application Logs
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Debug errors and monitor application activity. Showing last 7 days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="text-3xl font-bold text-red-500">{errorCount}</div>
          <div className="text-sm text-red-400">Errors</div>
        </div>
        <div className="p-4 bg-amber-100 border border-amber-300 rounded-lg">
          <div className="text-3xl font-bold text-amber-700">{warnCount}</div>
          <div className="text-sm text-amber-600">Warnings</div>
        </div>
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="text-3xl font-bold text-blue-500">{infoCount}</div>
          <div className="text-sm text-blue-400">Info</div>
        </div>
        <div className="p-4 bg-gray-500/10 border border-gray-500/30 rounded-lg">
          <div className="text-3xl font-bold text-gray-500">{debugCount}</div>
          <div className="text-sm text-gray-400">Debug</div>
        </div>
      </div>

      {/* Logs Table */}
      <LogsTable
        logs={(logs || []) as AppLog[]}
        sources={sources as string[]}
        isSuperAdmin={currentUserIsSuperAdmin}
      />
    </div>
  );
}
