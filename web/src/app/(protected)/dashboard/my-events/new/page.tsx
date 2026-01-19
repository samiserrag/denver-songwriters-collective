import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../_components/EventForm";
import { checkHostStatus } from "@/lib/auth/adminAuth";

export const metadata = {
  title: "Create Happening | DSC"
};

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check if user can create DSC-branded events (approved host or admin)
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const canCreateDSC = isApprovedHost || isAdmin;

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state, google_maps_url, map_link, website_url")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">Create Happening</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          {canCreateDSC
            ? "Set up a new community happening or official DSC happening"
            : "Set up a new community happening"}
        </p>

        <EventForm mode="create" venues={venues ?? []} canCreateDSC={canCreateDSC} canCreateVenue={isAdmin} />
      </div>
    </main>
  );
}
