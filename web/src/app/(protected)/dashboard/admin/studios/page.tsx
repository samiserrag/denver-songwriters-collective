import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudioSpotlightTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AdminStudiosPage() {
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

  const { data: studios } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "studio")
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-8">
        Manage Featured Studios
      </h1>

      <p className="text-neutral-300 mb-6">
        Toggle spotlight status or adjust ranking for homepage ordering.
      </p>

      <StudioSpotlightTable studios={studios as Profile[]} />
    </div>
  );
}
