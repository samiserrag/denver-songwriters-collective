import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import OrganizationEditForm from "./_components/OrganizationEditForm";
import OrganizationInviteSection from "./_components/OrganizationInviteSection";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Organization | CSC",
};

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: organizationId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect(`/login?redirect=/dashboard/my-organizations/${organizationId}`);
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(
      "id, slug, name, website_url, city, organization_type, short_blurb, why_it_matters, tags, logo_image_url, cover_image_url, gallery_image_urls, fun_note, visibility"
    )
    .eq("id", organizationId)
    .single();

  if (orgError || !organization) {
    notFound();
  }

  const [{ data: grant }, isAdmin] = await Promise.all([
    supabase
      .from("organization_managers")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", sessionUser.id)
      .is("revoked_at", null)
      .maybeSingle(),
    checkAdminRole(supabase, sessionUser.id),
  ]);

  if (!grant && !isAdmin) {
    redirect("/dashboard/my-organizations");
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard/my-organizations"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to My Organizations
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Edit Organization Profile
              </h1>
              <p className="text-[var(--color-text-secondary)] mt-1">{organization.name}</p>
            </div>
            {grant?.role && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  grant.role === "owner"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {grant.role === "owner" ? "Owner" : "Manager"}
              </span>
            )}
            {isAdmin && !grant?.role && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="mb-6 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Directory visibility is currently admin-managed.
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
              {organization.visibility}
            </span>
          </div>
        </div>

        <OrganizationEditForm organization={organization} editorUserId={sessionUser.id} />

        <div className="mt-8">
          <OrganizationInviteSection
            organizationId={organization.id}
            organizationName={organization.name}
            canInviteOwner={isAdmin || grant?.role === "owner"}
          />
        </div>
      </div>
    </main>
  );
}
