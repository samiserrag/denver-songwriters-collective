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
     .select("*")
     .order("created_at", { ascending: false });

   // CRITICAL: Always pass an array, never null
   const events = Array.isArray(data) ? data : [];

   if (error) {
     console.error("Failed to fetch events:", error);
   }

   return (
     <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
       <h1 className="text-4xl font-bold text-gold-400 mb-8">Manage Featured Events</h1>
       <EventSpotlightTable events={events} />
     </div>
   );
 }
