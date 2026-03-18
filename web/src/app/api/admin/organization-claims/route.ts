import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, sessionUser.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("organization_claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: claims, error } = await query;
    if (error) {
      console.error("[AdminOrganizationClaims] Fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch claims" }, { status: 500 });
    }

    const organizationIds = [...new Set((claims || []).map((c) => c.organization_id))];
    const requesterIds = [...new Set((claims || []).map((c) => c.requester_id))];

    const { data: organizations } =
      organizationIds.length > 0
        ? await supabase
            .from("organizations")
            .select("id, slug, name, city, organization_type")
            .in("id", organizationIds)
        : { data: [] };

    const { data: requesters } =
      requesterIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, slug, full_name, email")
            .in("id", requesterIds)
        : { data: [] };

    const organizationMap = new Map((organizations || []).map((row) => [row.id, row]));
    const requesterMap = new Map((requesters || []).map((row) => [row.id, row]));

    const enrichedClaims = (claims || []).map((claim) => ({
      ...claim,
      organization: organizationMap.get(claim.organization_id) || null,
      requester: requesterMap.get(claim.requester_id) || null,
    }));

    return NextResponse.json({ claims: enrichedClaims });
  } catch (error) {
    console.error("[AdminOrganizationClaims] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
