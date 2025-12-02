import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PerformerSpotlightTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AdminPerformersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
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

  const { data: performers } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "performer")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-8">
        Manage Featured Performers
      </h1>

      <p className="text-neutral-300 mb-6">
        Toggle spotlight status or adjust ranking for homepage ordering.
      </p>

      <PerformerSpotlightTable performers={performers as Profile[]} />
    </div>
  );
}
