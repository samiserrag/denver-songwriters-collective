import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClaimOrganizationButton } from "./_components/ClaimOrganizationButton";
import { RelinquishOrganizationButtonClient } from "./_components/RelinquishOrganizationButtonClient";

export const dynamic = "force-dynamic";

type ManagedGrant = {
  id: string;
  organization_id: string;
  role: "owner" | "manager";
  grant_method: "claim" | "invite" | "admin";
  created_at: string;
};

type OrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  organization_type: string | null;
  website_url: string;
  is_active: boolean;
};

type PendingClaim = {
  id: string;
  organization_id: string;
  status: "pending";
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MyOrganizationsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect("/login?redirect=/dashboard/my-organizations");
  }

  const [
    { data: managerGrants },
    { data: pendingClaims },
    { data: allOrganizations },
  ] = await Promise.all([
    supabase
      .from("organization_managers")
      .select("id, organization_id, role, grant_method, created_at")
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_claims")
      .select("id, organization_id, status, created_at")
      .eq("requester_id", sessionUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, slug, name, city, organization_type, website_url, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const grants = (managerGrants || []) as ManagedGrant[];
  const claims = (pendingClaims || []) as PendingClaim[];
  const organizations = (allOrganizations || []) as OrganizationSummary[];

  const managedIds = new Set(grants.map((g) => g.organization_id));
  const claimMap = new Map(claims.map((c) => [c.organization_id, c]));

  const managedOrganizations = organizations.filter((org) => managedIds.has(org.id));
  const managedOrganizationMap = new Map(managedOrganizations.map((org) => [org.id, org]));
  const browseOrganizations = organizations;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            My Organizations
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Manage claimed organization profiles and submit new claim requests.
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Profiles You Manage
        </h2>

        {grants.length > 0 ? (
          <div className="space-y-3">
            {grants.map((grant) => {
              const org = managedOrganizationMap.get(grant.organization_id);
              return (
                <div
                  key={grant.id}
                  className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {org ? (
                        <>
                          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                            {org.name}
                          </h3>
                          <p className="text-sm text-[var(--color-text-tertiary)]">
                            {(org.organization_type || "Organization") + (org.city ? ` • ${org.city}` : "")}
                          </p>
                          <a
                            href={org.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--color-text-accent)] hover:underline"
                          >
                            {org.website_url}
                          </a>
                        </>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] italic">
                          Organization not found
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          grant.role === "owner"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {grant.role === "owner" ? "Owner" : "Manager"}
                      </span>
                      <Link
                        href={`/dashboard/my-organizations/${grant.organization_id}`}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-accent)] transition-colors"
                      >
                        Edit
                      </Link>
                      <RelinquishOrganizationButtonClient
                        organizationId={grant.organization_id}
                        organizationName={org?.name || "this organization"}
                        role={grant.role}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                    Granted via {grant.grant_method} on {formatDate(grant.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
            <p className="text-[var(--color-text-secondary)]">
              You don&apos;t manage any organization profiles yet.
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              Submit a claim below for an organization you represent.
            </p>
          </div>
        )}
      </section>

      {claims.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Pending Claims
          </h2>
          <div className="space-y-3">
            {claims.map((claim) => {
              const org = organizations.find((item) => item.id === claim.organization_id) || null;
              return (
                <div
                  key={claim.id}
                  className="p-4 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {org?.name || "Organization"}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        Submitted {formatDate(claim.created_at)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400">
                      Pending Review
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Claim an Organization Profile
        </h2>
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">Organization</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">Type</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">City</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">Claim</th>
              </tr>
            </thead>
            <tbody>
              {browseOrganizations.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)]/30"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{org.name}</p>
                      <a
                        href={org.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-text-accent)] hover:underline"
                      >
                        {org.website_url}
                      </a>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                    {org.organization_type || "Organization"}
                  </td>
                  <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                    {org.city || "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <ClaimOrganizationButton
                      organizationId={org.id}
                      organizationName={org.name}
                      existingClaim={
                        claimMap.get(org.id)
                          ? { status: "pending" as const, id: claimMap.get(org.id)?.id }
                          : null
                      }
                      isAlreadyManager={managedIds.has(org.id)}
                    />
                  </td>
                </tr>
              ))}
              {browseOrganizations.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 px-4 text-center text-[var(--color-text-tertiary)]">
                    No organizations available for claim yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
