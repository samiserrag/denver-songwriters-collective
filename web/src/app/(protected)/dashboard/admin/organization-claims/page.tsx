import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { OrganizationClaimsTable } from "./_components/OrganizationClaimsTable";

export const dynamic = "force-dynamic";

interface OrganizationClaim {
  id: string;
  organization_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  organization: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    organization_type: string | null;
  } | null;
  requester: {
    id: string;
    slug: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
}

export default async function AdminOrganizationClaimsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect("/login?redirect=/dashboard/admin/organization-claims");
  }

  const isAdmin = await checkAdminRole(supabase, sessionUser.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: claims, error } = await supabase
    .from("organization_claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminOrganizationClaims] Fetch error:", error);
  }

  const organizationIds = [...new Set((claims || []).map((c) => c.organization_id))];
  const requesterIds = [...new Set((claims || []).map((c) => c.requester_id))];

  const { data: organizations } =
    organizationIds.length > 0
      ? await supabase
          .from("organizations")
          .select("id, slug, name, city, organization_type")
          .in("id", organizationIds)
      : { data: [] };

  const { data: requesters } =
    requesterIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, slug, full_name, email")
          .in("id", requesterIds)
      : { data: [] };

  const organizationMap = new Map((organizations || []).map((row) => [row.id, row]));
  const requesterMap = new Map((requesters || []).map((row) => [row.id, row]));

  const enrichedClaims: OrganizationClaim[] = (claims || []).map((claim) => ({
    ...claim,
    organization: organizationMap.get(claim.organization_id) || null,
    requester: requesterMap.get(claim.requester_id) || null,
  }));

  const pendingClaims = enrichedClaims.filter((c) => c.status === "pending");
  const resolvedClaims = enrichedClaims.filter((c) => c.status !== "pending");

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Organization Claims
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Review and approve organization profile management requests.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back to Admin
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Pending Claims ({pendingClaims.length})
        </h2>

        {pendingClaims.length > 0 ? (
          <OrganizationClaimsTable claims={pendingClaims} showActions />
        ) : (
          <div className="p-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
            <p className="text-[var(--color-text-secondary)]">No pending claims to review.</p>
          </div>
        )}
      </section>

      {resolvedClaims.length > 0 && (
        <section>
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Resolved Claims ({resolvedClaims.length})
            </summary>

            <OrganizationClaimsTable claims={resolvedClaims} showActions={false} />
          </details>
        </section>
      )}
    </div>
  );
}
