/**
 * Venue Ops Page
 *
 * Admin-only page for venue bulk operations:
 * - CSV export
 * - CSV preview/diff
 * - CSV apply
 * - Google Maps URL helper
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";
import VenueExportCard from "./_components/VenueExportCard";
import VenueImportCard from "./_components/VenueImportCard";
import GoogleMapsHelper from "./_components/GoogleMapsHelper";

export const dynamic = "force-dynamic";

export default async function VenueOpsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch venue count and coverage stats
  const serviceClient = createServiceRoleClient();
  const { data: venues } = await serviceClient
    .from("venues")
    .select("id, google_maps_url");

  const totalVenues = venues?.length || 0;
  const venuesWithMapsUrl = venues?.filter((v) => v.google_maps_url)?.length || 0;
  const coveragePercent = totalVenues > 0
    ? Math.round((venuesWithMapsUrl / totalVenues) * 100)
    : 0;

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">
        Venue Bulk Management
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-2">
        Export, edit, and import venue data via CSV.
      </p>

      {/* Stats */}
      <div className="flex gap-4 mb-8 text-sm">
        <span className="text-[var(--color-text-tertiary)]">
          {totalVenues} venues
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {venuesWithMapsUrl} with Google Maps URL ({coveragePercent}%)
        </span>
      </div>

      <div className="space-y-8">
        {/* Export Section */}
        <VenueExportCard />

        {/* Import Section */}
        <VenueImportCard />

        {/* Google Maps Helper */}
        <GoogleMapsHelper />
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/dashboard/admin/ops"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          ← Back to Ops Console
        </Link>
      </div>
    </div>
  );
}
