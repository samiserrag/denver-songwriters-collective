/**
 * My Venues API - ABC8
 *
 * GET: List venues the current user manages
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's active venue manager grants
    const { data: managerGrants, error: grantsError } = await supabase
      .from("venue_managers")
      .select("id, venue_id, role, grant_method, created_at")
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (grantsError) {
      console.error("[MyVenues] Grants fetch error:", grantsError);
      return NextResponse.json(
        { error: "Failed to fetch venue access" },
        { status: 500 }
      );
    }

    if (!managerGrants || managerGrants.length === 0) {
      return NextResponse.json({ venues: [] });
    }

    // Fetch venue details
    const venueIds = managerGrants.map((g) => g.venue_id);
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, slug, city, state, google_maps_url, website_url")
      .in("id", venueIds);

    if (venuesError) {
      console.error("[MyVenues] Venues fetch error:", venuesError);
      return NextResponse.json(
        { error: "Failed to fetch venue details" },
        { status: 500 }
      );
    }

    const venueMap = new Map((venues || []).map((v) => [v.id, v]));

    // Enrich grants with venue info
    const enrichedVenues = managerGrants.map((grant) => ({
      ...grant,
      venue: venueMap.get(grant.venue_id) || null,
    }));

    // Also fetch any pending claims
    const { data: pendingClaims } = await supabase
      .from("venue_claims")
      .select("id, venue_id, status, created_at")
      .eq("requester_id", session.user.id)
      .eq("status", "pending");

    // Fetch venue details for pending claims
    let pendingClaimsEnriched: Array<{
      id: string;
      venue_id: string;
      status: string;
      created_at: string;
      venue: { id: string; name: string; slug: string | null } | null;
    }> = [];

    if (pendingClaims && pendingClaims.length > 0) {
      const claimVenueIds = pendingClaims.map((c) => c.venue_id);
      const { data: claimVenues } = await supabase
        .from("venues")
        .select("id, name, slug")
        .in("id", claimVenueIds);

      const claimVenueMap = new Map((claimVenues || []).map((v) => [v.id, v]));
      pendingClaimsEnriched = pendingClaims.map((claim) => ({
        ...claim,
        venue: claimVenueMap.get(claim.venue_id) || null,
      }));
    }

    return NextResponse.json({
      venues: enrichedVenues,
      pendingClaims: pendingClaimsEnriched,
    });
  } catch (error) {
    console.error("[MyVenues] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
