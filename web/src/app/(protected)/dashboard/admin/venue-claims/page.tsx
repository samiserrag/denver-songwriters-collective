/**
 * Admin Venue Claims Page - ABC8
 *
 * Review and manage venue ownership claims.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { VenueClaimsTable } from "./_components/VenueClaimsTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface VenueClaim {
  id: string;
  venue_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  venue: {
    id: string;
    slug: string | null;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
  requester: {
    id: string;
    slug: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
}

export default async function AdminVenueClaimsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect("/login?redirect=/dashboard/admin/venue-claims");
  }

  const isAdmin = await checkAdminRole(supabase, sessionUser.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch all claims
  const { data: claims, error } = await supabase
    .from("venue_claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminVenueClaims] Fetch error:", error);
  }

  // Enrich with venue and requester details
  const venueIds = [...new Set((claims || []).map((c) => c.venue_id))];
  const requesterIds = [...new Set((claims || []).map((c) => c.requester_id))];

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

  const enrichedClaims: VenueClaim[] = (claims || []).map((claim) => ({
    ...claim,
    venue: venueMap.get(claim.venue_id) || null,
    requester: requesterMap.get(claim.requester_id) || null,
  }));

  const pendingClaims = enrichedClaims.filter((c) => c.status === "pending");
  const resolvedClaims = enrichedClaims.filter((c) => c.status !== "pending");

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Venue Claims
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Review and approve venue ownership requests
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back to Admin
        </Link>
      </div>

      {/* Pending Claims */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Pending Claims ({pendingClaims.length})
        </h2>

        {pendingClaims.length > 0 ? (
          <VenueClaimsTable
            claims={pendingClaims}
            adminId={sessionUser.id}
            showActions={true}
          />
        ) : (
          <div className="p-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
            <p className="text-[var(--color-text-secondary)]">
              No pending claims to review.
            </p>
          </div>
        )}
      </section>

      {/* Resolved Claims */}
      {resolvedClaims.length > 0 && (
        <section>
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Resolved Claims ({resolvedClaims.length})
            </summary>

            <VenueClaimsTable
              claims={resolvedClaims}
              adminId={sessionUser.id}
              showActions={false}
            />
          </details>
        </section>
      )}
    </div>
  );
}
