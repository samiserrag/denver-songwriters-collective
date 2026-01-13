/**
 * Edit Venue Page - ABC9
 *
 * Allows venue managers to edit venue information.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { isVenueManager, getVenueRole } from "@/lib/venue/managerAuth";
import VenueEditForm from "./_components/VenueEditForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Venue | DSC",
};

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: venueId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirect=/dashboard/my-venues/${venueId}`);
  }

  // Fetch venue
  const { data: venue, error } = await supabase
    .from("venues")
    .select(
      "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
    )
    .eq("id", venueId)
    .single();

  if (error || !venue) {
    notFound();
  }

  // Check authorization: must be venue manager OR admin
  const [isManager, isAdmin, role] = await Promise.all([
    isVenueManager(supabase, venueId, session.user.id),
    checkAdminRole(supabase, session.user.id),
    getVenueRole(supabase, venueId, session.user.id),
  ]);

  if (!isManager && !isAdmin) {
    redirect("/dashboard/my-venues");
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/my-venues"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to My Venues
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Edit Venue
              </h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                {venue.name}
              </p>
            </div>
            {role && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  role === "owner"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {role === "owner" ? "Owner" : "Manager"}
              </span>
            )}
            {isAdmin && !isManager && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Public Profile Link */}
        <div className="mb-6 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              View public venue page
            </span>
            <Link
              href={`/venues/${venue.slug || venue.id}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline"
              target="_blank"
            >
              /venues/{venue.slug || venue.id} →
            </Link>
          </div>
        </div>

        {/* Edit Form */}
        <VenueEditForm venue={venue} />
      </div>
    </main>
  );
}
