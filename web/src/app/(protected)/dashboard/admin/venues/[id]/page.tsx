/**
 * Admin Venue Detail Page - ABC9
 *
 * Shows venue details and managers list for admins.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { readMediaEmbeds } from "@/lib/mediaEmbedsServer";
import VenueManagersList from "./_components/VenueManagersList";
import VenueEditHistory from "./_components/VenueEditHistory";
import VenueInviteSection from "./_components/VenueInviteSection";
import VenueEditForm from "@/app/(protected)/dashboard/my-venues/[id]/_components/VenueEditForm";
import { VenuePhotosSection } from "@/components/venue/VenuePhotosSection";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Venue Details | Admin | CSC",
};

export default async function AdminVenueDetailPage({
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
    redirect("/login");
  }

  const isAdmin = await checkAdminRole(supabase, sessionUser.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Use service role to fetch venue and managers
  const serviceClient = createServiceRoleClient();

  // Fetch venue (all fields needed for edit form)
  const { data: venue, error } = await serviceClient
    .from("venues")
    .select("id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url, created_at")
    .eq("id", venueId)
    .single();

  if (error || !venue) {
    notFound();
  }

  // Fetch managers with profile info
  const { data: managers } = await serviceClient
    .from("venue_managers")
    .select("id, venue_id, user_id, role, grant_method, created_at, revoked_at, revoked_by, revoked_reason, created_by")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  // Fetch profile info for managers
  const managerUserIds = [...new Set(managers?.map((m) => m.user_id) || [])];
  const creatorUserIds = [...new Set(managers?.map((m) => m.created_by).filter(Boolean) || [])] as string[];
  const allUserIds = [...new Set([...managerUserIds, ...creatorUserIds])];

  let profiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (allUserIds.length > 0) {
    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", allUserIds);
    profiles = profileData || [];
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Fetch pending claims for this venue
  const { data: pendingClaims } = await serviceClient
    .from("venue_claims")
    .select("id, requester_id, message, created_at")
    .eq("venue_id", venueId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Get requester profiles for claims
  const claimUserIds = pendingClaims?.map((c) => c.requester_id) || [];
  let claimProfiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (claimUserIds.length > 0) {
    const { data: claimProfileData } = await serviceClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", claimUserIds);
    claimProfiles = claimProfileData || [];
  }
  const claimProfileMap = new Map(claimProfiles.map((p) => [p.id, p]));

  // Fetch active invites (not accepted, not revoked - includes expired for display)
  const { data: activeInvites } = await serviceClient
    .from("venue_invites")
    .select("id, email_restriction, created_at, expires_at, created_by")
    .eq("venue_id", venueId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Fetch profiles for invite creators
  const inviteCreatorIds = [...new Set(activeInvites?.map((i) => i.created_by).filter(Boolean) || [])] as string[];
  let inviteCreatorProfiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (inviteCreatorIds.length > 0) {
    const { data: inviteProfileData } = await serviceClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", inviteCreatorIds);
    inviteCreatorProfiles = inviteProfileData || [];
  }
  const inviteProfileMap = new Map(inviteCreatorProfiles.map((p) => [p.id, p]));

  // Fetch venue images and media embeds in parallel
  const [{ data: venueImages }, existingEmbeds] = await Promise.all([
    serviceClient
      .from("venue_images")
      .select("id, venue_id, image_url, storage_path, uploaded_by, created_at, deleted_at")
      .eq("venue_id", venueId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    readMediaEmbeds(serviceClient, { type: "venue", id: venueId }).catch(() => []),
  ]);

  const initialMediaEmbedUrls = existingEmbeds.map((e: { url: string }) => e.url);

  // Fetch venue edit audit logs
  const { data: auditLogs } = await serviceClient
    .from("app_logs")
    .select("id, created_at, context, user_id")
    .eq("source", "venue_audit")
    .contains("context", { venueId })
    .order("created_at", { ascending: false })
    .limit(50);

  // Get profiles for audit log actors
  const auditUserIds = [...new Set(auditLogs?.map((l) => l.user_id).filter(Boolean) || [])] as string[];
  let auditProfiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
  if (auditUserIds.length > 0) {
    const { data: auditProfileData } = await serviceClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", auditUserIds);
    auditProfiles = auditProfileData || [];
  }

  const managersWithProfiles = managers?.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id),
    createdByProfile: m.created_by ? profileMap.get(m.created_by) : undefined,
  })) || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/admin/venues"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to Venue Management
          </Link>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                {venue.name}
              </h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                {venue.address && `${venue.address}, `}
                {venue.city}, {venue.state} {venue.zip}
              </p>
            </div>
            <Link
              href={`/venues/${venue.slug || venue.id}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline"
              target="_blank"
            >
              View public page →
            </Link>
          </div>
        </div>

        {/* Venue Edit Form Section */}
        <section className="mb-10 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Edit Venue Information
          </h2>
          <VenueEditForm venue={{
            id: venue.id,
            name: venue.name,
            slug: venue.slug,
            address: venue.address || "",
            city: venue.city || "",
            state: venue.state || "",
            zip: venue.zip,
            phone: venue.phone,
            website_url: venue.website_url,
            google_maps_url: venue.google_maps_url,
            map_link: venue.map_link,
            contact_link: venue.contact_link,
            neighborhood: venue.neighborhood,
            accessibility_notes: venue.accessibility_notes,
            parking_notes: venue.parking_notes,
            cover_image_url: venue.cover_image_url,
          }} initialMediaEmbedUrls={initialMediaEmbedUrls} />
        </section>

        {/* Venue Photos Section */}
        <section className="mb-10">
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
        </section>

        {/* Active Managers Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Venue Managers
            </h2>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {managersWithProfiles.filter((m) => !m.revoked_at).length} active
            </span>
          </div>

          <VenueManagersList
            managers={managersWithProfiles}
            venueId={venueId}
            venueName={venue.name}
          />
        </section>

        {/* Pending Claims Section */}
        {pendingClaims && pendingClaims.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Pending Claims
            </h2>
            <div className="space-y-3">
              {pendingClaims.map((claim) => {
                const profile = claimProfileMap.get(claim.requester_id);
                return (
                  <div
                    key={claim.id}
                    className="p-4 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {profile?.full_name || profile?.email || "Unknown user"}
                        </p>
                        {claim.message && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            &quot;{claim.message}&quot;
                          </p>
                        )}
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                          Submitted {formatDate(claim.created_at)}
                        </p>
                      </div>
                      <Link
                        href="/dashboard/admin/venue-claims"
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 hover:bg-amber-300 dark:hover:bg-amber-500/30"
                      >
                        Review Claims
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Venue Invites Section - ABC11a/b */}
        <VenueInviteSection
          venueId={venueId}
          venueName={venue.name}
          invites={activeInvites || []}
          profiles={inviteProfileMap}
        />

        {/* Revoked Managers Section */}
        {managersWithProfiles.some((m) => m.revoked_at) && (
          <section className="mb-10">
            <details className="group">
              <summary className="cursor-pointer text-lg font-semibold text-[var(--color-text-secondary)] mb-4 hover:text-[var(--color-text-primary)]">
                <span className="group-open:hidden">▶</span>
                <span className="hidden group-open:inline">▼</span>
                {" "}Revoked Access ({managersWithProfiles.filter((m) => m.revoked_at).length})
              </summary>
              <div className="space-y-3 mt-4">
                {managersWithProfiles
                  .filter((m) => m.revoked_at)
                  .map((manager) => (
                    <div
                      key={manager.id}
                      className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] opacity-60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)] line-through">
                            {manager.profile?.full_name ||
                              manager.profile?.email ||
                              "Unknown user"}
                          </p>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                            Was: {manager.role} via {manager.grant_method}
                          </p>
                          {manager.revoked_reason && (
                            <p className="text-xs text-red-800 dark:text-red-400 mt-1">
                              Reason: {manager.revoked_reason}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400">
                          Revoked
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          </section>
        )}

        {/* Edit History Section */}
        <section>
          <details className="group">
            <summary className="cursor-pointer text-lg font-semibold text-[var(--color-text-secondary)] mb-4 hover:text-[var(--color-text-primary)]">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              {" "}Edit History ({auditLogs?.length || 0})
            </summary>
            <div className="mt-4">
              <VenueEditHistory
                logs={(auditLogs || []).map((log) => ({
                  id: log.id,
                  created_at: log.created_at,
                  context: log.context as {
                    action: string;
                    actorId: string;
                    actorRole: string;
                    venueId: string;
                    venueName?: string;
                    updatedFields: string[];
                    previousValues: Record<string, unknown>;
                    newValues: Record<string, unknown>;
                    reason?: string;
                    revertedLogId?: string;
                  },
                  user_id: log.user_id,
                }))}
                profiles={auditProfiles}
                venueId={venueId}
                venueName={venue.name}
              />
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
