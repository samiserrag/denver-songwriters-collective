/**
 * Admin Digest History API
 *
 * GET /api/admin/digest/history — Fetch send history from digest_send_log
 *
 * Returns the most recent sends, ordered by sent_at descending.
 * Admin-only.
 *
 * Phase: GTM-2
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();

  const { data, error } = await (serviceClient as any)
    .from("digest_send_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[AdminDigestHistory] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ history: data ?? [] });
}
