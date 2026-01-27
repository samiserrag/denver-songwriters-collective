/**
 * Events Ops Page
 *
 * Admin-only page for event bulk operations:
 * - CSV export (with filters)
 * - CSV preview/diff
 * - CSV apply
 * - Bulk verify/unverify
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EventExportCard from "./_components/EventExportCard";
import EventImportCard from "./_components/EventImportCard";
import BulkVerifyCard from "./_components/BulkVerifyCard";

export const dynamic = "force-dynamic";

export default async function EventOpsPage() {
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

  // Fetch event stats
  const serviceClient = createServiceRoleClient();
  const { data: events } = await serviceClient
    .from("events")
    .select("id, status, is_recurring, last_verified_at");

  const totalEvents = events?.length || 0;
  const recurringEvents = events?.filter((e) => e.is_recurring)?.length || 0;
  const verifiedEvents = events?.filter((e) => e.last_verified_at)?.length || 0;
  const activeEvents = events?.filter((e) => e.status === "active")?.length || 0;

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-accent-primary)] mb-2">
        Happenings Bulk Management
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-2">
        Export, edit, and import happening data via CSV. Verification is managed via
        bulk actions (not CSV).
      </p>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-8 text-sm">
        <span className="text-[var(--color-text-tertiary)]">
          {totalEvents} total happenings
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {activeEvents} active
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {recurringEvents} recurring
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">
          {verifiedEvents} verified ({totalEvents > 0 ? Math.round((verifiedEvents / totalEvents) * 100) : 0}%)
        </span>
      </div>

      <div className="space-y-8">
        {/* Export Section */}
        <EventExportCard />

        {/* Import Section */}
        <EventImportCard />

        {/* Bulk Verify Section */}
        <BulkVerifyCard />
      </div>

      {/* Navigation */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/dashboard/admin/ops/events/import"
          className="text-[var(--color-accent-primary)] hover:underline text-sm"
        >
          Bulk Import (Create New) →
        </Link>
        <span className="text-[var(--color-text-tertiary)]">|</span>
        <Link
          href="/dashboard/admin/ops/overrides"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm"
        >
          Occurrence Overrides →
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
