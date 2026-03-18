import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: managerGrants, error: grantsError } = await supabase
      .from("organization_managers")
      .select("id, organization_id, role, grant_method, created_at")
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (grantsError) {
      console.error("[MyOrganizations] Grants fetch error:", grantsError);
      return NextResponse.json({ error: "Failed to fetch organization access" }, { status: 500 });
    }

    const organizationIds = (managerGrants || []).map((g) => g.organization_id);

    const { data: organizations, error: orgError } = organizationIds.length
      ? await supabase
          .from("organizations")
          .select("id, slug, name, city, organization_type, visibility, website_url")
          .in("id", organizationIds)
      : { data: [], error: null };

    if (orgError) {
      console.error("[MyOrganizations] Organizations fetch error:", orgError);
      return NextResponse.json({ error: "Failed to fetch organization details" }, { status: 500 });
    }

    const organizationMap = new Map((organizations || []).map((row) => [row.id, row]));

    const enrichedOrganizations = (managerGrants || []).map((grant) => ({
      ...grant,
      organization: organizationMap.get(grant.organization_id) || null,
    }));

    const { data: pendingClaims, error: claimsError } = await supabase
      .from("organization_claims")
      .select("id, organization_id, status, created_at")
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (claimsError) {
      console.error("[MyOrganizations] Pending claims fetch error:", claimsError);
      return NextResponse.json({ error: "Failed to fetch pending claims" }, { status: 500 });
    }

    const pendingOrgIds = [...new Set((pendingClaims || []).map((c) => c.organization_id))];
    const { data: pendingClaimOrganizations } = pendingOrgIds.length
      ? await supabase
          .from("organizations")
          .select("id, slug, name")
          .in("id", pendingOrgIds)
      : { data: [] };

    const pendingOrgMap = new Map((pendingClaimOrganizations || []).map((row) => [row.id, row]));

    const pendingClaimsEnriched = (pendingClaims || []).map((claim) => ({
      ...claim,
      organization: pendingOrgMap.get(claim.organization_id) || null,
    }));

    return NextResponse.json({
      organizations: enrichedOrganizations,
      pendingClaims: pendingClaimsEnriched,
    });
  } catch (error) {
    console.error("[MyOrganizations] Unexpected error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
