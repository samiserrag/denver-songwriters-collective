import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminVenuesClient from "./AdminVenuesClient";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;

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

  return <AdminVenuesClient />;
}
