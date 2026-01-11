/**
 * Overrides Ops Page
 *
 * Admin-only page for occurrence override bulk operations:
 * - CSV export
 * - CSV preview/diff (with upsert)
 * - CSV apply
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";
import OverrideExportCard from "./_components/OverrideExportCard";
import OverrideImportCard from "./_components/OverrideImportCard";

export const dynamic = "force-dynamic";

export default async function OverrideOpsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch override stats
  const serviceClient = createServiceRoleClient();
  const { data: overrides } = await serviceClient
    .from("occurrence_overrides")
    .select("id, status");

  const totalOverrides = overrides?.length || 0;
  const cancelledOverrides =
    overrides?.filter((o) => o.status === "cancelled")?.length || 0;
  const normalOverrides =
    overrides?.filter((o) => o.status === "normal")?.length || 0;

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">
        Occurrence Overrides
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-2">
        Manage per-date modifications to recurring happenings. Override specific
        occurrences without changing the series template.
      </p>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-8 text-sm">
        <span className="text-[var(--color-text-tertiary)]">
          {totalOverrides} total overrides
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {cancelledOverrides} cancelled occurrences
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {normalOverrides} modified (not cancelled)
        </span>
      </div>

      <div className="space-y-8">
        {/* Export Section */}
        <OverrideExportCard />

        {/* Import Section */}
        <OverrideImportCard />
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/dashboard/admin/ops/events"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          ← Happenings Ops
        </Link>
        <span className="text-[var(--color-text-tertiary)]">|</span>
        <Link
          href="/dashboard/admin/ops/venues"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          Venue Ops
        </Link>
        <span className="text-[var(--color-text-tertiary)]">|</span>
        <Link
          href="/dashboard/admin/ops"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          ← Back to Ops Console
        </Link>
      </div>
    </div>
  );
}
