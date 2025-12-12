import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EventCreateForm from "./EventCreateForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) {
    return <div className="p-8 text-red-500">You must be logged in.</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return <div className="p-8 text-red-500">Access denied — admin only.</div>;
  }

  // Fetch venues for the dropdown
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/admin/events" className="text-teal-400 hover:underline">
          ← Back to Events
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-gold-400 mb-8">Add New Event</h1>
      <EventCreateForm venues={venues ?? []} />
    </div>
  );
}
