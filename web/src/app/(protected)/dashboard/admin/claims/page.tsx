import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import ClaimsTable from "./_components/ClaimsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event Claims | Admin Dashboard",
};

interface EventClaim {
  id: string;
  event_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  event: {
    id: string;
    title: string;
    venue_name: string | null;
    host_id: string | null;
  } | null;
  requester: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export default async function AdminClaimsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, session.user.id);
  if (!isAdmin) redirect("/dashboard");

  // Fetch all claims with event and requester info
  const { data: claims, error } = await supabase
    .from("event_claims")
    .select(`
      id,
      event_id,
      requester_id,
      message,
      status,
      rejection_reason,
      created_at,
      reviewed_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminClaimsPage] Error fetching claims:", error);
  }

  // Fetch event details for each claim
  const eventIds = [...new Set((claims || []).map((c) => c.event_id))];
  const requesterIds = [...new Set((claims || []).map((c) => c.requester_id))];

  const { data: events } = eventIds.length > 0
    ? await supabase
        .from("events")
        .select("id, title, venue_name, host_id")
        .in("id", eventIds)
    : { data: [] };

  const { data: requesters } = requesterIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", requesterIds)
    : { data: [] };

  const eventMap = new Map((events || []).map((e) => [e.id, e]));
  const requesterMap = new Map((requesters || []).map((r) => [r.id, r]));

  // Merge data
  const enrichedClaims: EventClaim[] = (claims || []).map((claim) => ({
    ...claim,
    status: claim.status as "pending" | "approved" | "rejected",
    event: eventMap.get(claim.event_id) || null,
    requester: requesterMap.get(claim.requester_id) || null,
  }));

  // Group by status
  const pendingClaims = enrichedClaims.filter((c) => c.status === "pending");
  const approvedClaims = enrichedClaims.filter((c) => c.status === "approved");
  const rejectedClaims = enrichedClaims.filter((c) => c.status === "rejected");

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-accent)]">
          Event Claims
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Review and manage requests from users to claim ownership of events.
        </p>
      </div>

      {/* Pending Claims */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pending ({pendingClaims.length})
        </h2>
        {pendingClaims.length > 0 ? (
          <ClaimsTable claims={pendingClaims} adminId={session.user.id} />
        ) : (
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center text-[var(--color-text-tertiary)]">
            No pending claims
          </div>
        )}
      </section>

      {/* Approved Claims */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Approved ({approvedClaims.length})
        </h2>
        {approvedClaims.length > 0 ? (
          <ClaimsTable claims={approvedClaims} adminId={session.user.id} showActions={false} />
        ) : (
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center text-[var(--color-text-tertiary)]">
            No approved claims
          </div>
        )}
      </section>

      {/* Rejected Claims */}
      <section>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Rejected ({rejectedClaims.length})
        </h2>
        {rejectedClaims.length > 0 ? (
          <ClaimsTable claims={rejectedClaims} adminId={session.user.id} showActions={false} />
        ) : (
          <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center text-[var(--color-text-tertiary)]">
            No rejected claims
          </div>
        )}
      </section>
    </div>
  );
}
