import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventForm from "../_components/EventForm";

export const metadata = {
  title: "Create Event | DSC"
};

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Verify approved host or admin
  const { data: user } = await supabase.auth.getUser();
  const isAdmin = user?.user?.app_metadata?.role === "admin";

  if (!isAdmin) {
    const { data: hostStatus } = await supabase
      .from("approved_hosts")
      .select("status")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!hostStatus) {
      redirect("/dashboard");
    }
  }

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-warm-white)] mb-2">Create Event</h1>
        <p className="text-[var(--color-warm-gray)] mb-8">Set up a new DSC community event</p>

        <EventForm mode="create" venues={venues ?? []} />
      </div>
    </main>
  );
}
