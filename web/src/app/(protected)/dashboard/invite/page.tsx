import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InvitePanel from "./InvitePanel";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  return <InvitePanel inviterName={profile?.full_name ?? null} source="dashboard_invite" />;
}
