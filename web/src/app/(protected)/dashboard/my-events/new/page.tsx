import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../_components/EventForm";
import { checkHostStatus } from "@/lib/auth/adminAuth";

export const metadata = {
  title: "Create Happening | CSC"
};

export default async function NewEventPage() {
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

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">Create Happening</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          {canCreateCSC
            ? "Set up a new community happening or official CSC happening"
            : "Set up a new community happening"}
        </p>

        <EventForm mode="create" venues={venues ?? []} canCreateCSC={canCreateCSC} canCreateVenue={isAdmin} />
      </div>
    </main>
  );
}
