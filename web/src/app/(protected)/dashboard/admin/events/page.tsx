import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventSpotlightTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";


export const dynamic = "force-dynamic";

type HostProfile = { id: string; slug: string | null; full_name: string | null };
type EventHostRelation = { user_id: string; invitation_status: string; role: string };
type AdminEventRow = Database["public"]["Tables"]["events"]["Row"] & {
  venues?: { id: string; name: string } | null;
  is_published?: boolean | null;
  has_timeslots?: boolean | null;
  last_verified_at?: string | null;
  host?: HostProfile | HostProfile[] | null;
  event_hosts?: EventHostRelation[] | null;
};


export default async function AdminEventsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;

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
     .select(`
       *,
       venues(id, name),
       host:profiles!events_host_id_fkey(id, slug, full_name),
       event_hosts(user_id, invitation_status, role)
     `)
     .neq("status", "duplicate")
     .order("title", { ascending: true });

   // CRITICAL: Always pass an array, never null
   const events: AdminEventRow[] = Array.isArray(data) ? (data as AdminEventRow[]) : [];

   // Resolve host names for records where host lives in event_hosts rather than events.host_id.
   const hostIds = new Set<string>();
   for (const event of events) {
     if (event.host_id) hostIds.add(event.host_id);
     for (const hostRow of event.event_hosts ?? []) {
       if (hostRow.invitation_status === "accepted") {
         hostIds.add(hostRow.user_id);
       }
     }
   }

   const hostIdList = Array.from(hostIds);
   const profileMap = new Map<string, { id: string; slug: string | null; full_name: string | null }>();
   if (hostIdList.length > 0) {
     const { data: hostProfiles } = await supabase
       .from("profiles")
       .select("id, slug, full_name")
       .in("id", hostIdList);

     for (const profile of hostProfiles ?? []) {
       profileMap.set(profile.id, profile);
     }
   }

   const normalizedEvents: AdminEventRow[] = events.map((event): AdminEventRow => {
     const acceptedHostIds = (event.event_hosts ?? [])
       .filter((hostRow) => hostRow.invitation_status === "accepted")
       .map((hostRow) => hostRow.user_id);
     const fallbackHostId = event.host_id ?? acceptedHostIds[0] ?? null;
     const existingHost = Array.isArray(event.host) ? event.host[0] : event.host;
     const resolvedHost = existingHost?.id ? existingHost : (fallbackHostId ? profileMap.get(fallbackHostId) ?? null : null);

     return {
       ...event,
       host_id: fallbackHostId,
       host: resolvedHost,
     };
   });

   if (error) {
     console.error("Failed to fetch events:", error);
   }

   return (
     <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
       <div className="flex items-center justify-between mb-8">
         <div>
           <h1 className="text-4xl font-bold text-[var(--color-text-accent)]">Manage Happenings</h1>
           <Link
             href="/dashboard/admin/ops/events"
             className="text-[var(--color-accent-primary)] hover:underline text-sm"
           >
             Bulk operations →
           </Link>
         </div>
         <Link
           href="/dashboard/my-events/new"
           className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-[var(--color-text-primary)] font-medium transition-colors"
         >
           + Add New Happening
         </Link>
       </div>
       <EventSpotlightTable events={normalizedEvents} />
     </div>
   );
 }
