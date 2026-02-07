import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeReferralParams } from "@/lib/referrals";
import InvitePanel from "./InvitePanel";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ via?: string; src?: string }>;
}

export default async function InvitePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const referralParams = sanitizeReferralParams(params);
  const source = referralParams.via || referralParams.src || "dashboard_invite";

  return <InvitePanel referrerId={session.user.id} source={source} />;
}
