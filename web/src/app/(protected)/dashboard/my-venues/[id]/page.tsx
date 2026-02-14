/**
 * Edit Venue Page - ABC9
 *
 * Allows venue managers and event hosts to edit venue information.
 *
 * Phase 0.6: Event hosts/cohosts can now edit venues for their events.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { canEditVenue, getVenueRole, isEventHostAtVenue } from "@/lib/venue/managerAuth";
import { readMediaEmbeds } from "@/lib/mediaEmbedsServer";
import VenueEditForm from "./_components/VenueEditForm";
import { VenuePhotosSection } from "@/components/venue/VenuePhotosSection";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Venue | CSC",
};

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: venueId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect(`/login?redirect=/dashboard/my-venues/${venueId}`);
  }

  // Fetch venue
  const { data: venue, error } = await supabase
    .from("venues")
    .select(
      "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url"
    )
    .eq("id", venueId)
    .single();

  if (error || !venue) {
    notFound();
  }

  // Check authorization: must be venue manager OR admin OR event host at this venue
  // Phase 0.6: canEditVenue now includes event host check
  const [canEdit, isAdmin, role, isEventHost] = await Promise.all([
    canEditVenue(supabase, venueId, sessionUser.id),
    checkAdminRole(supabase, sessionUser.id),
    getVenueRole(supabase, venueId, sessionUser.id),
    isEventHostAtVenue(supabase, venueId, sessionUser.id),
  ]);

  if (!canEdit && !isAdmin) {
    redirect("/dashboard/my-venues");
  }

  // Fetch venue images and media embeds in parallel
  const [{ data: venueImages }, existingEmbeds] = await Promise.all([
    supabase
      .from("venue_images")
      .select("id, venue_id, image_url, storage_path, uploaded_by, created_at, deleted_at")
      .eq("venue_id", venueId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    readMediaEmbeds(supabase, { type: "venue", id: venueId }).catch(() => []),
  ]);

  const initialMediaEmbedUrls = existingEmbeds.map((e: { url: string }) => e.url);

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
            {/* Phase 0.6: Show Event Host badge when accessing via event hosting relationship */}
            {isEventHost && !role && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
                Event Host
              </span>
            )}
            {isAdmin && !role && !isEventHost && (
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
        <VenueEditForm venue={venue} initialMediaEmbedUrls={initialMediaEmbedUrls} />

        {/* Venue Photos Section */}
        <div className="mt-12 pt-8 border-t border-[var(--color-border-default)]">
          <VenuePhotosSection
            venueId={venueId}
            venueName={venue.name}
            currentCoverUrl={venue.cover_image_url}
            initialImages={(venueImages || []) as Array<{
              id: string;
              venue_id: string;
              image_url: string;
              storage_path: string;
              uploaded_by: string | null;
              created_at: string;
              deleted_at: string | null;
            }>}
            userId={sessionUser.id}
          />
        </div>
      </div>
    </main>
  );
}
