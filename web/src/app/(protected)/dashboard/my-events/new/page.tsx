import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../_components/EventForm";
import { checkHostStatus } from "@/lib/auth/adminAuth";

export const metadata = {
  title: "Create Event | DSC"
};

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Verify approved host or admin (admins are automatically hosts)
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);

  if (!isApprovedHost) {
    redirect("/dashboard");
  }

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">Create Event</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">Set up a new DSC community event</p>

        <EventForm mode="create" venues={venues ?? []} />
      </div>
    </main>
  );
}
