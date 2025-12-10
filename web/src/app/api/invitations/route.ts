import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Get user's pending invitations
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invitations, error } = await supabase
    .from("event_hosts")
    .select(`
      *,
      event:events(id, title, event_type, venue_name, start_time),
      inviter:profiles!event_hosts_invited_by_fkey(id, full_name)
    `)
    .eq("user_id", session.user.id)
    .eq("invitation_status", "pending")
    .order("invited_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(invitations);
}
