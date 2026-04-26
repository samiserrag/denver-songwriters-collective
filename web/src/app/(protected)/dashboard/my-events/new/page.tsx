import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import EventForm from "../_components/EventForm";
import { checkHostStatus } from "@/lib/auth/adminAuth";

export const metadata = {
  title: "Create Happening | CSC"
};

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string }>;
}) {
  const params = await searchParams;
  const forceClassic = params.classic === "true";

  // -------------------------------------------------------------------------
  // Phase 8E: Feature flag for conversational create entrypoint chooser.
  // Evaluated inside the function body so it reads runtime env vars on each
  // request (module-level NEXT_PUBLIC_* gets inlined at build time).
  // -------------------------------------------------------------------------
  const CONVERSATIONAL_CREATE_ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY === "true" ||
    process.env.ENABLE_CONVERSATIONAL_CREATE_ENTRY === "true";

  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  // Check if user can create CSC-branded events (approved host or admin)
  const isApprovedHost = await checkHostStatus(supabase, sessionUser.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const canCreateCSC = isApprovedHost || isAdmin;

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state, google_maps_url, map_link, website_url")
    .order("name", { ascending: true });

  // Phase 8E: show chooser when flag ON and not forced classic
  const showChooser = CONVERSATIONAL_CREATE_ENABLED && !forceClassic;

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">Create Happening</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            {canCreateCSC
              ? "Set up a new community happening or official CSC happening"
              : "Set up a new community happening"}
          </p>
        </div>

        {/* Phase 8E: Conversational create chooser (flag-gated) */}
        {showChooser && (
          <div className="mb-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/dashboard/my-events/new/conversational"
              className="block rounded-lg border border-[var(--color-border-input)] p-4 hover:border-[var(--color-accent-primary)] transition-colors group"
            >
              <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-primary)] transition-colors">
                ✨ Create with AI
              </p>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                Describe your happening in plain language. AI creates a draft first, then you publish when ready.
              </p>
            </Link>
            <Link
              href="/dashboard/my-events/new?classic=true"
              className="block rounded-lg border border-[var(--color-border-input)] p-4 hover:border-[var(--color-accent-primary)] transition-colors group"
            >
              <p className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-primary)] transition-colors">
                Use classic form
              </p>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                Fill out the standard form with all fields manually.
              </p>
            </Link>
          </div>
        )}

        {/* UX-13: Allow approved hosts (not just admins) to create venues */}
        <EventForm mode="create" venues={venues ?? []} canCreateCSC={canCreateCSC} canCreateVenue={isAdmin || isApprovedHost} />
      </div>
    </main>
  );
}
