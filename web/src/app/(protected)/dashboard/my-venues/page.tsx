/**
 * My Venues Dashboard - ABC8
 *
 * Shows venues the user manages and pending claims.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MyVenuesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirect=/dashboard/my-venues");
  }

  // Fetch user's active venue manager grants
  const { data: managerGrants } = await supabase
    .from("venue_managers")
    .select("id, venue_id, role, grant_method, created_at")
    .eq("user_id", session.user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Fetch venue details if grants exist
  let venues: Array<{
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  }> = [];

  if (managerGrants && managerGrants.length > 0) {
    const venueIds = managerGrants.map((g) => g.venue_id);
    const { data: venueData } = await supabase
      .from("venues")
      .select("id, name, slug, city, state")
      .in("id", venueIds);
    venues = venueData || [];
  }

  const venueMap = new Map(venues.map((v) => [v.id, v]));

  // Fetch pending claims
  const { data: pendingClaims } = await supabase
    .from("venue_claims")
    .select("id, venue_id, status, created_at")
    .eq("requester_id", session.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Fetch venue details for pending claims
  let claimVenues: Array<{
    id: string;
    name: string;
    slug: string | null;
  }> = [];

  if (pendingClaims && pendingClaims.length > 0) {
    const claimVenueIds = pendingClaims.map((c) => c.venue_id);
    const { data: claimVenueData } = await supabase
      .from("venues")
      .select("id, name, slug")
      .in("id", claimVenueIds);
    claimVenues = claimVenueData || [];
  }

  const claimVenueMap = new Map(claimVenues.map((v) => [v.id, v]));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            My Venues
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Venues you manage and pending claims
          </p>
        </div>
        <Link
          href="/venues"
          className="px-4 py-2 text-sm bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] transition-colors"
        >
          Browse All Venues
        </Link>
      </div>

      {/* Active Venues */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Venues You Manage
        </h2>

        {managerGrants && managerGrants.length > 0 ? (
          <div className="space-y-3">
            {managerGrants.map((grant) => {
              const venue = venueMap.get(grant.venue_id);
              return (
                <div
                  key={grant.id}
                  className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {venue ? (
                        <>
                          <Link
                            href={`/venues/${venue.slug || venue.id}`}
                            className="text-lg font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                          >
                            {venue.name}
                          </Link>
                          {venue.city && venue.state && (
                            <p className="text-sm text-[var(--color-text-tertiary)]">
                              {venue.city}, {venue.state}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] italic">
                          Venue not found
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          grant.role === "owner"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {grant.role === "owner" ? "Owner" : "Manager"}
                      </span>
                      <Link
                        href={`/dashboard/my-venues/${grant.venue_id}`}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-accent)] transition-colors"
                      >
                        Edit
                      </Link>
                      <RelinquishButton
                        venueId={grant.venue_id}
                        venueName={venue?.name || "this venue"}
                        role={grant.role}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                    Granted via {grant.grant_method} on {formatDate(grant.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
            <p className="text-[var(--color-text-secondary)]">
              You don&apos;t manage any venues yet.
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              Browse venues and claim one you manage, or accept an invite from an admin.
            </p>
          </div>
        )}
      </section>

      {/* Pending Claims */}
      {pendingClaims && pendingClaims.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Pending Claims
          </h2>
          <div className="space-y-3">
            {pendingClaims.map((claim) => {
              const venue = claimVenueMap.get(claim.venue_id);
              return (
                <div
                  key={claim.id}
                  className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      {venue ? (
                        <Link
                          href={`/venues/${venue.slug || venue.id}`}
                          className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                        >
                          {venue.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] italic">
                          Venue not found
                        </span>
                      )}
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Submitted {formatDate(claim.created_at)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
                      Pending Review
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// Client component for relinquish action
function RelinquishButton({
  venueId,
  venueName,
  role,
}: {
  venueId: string;
  venueName: string;
  role: string;
}) {
  return (
    <RelinquishButtonClient venueId={venueId} venueName={venueName} role={role} />
  );
}

// We need a separate client component for the button
import { RelinquishButtonClient } from "./_components/RelinquishButtonClient";
