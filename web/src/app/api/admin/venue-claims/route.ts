/**
 * Admin Venue Claims API - ABC8
 *
 * GET: List all venue claims (with filtering)
 */

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

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, approved, rejected, cancelled

    // Fetch claims
    let query = supabase
      .from("venue_claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: claims, error } = await query;

    if (error) {
      console.error("[AdminVenueClaims] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch claims" },
        { status: 500 }
      );
    }

    // Fetch venue and requester details
    const venueIds = [...new Set(claims.map((c) => c.venue_id))];
    const requesterIds = [...new Set(claims.map((c) => c.requester_id))];

    const { data: venues } =
      venueIds.length > 0
        ? await supabase
            .from("venues")
            .select("id, name, slug, city, state")
            .in("id", venueIds)
        : { data: [] };

    const { data: requesters } =
      requesterIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, slug, full_name, email")
            .in("id", requesterIds)
        : { data: [] };

    const venueMap = new Map((venues || []).map((v) => [v.id, v]));
    const requesterMap = new Map((requesters || []).map((r) => [r.id, r]));

    // Enrich claims with venue and requester info
    const enrichedClaims = claims.map((claim) => ({
      ...claim,
      venue: venueMap.get(claim.venue_id) || null,
      requester: requesterMap.get(claim.requester_id) || null,
    }));

    return NextResponse.json({ claims: enrichedClaims });
  } catch (error) {
    console.error("[AdminVenueClaims] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
