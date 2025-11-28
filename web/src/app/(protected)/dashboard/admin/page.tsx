import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-red-500">
        You must be logged in.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="p-8 text-red-500">
        Access denied — admin only.
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-8">
        Admin Dashboard
      </h1>

      <div className="flex flex-col gap-4 text-lg">
        <Link href="/dashboard/admin/performers" className="underline text-gold-400 hover:text-gold-300">
          Manage Featured Performers
        </Link>

        <Link href="/dashboard/admin/studios" className="underline text-gold-400 hover:text-gold-300">
          Manage Featured Studios
        </Link>

        <Link href="/dashboard/admin/events" className="underline text-gold-400 hover:text-gold-300">
          Manage Featured Events
        </Link>

        <Link href="/dashboard/admin/users" className="underline text-gold-400 hover:text-gold-300">
          User Directory
        </Link>
      </div>
    </div>
  );
}
