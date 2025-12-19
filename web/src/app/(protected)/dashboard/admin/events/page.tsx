import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventSpotlightTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];

export default async function AdminEventsPage() {
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

   const { data, error } = await supabase
     .from("events")
     .select("*, venues(id, name)")
     .order("title", { ascending: true });

   // CRITICAL: Always pass an array, never null
   const events = Array.isArray(data) ? data : [];

   if (error) {
     console.error("Failed to fetch events:", error);
   }

   return (
     <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
       <div className="flex items-center justify-between mb-8">
         <h1 className="text-4xl font-bold text-[var(--color-text-accent)]">Manage Events</h1>
         <Link
           href="/dashboard/admin/events/new"
           className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-[var(--color-text-primary)] font-medium transition-colors"
         >
           + Add New Event
         </Link>
       </div>
       <EventSpotlightTable events={events} />
     </div>
   );
 }
